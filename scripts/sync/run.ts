// scripts/sync/run.ts
//
// One-way sync runner: LSBDDB (MSSQL, read-only bridge) -> Supabase lsbd_raw (1:1 mirror).
// Three tiers (spec section 4.1): table fingerprint -> key + row hash -> changed rows.
//
//   tsx scripts/sync/run.ts --mode quick|full [--tables A,B | --tables none]
//                           [--no-transform] [--allow-mass-delete]
//
// Exit codes: 0 = ok or another run holds the lock; 1 = failure; 2 = mass-delete guard tripped.
//
// Safety properties:
// - One run at a time: pg_try_advisory_lock(hashtext('lsbd_sync')) on the main client. A run
//   that can't get it returns runId -1 and writes nothing (Review Focus 5).
// - Each table is written in its own BEGIN ... COMMIT; any error rolls that table back and the
//   loop continues with the next table (Review Focus 5).
// - Mass-delete guard: a table that would lose > 50% of > 100 live rows is blocked (nothing
//   written for it) unless --allow-mass-delete (Review Focus 4).
// - Every bridge row must carry exactly the expected source columns + __h, otherwise that table
//   fails (a missing column would otherwise silently become NULL).
// - Output is progress and counts only: never row values, never secrets.

import { spawnSync } from "node:child_process";
import { Client } from "pg";
import { loadSecrets } from "../lib/secrets";
import { readSchema, query, closeBridge } from "./mssql";
import { EXCLUDED_TABLES, applyPolicy, policyFor } from "./policy";
import { fingerprintSql, keysSql, rowsSql } from "./sql-gen";
import { diffKeys, keyOf, massDeleteGuard } from "./diff";
import { readRawKeys, replaceTable, rowToRaw, softDelete, upsertRaw } from "./raw-writer";
import { pgTypeFor } from "./type-map";
import type { KeyHash, SourceTable } from "./types";

export type RunStatus = "ok" | "failed" | "blocked" | "skipped";

export interface RunSummary {
  runId: number;
  status: RunStatus;
  tablesChanged: string[];
  blockedTables: string[];
  inserted: number;
  updated: number;
  deleted: number;
  orphansSkipped: number;
  schemaDrift: string[];
}

export interface RunOptions {
  mode: "quick" | "full";
  tables?: string[] | "none";
  transform: boolean;
  allowMassDelete: boolean;
}

export interface RunDeps {
  readSchema: typeof readSchema;
  query: typeof query;
  db?: () => Promise<Client>;
}

const LOCK_KEY = "hashtext('lsbd_sync')";
const ROW_CHUNK = 1_000; // keys per rowsSql IN-list
const ALL_ROWS_RATIO = 0.3; // above this share of changed keys, fetch the whole table once
const BOOKKEEPING = new Set(["_rowid", "_row_hash", "_synced_at", "_deleted_at"]);
/** pgTypeFor() names -> information_schema.columns.data_type names. */
const INFO_TYPE: Record<string, string> = { timestamp: "timestamp without time zone" };

const qi = (id: string): string => `"${id.replace(/"/g, '""')}"`;
const log = (s: string): void => console.log(s);
const errMsg = (e: unknown): string => (e instanceof Error ? e.message : String(e));

// ---------------------------------------------------------------------------------------
// Pure helpers (unit-tested in tests/sync/run.test.ts)
// ---------------------------------------------------------------------------------------

export function parseArgs(argv: string[]): RunOptions {
  const o: RunOptions = { mode: "quick", tables: undefined, transform: true, allowMassDelete: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--") continue;
    if (a === "--mode") {
      const v = argv[++i];
      if (v !== "quick" && v !== "full") throw new Error(`--mode must be quick or full`);
      o.mode = v;
    } else if (a === "--tables") {
      const v = argv[++i];
      if (v === undefined) throw new Error("--tables needs a value (A,B or none)");
      if (v === "none") o.tables = "none";
      else {
        const list = v.split(",").map((s) => s.trim()).filter((s) => s !== "");
        if (list.length === 0) throw new Error("--tables list is empty");
        o.tables = list;
      }
    } else if (a === "--no-transform") o.transform = false;
    else if (a === "--allow-mass-delete") o.allowMassDelete = true;
    else throw new Error(`unknown argument: ${a}`);
  }
  return o;
}

export function exitCodeFor(status: RunStatus): number {
  if (status === "failed") return 1;
  if (status === "blocked") return 2;
  return 0;
}

