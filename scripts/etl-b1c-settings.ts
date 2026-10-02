// scripts/etl-b1c-settings.ts
//
// B-1c: Collapse legacy single-row "settings bag" tables.
//
// The deployed Drizzle schema already split this work into 3 dedicated tables
// rather than one app_settings catch-all (plana.md was pre-schema design):
//
//   - tblFees (43 cols × 1 row)      → lsbd.fee (fee_code, amount)  — 42 rows
//   - tblNumbers (16 cols × 1 row)   → lsbd.app_settings keys       — 15 rows
//   - tblDates (3 cols × 1 row)      → lsbd.app_settings keys       — 2 rows
//   - Control (1 col × 1 row)        → lsbd.app_settings keys       — 1 row
//   - RenewalSettings (10 cols × 4 rows) → lsbd.renewal_settings    — 4 rows
//
// Run:
//   $env:POSTGRES_URL = "<session pooler url>"
//   npx tsx scripts/etl-b1c-settings.ts

import * as fs from "node:fs";
import * as readline from "node:readline";
import { Client } from "pg";
import { scriptPgConfig } from "./lib/pg";

const DATA_DIR = process.env.LSBD_DATA_DIR ?? "D:/extracted/data";

async function readJsonl<T = Record<string, unknown>>(file: string): Promise<T[]> {
  const rl = readline.createInterface({
    input: fs.createReadStream(file),
    crlfDelay: Infinity,
  });
  const rows: T[] = [];
  for await (const line of rl) {
    if (!line.trim()) continue;
    rows.push(JSON.parse(line) as T);
  }
  return rows;
}

function decOrNull(v: unknown): string | null {
  if (v == null || v === "") return null;
  return String(v);
}

function tsOrNull(v: unknown): string | null {
  if (v == null || v === "") return null;
  return String(v);
}

async function bulkInsert(
  client: Client,
  table: string,
  cols: string[],
  rows: unknown[][]
): Promise<void> {
  if (rows.length === 0) return;
  const params: unknown[] = [];
  const placeholders: string[] = [];
  for (const row of rows) {
    const ph: string[] = [];
    for (const v of row) {
      params.push(v);
      ph.push(`$${params.length}`);
    }
    placeholders.push(`(${ph.join(",")})`);
  }
  await client.query(
    `INSERT INTO ${table} (${cols.join(",")}) VALUES ${placeholders.join(",")}`,
    params
  );
}

async function main() {
  if (!process.env.POSTGRES_URL) {
    console.error("Set POSTGRES_URL.");
    process.exit(1);
  }

  const client = new Client({
    ...scriptPgConfig(process.env.POSTGRES_URL),
    statement_timeout: 120_000,
  });
  await client.connect();
  console.log("Connected.");

  console.log("WIPE: TRUNCATE lsbd.{fee,app_settings,renewal_settings} …");
  await client.query(
    "TRUNCATE TABLE lsbd.fee, lsbd.app_settings, lsbd.renewal_settings RESTART IDENTITY CASCADE"
  );

  // ── lsbd.fee  ←  tblFees ───────────────────────────────────────────────────
  // Source is a 1-row × 43-col table. Each column except `ID` becomes one row
  // in lsbd.fee with (fee_code = column name, amount = the money value).
  {
    const src = await readJsonl<Record<string, unknown>>(`${DATA_DIR}/tblFees.jsonl`);
    if (src.length !== 1) {
      console.warn(`  tblFees has ${src.length} rows (expected 1); using first.`);
    }
    const row = src[0] ?? {};
    const rows: unknown[][] = [];
    for (const [k, v] of Object.entries(row)) {
      if (k === "ID") continue;
      rows.push([k, decOrNull(v)]);
    }
    await bulkInsert(client, "lsbd.fee", ["fee_code", "amount"], rows);
    console.log(`  fee: ${rows.length} rows (from tblFees columns)`);
  }

  // ── lsbd.app_settings  ←  tblNumbers + tblDates + Control ──────────────────
  {
    const settings: unknown[][] = [];

    // tblNumbers (counters used by legacy Access for next-ID generation)
    {
      const src = await readJsonl<Record<string, unknown>>(`${DATA_DIR}/tblNumbers.jsonl`);
      const row = src[0] ?? {};
      for (const [k, v] of Object.entries(row)) {
        if (k === "ID") continue;
        settings.push([
          `counter.${k}`,
          v == null ? null : String(v),
          "Legacy next-ID counter from MSSQL tblNumbers",
        ]);
      }
    }

    // tblDates
    {
      const src = await readJsonl<Record<string, unknown>>(`${DATA_DIR}/tblDates.jsonl`);
      const row = src[0] ?? {};
      for (const [k, v] of Object.entries(row)) {
        if (k === "ID") continue;
        settings.push([
          `date.${k}`,
          tsOrNull(v),
          "Legacy single-value date from MSSQL tblDates",
        ]);
      }
    }

    // Control
    {
      const src = await readJsonl<Record<string, unknown>>(`${DATA_DIR}/Control.jsonl`);
      const row = src[0] ?? {};
      for (const [k, v] of Object.entries(row)) {
        // Control has no ID column; emit all keys verbatim.
        settings.push([
          `control.${k}`,
          v == null ? null : String(v),
          "Legacy single-value setting from MSSQL Control",
        ]);
      }
    }

    await bulkInsert(client, "lsbd.app_settings", ["key", "value", "notes"], settings);
    console.log(`  app_settings: ${settings.length} rows (counters + dates + control)`);
  }

  // ── lsbd.renewal_settings  ←  RenewalSettings ──────────────────────────────
  {
    type R = {
      LicenseType: string;
      ExpirationDate: string;
      RenewalDate: string;
      Fee: number;
      WellBeingFee: number;
      LateFee: number;
      StartDate: string;
      LateDate: string;
      EndDate: string;
    };
    const src = await readJsonl<R>(`${DATA_DIR}/RenewalSettings.jsonl`);
    const rows = src.map((r) => [
      r.LicenseType,
      tsOrNull(r.ExpirationDate),
      tsOrNull(r.RenewalDate),
      decOrNull(r.Fee),
      decOrNull(r.WellBeingFee),
      decOrNull(r.LateFee),
      tsOrNull(r.StartDate),
      tsOrNull(r.LateDate),
      tsOrNull(r.EndDate),
    ]);
    await bulkInsert(
      client,
      "lsbd.renewal_settings",
      ["license_type", "expiration_date", "renewal_date", "fee", "well_being_fee", "late_fee", "start_date", "late_date", "end_date"],
      rows
    );
    console.log(`  renewal_settings: ${rows.length} rows`);
  }

  // ── verify ─────────────────────────────────────────────────────────────────
  const counts = await client.query(`
    SELECT 'fee' AS tbl, count(*)::int AS n FROM lsbd.fee
    UNION ALL SELECT 'app_settings', count(*)::int FROM lsbd.app_settings
    UNION ALL SELECT 'renewal_settings', count(*)::int FROM lsbd.renewal_settings
    ORDER BY tbl
  `);
  console.log("\nFinal row counts:");
  for (const r of counts.rows) console.log(`  ${r.tbl}: ${r.n}`);

  await client.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
