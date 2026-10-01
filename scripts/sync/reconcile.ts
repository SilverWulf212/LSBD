// scripts/sync/reconcile.ts
//
// Reconcile report: proves, table by table, that lsbd_raw's key set and stored source row hashes
// match LSBDDB (it compares the hash stored at sync time with a fresh source hash; it does not
// re-read raw column values), and writes reports/reconcile-<yyyyMMdd-HHmm>.md (local time).
//
//   tsx scripts/sync/reconcile.ts
//
// Section 1 (gating): per table, source count vs raw live count; PK tables also compare the
//   key set and per-row hashes. No-PK tables are compared on counts only. A failing table is
//   re-read once before it is reported as FAIL (staff may edit Access mid-run).
// Section 2 (informational, never fails the run): duplicate (Type, LICENSEID) groups, orphans
//   from the latest run, SSN normalisation failures.
//
// Exit: 0 = every table PASS, 1 = any FAIL or a fatal error. Strictly read-only on both sides.
// The report holds counts only, plus license numbers in Section 2. No names, SSNs or row values.

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Client } from "pg";
import { loadSecrets } from "../lib/secrets";
import { connectPg } from "../lib/pg";
import { readSchema, query, closeBridge } from "./mssql";
import { EXCLUDED_TABLES } from "./policy";
import { keysSql } from "./sql-gen";
import { readRawKeys } from "./raw-writer";
import { diffKeys, keyOf } from "./diff";
import { redact } from "./run";
import type { KeyHash, SourceTable } from "./types";

export interface Comparison {
  countMatch: boolean;
  setMatch: boolean;
  missing: number;
  extra: number;
  hashMismatch: number;
}

/**
 * sourceCount is the separate COUNT_BIG(*) of the source table; source/raw are the key+hash
 * lists. countMatch needs all three to agree (count, key list, raw live rows), so a key read that
 * disagrees with the count is visible. missing = in source not raw, extra = in raw not source.
 */
export function compareTable(sourceCount: number, source: KeyHash[], raw: KeyHash[]): Comparison {
  const d = diffKeys(source, raw);
  return {
    countMatch: sourceCount === source.length && sourceCount === raw.length,
    setMatch: d.inserted.length === 0 && d.deleted.length === 0,
    missing: d.inserted.length,
    extra: d.deleted.length,
    hashMismatch: d.updated.length,
  };
}

export const passed = (c: Comparison): boolean => c.countMatch && c.setMatch && c.hashMismatch === 0;

export interface TableRow {
  name: string;
  mode: "keys" | "counts";
  sourceCount: number;
  rawCount: number;
  pass: boolean;
  rechecked: boolean;
  note: string;
}

export interface DupGroup {
  type: string;
  licenseId: string;
  n: number;
}

export interface SsnRow {
  table: string;
  source: number;
  raw: number;
  failures: number;
  /** Set when this item could not be computed; the counts are then meaningless. */
  error?: string;
}

/** A Section 2 item that failed renders as its redacted error; it never affects Section 1 or the exit code. */
export type Guarded<T> = T | { error: string };
export const isError = <T>(v: Guarded<T>): v is { error: string } =>
  typeof v === "object" && v !== null && !Array.isArray(v) && "error" in v && typeof (v as { error: unknown }).error === "string";

export async function guarded<T>(fn: () => Promise<T>): Promise<Guarded<T>> {
  try {
    return await fn();
  } catch (e) {
    return { error: redact(e instanceof Error ? e.message : String(e)) };
  }
}

export interface ReportData {
  when: Date;
  durationSec: number;
  rows: TableRow[];
  /** True when readSchema() returned no tables: always a FAIL. */
  schemaEmpty?: boolean;
  dupGroups: Guarded<DupGroup[]>;
  orphans: string;
  /** Per-relation counts from lsbd._transform_quality (Task 14). Absent = not collected. */
  relations?: Guarded<RelationRow[]>;
  ssn: SsnRow[];
}