/** Strips data values that database error messages sometimes quote. */
export function redact(msg: string): string {
  return msg
    .replace(/(invalid input (?:syntax|value) for [^:]*: )"[^"]*"/g, '$1"<redacted>"')
    .replace(/(value )'[^']*'/g, "$1'<redacted>'")
    .replace(/\)=\([^)]*\)/g, ")=(<redacted>)");
}

/** Throws unless the row's keys are exactly the expected column set. Reports names only. */
export function checkColumnSet(table: string, row: Record<string, unknown>, expected: Set<string>): void {
  const keys = Object.keys(row);
  const missing = [...expected].filter((k) => !Object.prototype.hasOwnProperty.call(row, k));
  const extra = keys.filter((k) => !expected.has(k));
  if (missing.length > 0 || extra.length > 0) {
    throw new Error(
      `${table}: column set mismatch (missing: ${missing.join(",") || "-"}; extra: ${extra.join(",") || "-"})`,
    );
  }
}

export interface Drift {
  add: { name: string; pgType: string }[];
  fatal: string[];
  notes: string[];
}

/**
 * Compares one source table with its lsbd_raw columns (information_schema rows).
 * New source column -> ADD COLUMN (unless the policy drops it). Removed column or changed
 * type -> fatal for this table. Bookkeeping columns are ignored.
 */
export function computeDrift(t: SourceTable, rawCols: { column_name: string; data_type: string }[]): Drift {
  const policy = policyFor(t.name);
  const raw = new Map(rawCols.map((r) => [r.column_name, r.data_type]));
  const d: Drift = { add: [], fatal: [], notes: [] };
  const fatal = (s: string) => {
    d.fatal.push(s);
    d.notes.push(s);
  };
  const sourceNames = new Set(t.columns.map((c) => c.name));
  for (const c of [...t.columns].sort((a, b) => a.ordinal - b.ordinal)) {
    const action = policy[c.name];
    if (action === "drop") {
      if (raw.has(c.name)) fatal(`${t.name}.${c.name} present in raw but policy drops it`);
      continue;
    }
    let pg: string;
    try {
      pg = action === "hmac" ? "text" : pgTypeFor(c);
    } catch {
      fatal(`${t.name}.${c.name} unsupported type ${c.type}`);
      continue;
    }
    const have = raw.get(c.name);
    if (have === undefined) {
      d.add.push({ name: c.name, pgType: pg });
      d.notes.push(`${t.name}.${c.name} added`);
    } else if ((INFO_TYPE[pg] ?? pg) !== have) {
      fatal(`${t.name}.${c.name} type changed`);
    }
  }
  for (const name of raw.keys()) {
    if (BOOKKEEPING.has(name) || sourceNames.has(name)) continue;
    fatal(`${t.name}.${name} removed`);
  }
  return d;
}

// ---------------------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------------------

async function defaultDb(): Promise<Client> {
  const url = loadSecrets()["SUPABASE_DB_URL_SESSION"];
  if (!url) throw new Error("SUPABASE_DB_URL_SESSION not found in secrets file");
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false }, application_name: "lsbd-sync" });
  await c.connect();
  return c;
}

function hmacKeyFromSecrets(): Buffer {
  const b64 = loadSecrets()["PII_SSN_HMAC_KEY"];
  if (!b64) throw new Error("PII_SSN_HMAC_KEY missing from secrets file; refusing to sync (never generated here)");
  const key = Buffer.from(b64, "base64");
  if (key.length < 16) throw new Error("PII_SSN_HMAC_KEY is too short after base64 decoding");
  return key;
}

type Fp = { n: string | null; fp: string | null };
const norm = (v: unknown): string | null => (v === null || v === undefined ? null : String(v));

interface TableResult {
  blocked: boolean;
  path: string;
  ins: number;
  upd: number;
  del: number;
  liveBefore: number;
}

interface Ctx {
  c: Client;
  q: typeof query;
  hmacKey: Buffer;
  allowMassDelete: boolean;
}

async function collect<T>(it: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const r of it) out.push(r);
  return out;
}

