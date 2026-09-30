// scripts/sync/reconcile.ts
//
// Reconcile report: proves lsbd_raw is an exact mirror of LSBDDB, table by table, and writes
// reports/reconcile-<yyyyMMdd-HHmm>.md (local time).
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
import { Client } from "pg";
import { loadSecrets } from "../lib/secrets";
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
}

export interface ReportData {
  when: Date;
  durationSec: number;
  rows: TableRow[];
  dupGroups: DupGroup[];
  orphans: string;
  ssn: SsnRow[];
}

const p2 = (n: number): string => String(n).padStart(2, "0");

export function reportFileName(d: Date): string {
  return `reconcile-${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}-${p2(d.getHours())}${p2(d.getMinutes())}.md`;
}

const stamp = (d: Date): string =>
  `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`;

export function summaryLine(rows: TableRow[]): string {
  const fails = rows.filter((r) => !r.pass).length;
  return fails === 0 ? `PASS ${rows.length}/${rows.length}` : `FAIL ${fails} tables`;
}

/** Table cells never hold user text: names are table names, everything else is a number. */
const cell = (s: string): string => s.replace(/\|/g, "/");

export function renderReport(r: ReportData): string {
  const out: string[] = [];
  out.push(`# LSBD reconcile report`, ``);
  out.push(`Generated ${stamp(r.when)} (local time), ${r.durationSec.toFixed(1)} s. Result: **${summaryLine(r.rows)}**.`, ``);
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
  out.push(`${r.dupGroups.length} (Type, LICENSEID) groups have more than one live row.`, ``);
  if (r.dupGroups.length > 0) {
    out.push(`| Type | LICENSEID | Rows |`, `| --- | --- | ---: |`);
    for (const g of r.dupGroups) out.push(`| ${cell(g.type)} | ${cell(g.licenseId)} | ${g.n} |`);
    out.push(``);
  }
  out.push(`### Orphans skipped by the latest transform run`, ``, `${r.orphans}`, ``);
  out.push(`### SSN normalisation failures`, ``);
  out.push(`Rows with a non-empty source SSN minus raw rows with a non-null SSN. Counts only.`, ``);
  out.push(`| Table | Source non-empty SSN | Raw non-null SSN | Failures |`, `| --- | ---: | ---: | ---: |`);
  for (const s of r.ssn) out.push(`| ${cell(s.table)} | ${s.source} | ${s.raw} | ${s.failures} |`);
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
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false }, application_name: "lsbd-reconcile" });
  c.on("error", (e) => console.error(`pg client error: ${redact(e.message)}`));
  await c.connect();
  return c;
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

async function tableExists(c: Client, name: string): Promise<boolean> {
  const r = await c.query<{ ok: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'lsbd_raw' AND table_name = $1) AS ok`,
    [name],
  );
  return r.rows[0].ok;
}

async function dataQuality(c: Client, schema: SourceTable[]): Promise<Pick<ReportData, "dupGroups" | "orphans" | "ssn">> {
  const dup = await c.query<{ type: string; lic: string; n: string }>(
    `SELECT "Type" AS type, "LICENSEID" AS lic, count(*) AS n FROM lsbd_raw."tblDenHyg"
      WHERE _deleted_at IS NULL GROUP BY "Type", "LICENSEID" HAVING count(*) > 1 ORDER BY "Type", "LICENSEID"`,
  );
  const dupGroups = dup.rows.map((r) => ({ type: String(r.type), licenseId: String(r.lic), n: Number(r.n) }));

  const proc = await c.query<{ ok: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                     WHERE n.nspname = 'lsbd' AND p.proname = 'run_transforms') AS ok`,
  );
  let orphans = "n/a (transforms not installed)";
  if (proc.rows[0].ok) {
    const o = await c.query<{ id: string; orphans_skipped: number | null }>(
      `SELECT id, orphans_skipped FROM lsbd_raw._sync_runs WHERE status IN ('ok', 'blocked') ORDER BY id DESC LIMIT 1`,
    );
    orphans = o.rows.length === 0 ? "n/a (no completed run)" : `${o.rows[0].orphans_skipped ?? 0} (sync run ${o.rows[0].id})`;
  }

  const ssn: SsnRow[] = [];
  for (const name of SSN_TABLES) {
    if (!schema.some((t) => t.name === name)) continue;
    let source = 0;
    for await (const r of query<{ n: unknown }>(
      `SELECT COUNT_BIG(*) AS n FROM dbo.${br(name)} WITH (NOLOCK) WHERE [SSN] IS NOT NULL AND LTRIM(RTRIM([SSN])) <> ''`,
    ))
      source = Number(r.n);
    const rr = await c.query<{ n: string }>(
      `SELECT count(*) AS n FROM lsbd_raw.${qi(name)} WHERE _deleted_at IS NULL AND "SSN" IS NOT NULL`,
    );
    const raw = Number(rr.rows[0].n);
    ssn.push({ table: name, source, raw, failures: source - raw });
  }
  return { dupGroups, orphans, ssn };
}

export async function main(): Promise<number> {
  const t0 = Date.now();
  let c: Client | null = null;
  try {
    c = await connect();
    const schema = (await readSchema()).filter((t) => !EXCLUDED_TABLES.has(t.name));
    const counts = await sourceCounts(schema);
    const rows: TableRow[] = [];
    for (const t of [...schema].sort((a, b) => a.name.localeCompare(b.name))) {
      const mode = t.pk === null ? "counts" : "keys";
      let row: TableRow;
      try {
        if (!(await tableExists(c, t.name))) {
          row = { name: t.name, mode, sourceCount: counts.get(t.name) ?? 0, rawCount: 0, pass: false, rechecked: false, note: "missing from lsbd_raw" };
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
    const dq = await dataQuality(c, schema);
    const when = new Date();
    const md = renderReport({ when, durationSec: (Date.now() - t0) / 1000, rows, ...dq });
    const dir = path.resolve(__dirname, "..", "..", "reports");
    mkdirSync(dir, { recursive: true });
    const file = path.join(dir, reportFileName(when));
    writeFileSync(file, md, "utf8");
    console.log(`report: ${file}`);
    console.log(summaryLine(rows));
    return rows.every((r) => r.pass) ? 0 : 1;
  } finally {
    if (c) await c.end().catch(() => undefined);
    await closeBridge().catch((e) => console.error(`closeBridge: ${errMsg(e)}`));
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