/** One row of lsbd._transform_quality: counts only, never row values. */
export interface RelationRow {
  target: string;
  relation: string;
  kind: "skipped" | "unlinked";
  sourceTable: string;
  n: number;
}

export interface SchemaCheck {
  empty: boolean;
  /** Source tables with no lsbd_raw table. */
  missingRaw: string[];
  /** lsbd_raw data tables with live rows but no source table. */
  sourceMissing: string[];
}

/**
 * Pure cross-check of the source table list against the lsbd_raw data tables.
 * rawLive maps each lsbd_raw data table (bookkeeping `_sync_*` tables excluded by the caller)
 * to its live row count. Raw-only tables with no live rows are not a problem.
 */
export function checkSchema(sourceNames: string[], rawLive: Map<string, number>): SchemaCheck {
  const src = new Set(sourceNames);
  return {
    empty: sourceNames.length === 0,
    missingRaw: sourceNames.filter((n) => !rawLive.has(n)),
    sourceMissing: [...rawLive].filter(([n, live]) => !src.has(n) && live > 0).map(([n]) => n).sort(),
  };
}

const p2 = (n: number): string => String(n).padStart(2, "0");

export function reportFileName(d: Date): string {
  return `reconcile-${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}-${p2(d.getHours())}${p2(d.getMinutes())}.md`;
}

const stamp = (d: Date): string =>
  `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`;

export function summaryLine(rows: TableRow[], schemaEmpty = false): string {
  if (schemaEmpty || rows.length === 0) return "FAIL: source schema empty";
  const fails = rows.filter((r) => !r.pass).length;
  return fails === 0 ? `PASS ${rows.length}/${rows.length}` : `FAIL ${fails} tables`;
}

/** Table cells never hold user text: names are table names, everything else is a number. */
const cell = (s: string): string => s.replace(/\|/g, "/");

export function renderReport(r: ReportData): string {
  const out: string[] = [];
  out.push(`# LSBD reconcile report`, ``);
  out.push(`Generated ${stamp(r.when)} (local time), ${r.durationSec.toFixed(1)} s. Result: **${summaryLine(r.rows, r.schemaEmpty)}**.`, ``);
  out.push(`## 1. Reconciliation`, ``);
  out.push(
    `Source = LSBDDB (dbo, NOLOCK), raw = lsbd_raw live rows. Tables with a primary key are also compared on key set and per-row hash; tables without one are compared on counts only.`,
    ``,
  );
  out.push(`| Table | Compared on | Source count | Raw live count | Result |`, `| --- | --- | ---: | ---: | --- |`);
  for (const t of r.rows) {
    const res = (t.pass ? "PASS" : "FAIL") + (t.rechecked ? " (rechecked)" : "") + (t.note ? ` - ${t.note}` : "");
    out.push(`| ${cell(t.name)} | ${t.mode === "keys" ? "keys + hashes" : "counts only"} | ${t.sourceCount} | ${t.rawCount} | ${cell(res)} |`);
  }
  out.push(``);
  out.push(`## 2. Data quality for staff review`, ``);
  out.push(`Informational only; nothing here affects the result above.`, ``);
  out.push(`### Duplicate license groups in tblDenHyg`, ``);
  if (isError(r.dupGroups)) {
    out.push(`error: ${cell(r.dupGroups.error)}`, ``);
  } else {
    out.push(`${r.dupGroups.length} (Type, LICENSEID) groups have more than one live row.`, ``);
    if (r.dupGroups.length > 0) {
      out.push(`| Type | LICENSEID | Rows |`, `| --- | --- | ---: |`);
      for (const g of r.dupGroups) out.push(`| ${cell(g.type)} | ${cell(g.licenseId)} | ${g.n} |`);
      out.push(``);
    }
  }
  out.push(`### Orphans skipped by the latest transform run`, ``, `${r.orphans}`, ``);
  if (r.relations !== undefined) {
    out.push(`### Orphans and unlinked references per relation`, ``);
    if (isError(r.relations)) {
      out.push(`error: ${cell(r.relations.error)}`, ``);
    } else {
      const nonZero = r.relations.filter((x) => x.n > 0);
      out.push(
        `From the latest run of each transform domain. "skipped" = live raw rows with no lsbd row (orphan, NULL key, duplicate key); ` +
          `"unlinked" = rows loaded with a NULL reference because the referenced row does not exist. ` +
          `${r.relations.length - nonZero.length} relations with a count of 0 are not listed.`,
        ``,
      );
      if (nonZero.length > 0) {
        out.push(`| lsbd table | Relation | Kind | Source table | Rows |`, `| --- | --- | --- | --- | ---: |`);
        for (const x of nonZero) {
          out.push(`| ${cell(x.target)} | ${cell(x.relation)} | ${x.kind} | ${cell(x.sourceTable)} | ${x.n} |`);
        }
        out.push(``);
      }
    }
  }
  out.push(`### SSN normalisation failures`, ``);
  out.push(`Rows with a non-empty source SSN minus raw rows with a non-null SSN. Counts only.`, ``);
  out.push(`| Table | Source non-empty SSN | Raw non-null SSN | Failures |`, `| --- | ---: | ---: | ---: |`);
  for (const s of r.ssn) {
    if (s.error !== undefined) out.push(`| ${cell(s.table)} | error: ${cell(s.error)} | | |`);
    else out.push(`| ${cell(s.table)} | ${s.source} | ${s.raw} | ${s.failures} |`);
  }
  out.push(``);
  return out.join("\n");
}