/** Everything written for one table happens in one transaction on ctx.c. */
async function writeTable(
  ctx: Ctx,
  t: SourceTable,
  adds: Drift["add"],
  fp: Fp | undefined,
  changed: boolean,
  write: () => Promise<number>,
): Promise<number> {
  const { c } = ctx;
  await c.query("BEGIN");
  try {
    for (const a of adds) {
      await c.query(`ALTER TABLE lsbd_raw.${qi(t.name)} ADD COLUMN ${qi(a.name)} ${a.pgType}`);
    }
    const out = await write();
    const live = await c.query<{ n: string }>(
      `SELECT count(*) AS n FROM lsbd_raw.${qi(t.name)} WHERE _deleted_at IS NULL`,
    );
    await c.query(
      `INSERT INTO lsbd_raw._sync_tables
         (table_name, source_count, source_fingerprint, raw_live_count, last_changed_at, last_synced_at)
       VALUES ($1, $2::bigint, $3::bigint, $4::bigint, CASE WHEN $5::boolean THEN now() END, now())
       ON CONFLICT (table_name) DO UPDATE SET
         source_count = EXCLUDED.source_count,
         source_fingerprint = EXCLUDED.source_fingerprint,
         raw_live_count = EXCLUDED.raw_live_count,
         last_changed_at = CASE WHEN $5::boolean THEN now() ELSE lsbd_raw._sync_tables.last_changed_at END,
         last_synced_at = now()`,
      [t.name, fp?.n ?? null, fp?.fp ?? null, live.rows[0].n, changed],
    );
    await c.query("COMMIT");
    return out;
  } catch (e) {
    await c.query("ROLLBACK").catch(() => undefined);
    throw e;
  }
}

function sourceRowTaker(ctx: Ctx, t: SourceTable) {
  const expected = new Set([...t.columns.map((x) => x.name), "__h"]);
  return (r: Record<string, unknown>): Record<string, unknown> => {
    checkColumnSet(t.name, r, expected);
    return rowToRaw(applyPolicy(t.name, r, ctx.hmacKey), t);
  };
}

async function syncPkTable(ctx: Ctx, t: SourceTable, adds: Drift["add"], fp: Fp | undefined): Promise<TableResult> {
  const pk = t.pk!;
  const pkCol = t.columns.find((x) => x.name === pk);
  if (!pkCol) throw new Error(`${t.name}: pk column ${pk} not in column list`);

  const src: KeyHash[] = [];
  for await (const r of ctx.q<{ k: unknown; h: unknown }>(keysSql(t))) {
    src.push({ k: keyOf(r.k, pkCol.type), h: String(r.h) });
  }
  const tgt = await readRawKeys(ctx.c, t);
  const d = diffKeys(src, tgt);
  const base = { ins: d.inserted.length, upd: d.updated.length, del: d.deleted.length, liveBefore: tgt.length };

  if (massDeleteGuard(tgt.length, d.deleted.length)) {
    if (!ctx.allowMassDelete) return { blocked: true, path: "guard", ...base };
    log(`  ${t.name}: mass-delete guard overridden (--allow-mass-delete): ${d.deleted.length} of ${tgt.length} live rows`);
  }

  const insertedSet = new Set(d.inserted);
  const updatedSet = new Set(d.updated);
  const changedCount = insertedSet.size + updatedSet.size;
  const take = sourceRowTaker(ctx, t);
  const rows = new Map<string, Record<string, unknown>>(); // dedupe NOLOCK duplicates, last wins
  let path = "none";
  const accept = (r: Record<string, unknown>) => {
    const raw = take(r);
    const k = keyOf(raw[pk], pkCol.type);
    if (insertedSet.has(k) || updatedSet.has(k)) rows.set(k, raw);
  };
  if (changedCount > 0) {
    const distinctSource = new Set(src.map((x) => x.k)).size;
    if (changedCount > ALL_ROWS_RATIO * distinctSource) {
      path = "all";
      for await (const r of ctx.q<Record<string, unknown>>(rowsSql(t, "all"))) accept(r);
    } else {
      path = "chunks";
      const keys = [...insertedSet, ...updatedSet];
      for (let i = 0; i < keys.length; i += ROW_CHUNK) {
        for await (const r of ctx.q<Record<string, unknown>>(rowsSql(t, keys.slice(i, i + ROW_CHUNK)))) accept(r);
      }
    }
  }
  // A key that vanished between the key read and the row read is simply not written; the next
  // run sees it as a delete.
  let ins = 0;
  let upd = 0;
  for (const k of rows.keys()) {
    if (insertedSet.has(k)) ins++;
    else upd++;
  }
  const changed = rows.size > 0 || d.deleted.length > 0 || adds.length > 0;
  let del = 0;
  await writeTable(ctx, t, adds, fp, changed, async () => {
    if (rows.size > 0) await upsertRaw(ctx.c, t, [...rows.values()]);
    if (d.deleted.length > 0) del = await softDelete(ctx.c, t, d.deleted);
    return 0;
  });
  return { blocked: false, path, ins, upd, del, liveBefore: tgt.length };
}

/** No-PK tables (all tiny): compare row-hash multisets, replace wholesale when they differ. */
async function syncNoPkTable(ctx: Ctx, t: SourceTable, adds: Drift["add"], fp: Fp | undefined): Promise<TableResult> {
  const take = sourceRowTaker(ctx, t);
  const rows = (await collect(ctx.q<Record<string, unknown>>(rowsSql(t, "all")))).map(take);
  const rawHashes = (
    await ctx.c.query<{ h: string }>(`SELECT _row_hash AS h FROM lsbd_raw.${qi(t.name)} WHERE _deleted_at IS NULL`)
  ).rows.map((r) => r.h);
  const counts = new Map<string, number>();
  for (const h of rawHashes) counts.set(h, (counts.get(h) ?? 0) + 1);
  let ins = 0;
  for (const r of rows) {
    const h = String(r["_row_hash"]);
    const n = counts.get(h) ?? 0;
    if (n > 0) counts.set(h, n - 1);
    else ins++;
  }
  let del = 0;
  for (const n of counts.values()) del += n;

  if (massDeleteGuard(rawHashes.length, del)) {
    if (!ctx.allowMassDelete) return { blocked: true, path: "guard", ins, upd: 0, del, liveBefore: rawHashes.length };
    log(`  ${t.name}: mass-delete guard overridden (--allow-mass-delete): ${del} of ${rawHashes.length} rows`);
  }
  const changed = ins > 0 || del > 0 || adds.length > 0;
  await writeTable(ctx, t, adds, fp, changed, async () => {
    if (changed) await replaceTable(ctx.c, t, rows);
    return 0;
  });
  return { blocked: false, path: changed ? "replace" : "same", ins, upd: 0, del, liveBefore: rawHashes.length };
}

function healthcheckUrl(): string | undefined {
  const env = process.env.SYNC_HEALTHCHECK_URL;
  if (env) return env;
  try {
    return loadSecrets()["SYNC_HEALTHCHECK_URL"] || undefined;
  } catch {
    return undefined;
  }
}

async function notify(summary: RunSummary, error: string | null): Promise<void> {
  const url = healthcheckUrl();
  if (url) {
    const target = summary.status === "ok" ? url : `${url.replace(/\/+$/, "")}/fail`;
    try {
      await fetch(target, { method: "GET", signal: AbortSignal.timeout(10_000) });
    } catch (e) {
      console.error(`healthcheck ping failed: ${errMsg(e)}`);
    }
  }
  if (summary.status === "failed" || summary.status === "blocked") {
    const message = `LSBD sync run ${summary.runId} ${summary.status}: ${error ?? ""}`.slice(0, 4000);
    try {
      const r = spawnSync(
        "powershell.exe",
        [
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          `Write-EventLog -LogName Application -Source LSBD-Sync -EventId 1001 -EntryType Error -Message '${message.replace(/'/g, "''")}'`,
        ],
        { windowsHide: true, timeout: 30_000, encoding: "utf8" },
      );
      if (r.status !== 0) console.error("event log write failed (is the LSBD-Sync source registered?)");
    } catch (e) {
      console.error(`event log write failed: ${errMsg(e)}`);
    }
  }
}