// ---------------------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------------------

const qi = (id: string): string => `"${id.replace(/"/g, '""')}"`;
const nlit = (s: string): string => `N'${s.replace(/'/g, "''")}'`;
const br = (id: string): string => `[${id.replace(/]/g, "]]")}]`;
const errMsg = (e: unknown): string => (e instanceof Error ? e.message : String(e));
const SSN_TABLES = ["tblDenHyg", "Individual", "tblRndDentists", "tblRndHygienists"];

async function connect(): Promise<Client> {
  const url = loadSecrets()["SUPABASE_DB_URL_SESSION"];
  if (!url) throw new Error("SUPABASE_DB_URL_SESSION not found in secrets file");
  return connectPg(url, {
    applicationName: "lsbd-reconcile",
    onError: (e) => console.error(`pg client error: ${redact(e.message)}`),
  });
}

async function sourceCounts(tables: SourceTable[]): Promise<Map<string, number>> {
  const m = new Map<string, number>();
  const sql = tables
    .map((t) => `SELECT ${nlit(t.name)} AS t, COUNT_BIG(*) AS n FROM dbo.${br(t.name)} WITH (NOLOCK)`)
    .join(" UNION ALL ");
  for await (const r of query<{ t: string; n: unknown }>(sql)) m.set(String(r.t), Number(r.n));
  return m;
}

async function sourceCount(t: SourceTable): Promise<number> {
  return (await sourceCounts([t])).get(t.name)!;
}

async function compareOne(c: Client, t: SourceTable, sc: number): Promise<TableRow> {
  if (t.pk === null) {
    const r = await c.query<{ n: string }>(`SELECT count(*) AS n FROM lsbd_raw.${qi(t.name)} WHERE _deleted_at IS NULL`);
    const raw = Number(r.rows[0].n);
    return { name: t.name, mode: "counts", sourceCount: sc, rawCount: raw, pass: sc === raw, rechecked: false, note: "" };
  }
  const pkCol = t.columns.find((x) => x.name === t.pk)!;
  const src: KeyHash[] = [];
  for await (const r of query<{ k: unknown; h: unknown }>(keysSql(t))) src.push({ k: keyOf(r.k, pkCol.type), h: String(r.h) });
  const raw = await readRawKeys(c, t);
  const cmp = compareTable(sc, src, raw);
  const notes: string[] = [];
  if (!cmp.countMatch) notes.push(`count/keys mismatch (keys ${src.length})`);
  if (cmp.missing) notes.push(`${cmp.missing} missing`);
  if (cmp.extra) notes.push(`${cmp.extra} extra`);
  if (cmp.hashMismatch) notes.push(`${cmp.hashMismatch} hash mismatch`);
  return { name: t.name, mode: "keys", sourceCount: sc, rawCount: raw.length, pass: passed(cmp), rechecked: false, note: notes.join(", ") };
}