export async function runSync(opts: RunOptions, deps?: RunDeps): Promise<RunSummary> {
  const rs = deps?.readSchema ?? readSchema;
  const q = deps?.query ?? query;
  const summary: RunSummary = {
    runId: -1,
    status: "skipped",
    tablesChanged: [],
    blockedTables: [],
    inserted: 0,
    updated: 0,
    deleted: 0,
    orphansSkipped: 0,
    schemaDrift: [],
  };
  const t0 = Date.now();
  let c: Client | null = null;
  let locked = false;
  try {
    c = await (deps?.db ?? defaultDb)();
    const lock = await c.query<{ got: boolean }>(`SELECT pg_try_advisory_lock(${LOCK_KEY}) AS got`);
    if (!lock.rows[0].got) {
      log("another sync run holds the lsbd_sync lock; skipping");
      return summary;
    }
    locked = true;

    // We hold the lock, so any row still 'running' belongs to a process that died.
    await c.query(
      `UPDATE lsbd_raw._sync_runs SET status = 'failed', finished_at = now(),
         error = coalesce(error || '; ', '') || 'abandoned: the process ended while running'
       WHERE status = 'running'`,
    );
    const ins = await c.query<{ id: string }>(
      `INSERT INTO lsbd_raw._sync_runs (mode, status) VALUES ($1, 'running') RETURNING id`,
      [opts.mode],
    );
    summary.runId = Number(ins.rows[0].id);
    log(`sync run ${summary.runId}: mode ${opts.mode}, tables ${opts.tables === undefined ? "all" : opts.tables === "none" ? "none" : opts.tables.join(",")}`);

    const errors: string[] = [];
    const failed: string[] = [];
    let runFailed = false;

    try {
      if (opts.tables !== "none") {
        const ctx: Ctx = { c, q, hmacKey: hmacKeyFromSecrets(), allowMassDelete: opts.allowMassDelete };
        await syncAll(ctx, opts, rs, summary, errors, failed);
      }
      if (opts.transform) {
        try {
          await runTransforms(c, opts, summary);
        } catch (e) {
          runFailed = true;
          errors.push(`transforms: ${redact(errMsg(e))}`);
          log(`transforms FAILED: ${redact(errMsg(e))}`);
        }
      }
    } catch (e) {
      runFailed = true;
      errors.push(`run: ${redact(errMsg(e))}`);
      log(`run FAILED: ${redact(errMsg(e))}`);
    }

    summary.status = runFailed || failed.length > 0 ? "failed" : summary.blockedTables.length > 0 ? "blocked" : "ok";
    const notes = [...summary.schemaDrift, ...errors];
    const error = notes.length > 0 ? notes.join("; ") : null;
    await c.query(
      `UPDATE lsbd_raw._sync_runs SET finished_at = now(), status = $2, tables_changed = $3, inserted = $4,
         updated = $5, deleted = $6, orphans_skipped = $7, error = $8, blocked_tables = $9, schema_drift = $10
       WHERE id = $1`,
      [
        summary.runId,
        summary.status,
        summary.tablesChanged,
        summary.inserted,
        summary.updated,
        summary.deleted,
        summary.orphansSkipped,
        error,
        summary.blockedTables,
        summary.schemaDrift,
      ],
    );
    log(
      `sync run ${summary.runId} ${summary.status} in ${((Date.now() - t0) / 1000).toFixed(1)} s: ` +
        `${summary.tablesChanged.length} tables changed, ins ${summary.inserted} upd ${summary.updated} del ${summary.deleted}` +
        (summary.blockedTables.length ? `, blocked: ${summary.blockedTables.join(",")}` : "") +
        (failed.length ? `, failed: ${failed.join(",")}` : "") +
        (summary.schemaDrift.length ? `, drift: ${summary.schemaDrift.join("; ")}` : ""),
    );
    await notify(summary, error);
    return summary;
  } finally {
    if (c) {
      if (locked) await c.query(`SELECT pg_advisory_unlock(${LOCK_KEY})`).catch(() => undefined);
      await c.end().catch(() => undefined);
    }
    await closeBridge().catch((e) => console.error(`closeBridge: ${errMsg(e)}`));
  }
}

async function syncAll(
  ctx: Ctx,
  opts: RunOptions,
  rs: typeof readSchema,
  summary: RunSummary,
  errors: string[],
  failed: string[],
): Promise<void> {
  const { c, q } = ctx;
  const fail = (table: string, why: string) => {
    failed.push(table);
    errors.push(`${table}: ${why}`);
    log(`${table.padEnd(26)} FAILED: ${why}`);
  };

  const schema = await rs();
  const byName = new Map(schema.map((t) => [t.name, t]));
  let scope: SourceTable[] = [];
  if (Array.isArray(opts.tables)) {
    for (const name of opts.tables) {
      if (EXCLUDED_TABLES.has(name)) fail(name, "excluded table");
      else if (!byName.has(name)) fail(name, "not in source schema");
      else scope.push(byName.get(name)!);
    }
  } else {
    scope = schema.filter((t) => !EXCLUDED_TABLES.has(t.name));
  }

  // Schema drift against lsbd_raw.
  const rawCols = new Map<string, { column_name: string; data_type: string }[]>();
  const info = await c.query<{ table_name: string; column_name: string; data_type: string }>(
    `SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema = 'lsbd_raw'`,
  );
  for (const r of info.rows) {
    if (!rawCols.has(r.table_name)) rawCols.set(r.table_name, []);
    rawCols.get(r.table_name)!.push(r);
  }
  if (opts.tables === undefined) {
    for (const name of rawCols.keys()) {
      if (!name.startsWith("_") && !byName.has(name)) summary.schemaDrift.push(`${name} missing from source (raw kept)`);
    }
  }
  const adds = new Map<string, Drift["add"]>();
  const ready: SourceTable[] = [];
  for (const t of scope) {
    const cols = rawCols.get(t.name);
    if (!cols) {
      summary.schemaDrift.push(`${t.name} new table (skipped)`);
      continue;
    }
    const d = computeDrift(t, cols);
    summary.schemaDrift.push(...d.notes);
    if (d.fatal.length > 0) {
      fail(t.name, `schema drift: ${d.fatal.join(", ")}`);
      continue;
    }
    adds.set(t.name, d.add);
    ready.push(t);
  }
  if (ready.length === 0) return;

  // Tier 1: fingerprints. Taken before the key reads so a concurrent edit can only make the next
  // quick run do extra work, never skip a change. Stored in both modes (full seeds quick).
  const fps = new Map<string, Fp>();
  for await (const r of q<{ t: string; n: unknown; fp: unknown }>(fingerprintSql(ready))) {
    fps.set(r.t, { n: norm(r.n), fp: norm(r.fp) });
  }
  let work = ready;
  if (opts.mode === "quick") {
    const stored = new Map<string, Fp>();
    const st = await c.query<{ table_name: string; source_count: string | null; source_fingerprint: string | null }>(
      `SELECT table_name, source_count, source_fingerprint FROM lsbd_raw._sync_tables`,
    );
    for (const r of st.rows) stored.set(r.table_name, { n: norm(r.source_count), fp: norm(r.source_fingerprint) });
    work = ready.filter((t) => {
      if (t.pk === null || (adds.get(t.name)?.length ?? 0) > 0) return true;
      const s = stored.get(t.name);
      const f = fps.get(t.name);
      return !s || !f || s.n !== f.n || s.fp !== f.fp;
    });
    log(`quick: ${work.length} of ${ready.length} tables on the work list`);
  }

  for (const t of work) {
    const started = Date.now();
    try {
      const r =
        t.pk === null
          ? await syncNoPkTable(ctx, t, adds.get(t.name) ?? [], fps.get(t.name))
          : await syncPkTable(ctx, t, adds.get(t.name) ?? [], fps.get(t.name));
      const ms = Date.now() - started;
      if (r.blocked) {
        summary.blockedTables.push(t.name);
        errors.push(`${t.name}: mass-delete guard (would delete ${r.del} of ${r.liveBefore} live rows)`);
        log(`${t.name.padEnd(26)} ${opts.mode} BLOCKED: would delete ${r.del} of ${r.liveBefore} live rows ${ms}ms`);
        continue;
      }
      summary.inserted += r.ins;
      summary.updated += r.upd;
      summary.deleted += r.del;
      if (r.ins + r.upd + r.del > 0 || (adds.get(t.name)?.length ?? 0) > 0) summary.tablesChanged.push(t.name);
      log(`${t.name.padEnd(26)} ${opts.mode} ${r.path.padEnd(7)} ins ${r.ins} upd ${r.upd} del ${r.del} ${ms}ms`);
    } catch (e) {
      fail(t.name, redact(errMsg(e)));
    }
  }
}

async function runTransforms(c: Client, opts: RunOptions, summary: RunSummary): Promise<void> {
  const exists = await c.query<{ ok: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                    WHERE n.nspname = 'lsbd' AND p.proname = 'run_transforms' AND p.prokind = 'p') AS ok`,
  );
  if (!exists.rows[0].ok) {
    log("transforms not installed; skipped");
    return;
  }
  const sources = opts.mode === "full" || opts.tables === "none" ? null : summary.tablesChanged;
  if (sources !== null && sources.length === 0) {
    log("transforms: no changed tables; skipped");
    return;
  }
  const started = Date.now();
  await c.query("SET statement_timeout = 0");
  const r = await c.query<{ orphans: number | null }>(
    `CALL lsbd.run_transforms(changed_sources => $1::text[], orphans => 0)`,
    [sources],
  );
  summary.orphansSkipped = Number(r.rows[0]?.orphans ?? 0);
  log(`transforms done in ${Date.now() - started}ms, orphans skipped ${summary.orphansSkipped}`);
}

// ---------------------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------------------

if (require.main === module) {
  let opts: RunOptions;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error(errMsg(e));
    process.exit(1);
  }
  runSync(opts)
    .then((s) => {
      process.exitCode = exitCodeFor(s.status);
    })
    .catch((e) => {
      console.error(`sync failed: ${redact(errMsg(e))}`);
      process.exitCode = 1;
    });
}