async function dupGroups(c: Client): Promise<DupGroup[]> {
  const dup = await c.query<{ type: string; lic: string; n: string }>(
    `SELECT "Type" AS type, "LICENSEID" AS lic, count(*) AS n FROM lsbd_raw."tblDenHyg"
      WHERE _deleted_at IS NULL GROUP BY "Type", "LICENSEID" HAVING count(*) > 1 ORDER BY "Type", "LICENSEID"`,
  );
  return dup.rows.map((r) => ({ type: String(r.type), licenseId: String(r.lic), n: Number(r.n) }));
}

async function orphanSummary(c: Client): Promise<string> {
  const proc = await c.query<{ ok: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                     WHERE n.nspname = 'lsbd' AND p.proname = 'run_transforms') AS ok`,
  );
  if (!proc.rows[0].ok) return "n/a (transforms not installed)";
  const o = await c.query<{ id: string; orphans_skipped: number | null }>(
    `SELECT id, orphans_skipped FROM lsbd_raw._sync_runs WHERE status IN ('ok', 'blocked') ORDER BY id DESC LIMIT 1`,
  );
  return o.rows.length === 0 ? "n/a (no completed run)" : `${o.rows[0].orphans_skipped ?? 0} (sync run ${o.rows[0].id})`;
}

async function relationCounts(c: Client): Promise<RelationRow[]> {
  const t = await c.query<{ ok: boolean }>(`SELECT to_regclass('lsbd._transform_quality') IS NOT NULL AS ok`);
  if (!t.rows[0].ok) return [];
  const r = await c.query<{ target: string; relation: string; kind: "skipped" | "unlinked"; source_table: string | null; n: string }>(
    `SELECT target, relation, kind, source_table, n FROM lsbd._transform_quality ORDER BY kind, target, relation`,
  );
  return r.rows.map((x) => ({ target: x.target, relation: x.relation, kind: x.kind, sourceTable: x.source_table ?? "", n: Number(x.n) }));
}

async function ssnRow(c: Client, name: string): Promise<SsnRow> {
  let source = 0;
  for await (const r of query<{ n: unknown }>(
    `SELECT COUNT_BIG(*) AS n FROM dbo.${br(name)} WITH (NOLOCK) WHERE [SSN] IS NOT NULL AND LTRIM(RTRIM([SSN])) <> ''`,
  ))
    source = Number(r.n);
  const rr = await c.query<{ n: string }>(
    `SELECT count(*) AS n FROM lsbd_raw.${qi(name)} WHERE _deleted_at IS NULL AND "SSN" IS NOT NULL`,
  );
  const raw = Number(rr.rows[0].n);
  return { table: name, source, raw, failures: source - raw };
}

/** Section 2. Every item is isolated: a failure becomes that item's error text, nothing else. */
async function dataQuality(
  c: Client,
  schema: SourceTable[],
): Promise<Pick<ReportData, "dupGroups" | "orphans" | "relations" | "ssn">> {
  const dups = await guarded(() => dupGroups(c));
  const o = await guarded(() => orphanSummary(c));
  const relations = await guarded(() => relationCounts(c));
  const ssn: SsnRow[] = [];
  for (const name of SSN_TABLES) {
    if (!schema.some((t) => t.name === name)) continue;
    const r = await guarded(() => ssnRow(c, name));
    ssn.push(isError(r) ? { table: name, source: 0, raw: 0, failures: 0, error: r.error } : r);
  }
  return { dupGroups: dups, orphans: typeof o === "string" ? o : `error: ${o.error}`, relations, ssn };
}

/** lsbd_raw data tables (bookkeeping `_sync_*` and any other `_`-prefixed table excluded) -> live row count. */
async function rawLiveCounts(c: Client): Promise<Map<string, number>> {
  const t = await c.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'lsbd_raw' AND table_type = 'BASE TABLE' AND table_name NOT LIKE '\\_%'`,
  );
  const m = new Map<string, number>();
  for (const r of t.rows) {
    const n = await c.query<{ n: string }>(`SELECT count(*) AS n FROM lsbd_raw.${qi(r.table_name)} WHERE _deleted_at IS NULL`);
    m.set(r.table_name, Number(n.rows[0].n));
  }
  return m;
}

export async function main(): Promise<number> {
  const t0 = Date.now();
  let c: Client | null = null;
  try {
    c = await connect();
    const schema = (await readSchema()).filter((t) => !EXCLUDED_TABLES.has(t.name));
    const rawLive = await rawLiveCounts(c);
    const check = checkSchema(schema.map((t) => t.name), rawLive);
    const counts = schema.length > 0 ? await sourceCounts(schema) : new Map<string, number>();
    const rows: TableRow[] = [];
    for (const t of [...schema].sort((a, b) => a.name.localeCompare(b.name))) {
      const mode = t.pk === null ? "counts" : "keys";
      let row: TableRow;
      try {
        if (check.missingRaw.includes(t.name)) {
          row = { name: t.name, mode, sourceCount: counts.get(t.name) ?? 0, rawCount: 0, pass: false, rechecked: false, note: "missing raw table" };
        } else {
          row = await compareOne(c, t, counts.get(t.name)!);
          if (!row.pass) {
            // Staff may be editing Access; re-read this table once before calling it a FAIL.
            row = { ...(await compareOne(c, t, await sourceCount(t))), rechecked: true };
          }
        }
      } catch (e) {
        row = { name: t.name, mode, sourceCount: counts.get(t.name) ?? 0, rawCount: 0, pass: false, rechecked: false, note: `error: ${redact(errMsg(e))}` };
      }
      console.log(`${row.name.padEnd(26)} ${row.pass ? "PASS" : "FAIL"}${row.rechecked ? " (rechecked)" : ""}`);
      rows.push(row);
    }
    for (const name of check.sourceMissing) {
      rows.push({ name, mode: "counts", sourceCount: 0, rawCount: rawLive.get(name) ?? 0, pass: false, rechecked: false, note: "source table missing" });
      console.log(`${name.padEnd(26)} FAIL (source table missing)`);
    }
    const dq = await dataQuality(c, schema);
    const when = new Date();
    const md = renderReport({ when, durationSec: (Date.now() - t0) / 1000, rows, schemaEmpty: check.empty, ...dq });
    const dir = process.env.LSBD_REPORTS_DIR || path.resolve(__dirname, "..", "..", "reports");
    mkdirSync(dir, { recursive: true });
    const file = path.join(dir, reportFileName(when));
    writeFileSync(file, md, "utf8");
    console.log(`report: ${file}`);
    console.log(summaryLine(rows, check.empty));
    return !check.empty && rows.every((r) => r.pass) ? 0 : 1;
  } finally {
    if (c) await c.end().catch(() => undefined);
    await closeBridge().catch((e) => console.error(`closeBridge: ${redact(errMsg(e))}`));
  }
}

if (require.main === module) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((e) => {
      console.error(`reconcile failed: ${redact(errMsg(e))}`);
      process.exitCode = 1;
    });
}
