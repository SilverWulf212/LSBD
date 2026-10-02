// scripts/etl-b1a-geography.ts
//
// B-1a: Load geography tables into lsbd schema.
//   countries / states / parishes / cities / election_districts / zipcodes
//
// Pattern: WIPE then INSERT. No natural keys to ON CONFLICT against; first-load
// idempotency comes from TRUNCATE.
//
// Run:
//   $env:POSTGRES_URL = "<session pooler url>"
//   npx tsx scripts/etl-b1a-geography.ts

import * as fs from "node:fs";
import * as readline from "node:readline";
import { Client } from "pg";
import { scriptPgConfig } from "./lib/pg";

const DATA_DIR = process.env.LSBD_DATA_DIR ?? "D:/extracted/data";
const BATCH_SIZE = 500;

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

function strOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length === 0 ? null : s;
}

// For NOT NULL target columns where source allows null. Preserves row count
// without lying about absence — caller still sees an empty string.
function strOrEmpty(v: unknown): string {
  return strOrNull(v) ?? "";
}

function intOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function batchInsert(
  client: Client,
  table: string,
  cols: string[],
  rows: unknown[][]
): Promise<void> {
  if (rows.length === 0) return;
  const colCount = cols.length;
  for (let off = 0; off < rows.length; off += BATCH_SIZE) {
    const batch = rows.slice(off, off + BATCH_SIZE);
    const params: unknown[] = [];
    const placeholders: string[] = [];
    for (const row of batch) {
      const ph: string[] = [];
      for (let c = 0; c < colCount; c++) {
        params.push(row[c]);
        ph.push(`$${params.length}`);
      }
      placeholders.push(`(${ph.join(",")})`);
    }
    await client.query(
      `INSERT INTO ${table} (${cols.join(",")}) VALUES ${placeholders.join(",")}`,
      params
    );
  }
}

async function main() {
  if (!process.env.POSTGRES_URL) {
    console.error("Set POSTGRES_URL.");
    process.exit(1);
  }

  const client = new Client({
    ...scriptPgConfig(process.env.POSTGRES_URL),
    statement_timeout: 300_000,
  });
  await client.connect();
  console.log("Connected.");

  console.log("WIPE: TRUNCATE lsbd.{countries,states,parishes,cities,election_districts,zipcodes} …");
  await client.query(
    "TRUNCATE TABLE lsbd.election_districts, lsbd.zipcodes, lsbd.cities, lsbd.parishes, lsbd.states, lsbd.countries RESTART IDENTITY CASCADE"
  );

  // ── countries ──────────────────────────────────────────────────────────────
  {
    const src = await readJsonl<{ CountryID: string; Country: string }>(
      `${DATA_DIR}/Countries.jsonl`
    );
    const rows = src.map((r) => [strOrNull(r.CountryID), strOrEmpty(r.Country)]);
    await batchInsert(client, "lsbd.countries", ["legacy_uid", "country"], rows);
    console.log(`  countries: ${rows.length} rows`);
  }

  // ── states ─────────────────────────────────────────────────────────────────
  {
    const src = await readJsonl<{ StateID: string; State: string }>(
      `${DATA_DIR}/States.jsonl`
    );
    const rows = src.map((r) => [strOrNull(r.StateID), strOrEmpty(r.State)]);
    await batchInsert(client, "lsbd.states", ["legacy_uid", "state"], rows);
    console.log(`  states: ${rows.length} rows`);
  }

  // ── parishes ───────────────────────────────────────────────────────────────
  {
    const src = await readJsonl<{ ParishID: string; Parish: string }>(
      `${DATA_DIR}/Parishes.jsonl`
    );
    const rows = src.map((r) => [strOrNull(r.ParishID), strOrEmpty(r.Parish)]);
    await batchInsert(client, "lsbd.parishes", ["legacy_uid", "parish"], rows);
    console.log(`  parishes: ${rows.length} rows`);
  }

  // Build parish lookup (legacy_uid -> id) for election_districts FK.
  const parishMap = new Map<string, number>();
  {
    const res = await client.query(
      `SELECT id, legacy_uid::text AS uid FROM lsbd.parishes`
    );
    for (const r of res.rows) {
      if (r.uid) parishMap.set(String(r.uid).toLowerCase(), r.id as number);
    }
  }

  // ── cities ─────────────────────────────────────────────────────────────────
  {
    const src = await readJsonl<{ CityID: string; City: string }>(
      `${DATA_DIR}/Cities.jsonl`
    );
    const rows = src.map((r) => [strOrNull(r.CityID), strOrEmpty(r.City)]);
    await batchInsert(client, "lsbd.cities", ["legacy_uid", "city"], rows);
    console.log(`  cities: ${rows.length} rows`);
  }

  // ── zipcodes ───────────────────────────────────────────────────────────────
  // Source has spaces in column names: "Area Code", "State Code", "Time Zone".
  {
    type Z = {
      City: string | null;
      State: string | null;
      zip: string | null;
      "Area Code": string | null;
      County: string | null;
      "State Code": string | null;
      "Time Zone": string | null;
      Longitude: string | null;
      Latitude: string | null;
    };
    const src = await readJsonl<Z>(`${DATA_DIR}/Zipcodes.jsonl`);
    const rows = src.map((r) => [
      strOrNull(r.City),
      strOrNull(r.State),
      strOrNull(r.zip),
      strOrNull(r["Area Code"]),
      strOrNull(r.County),
      strOrNull(r["State Code"]),
      strOrNull(r["Time Zone"]),
      strOrNull(r.Longitude),
      strOrNull(r.Latitude),
    ]);
    await batchInsert(
      client,
      "lsbd.zipcodes",
      ["city", "state", "zip", "area_code", "county", "state_code", "time_zone", "longitude", "latitude"],
      rows
    );
    console.log(`  zipcodes: ${rows.length} rows`);
  }

  // ── election_districts ─────────────────────────────────────────────────────
  // Resolve parish_id from legacy ParishID uuid via parishMap.
  {
    type E = {
      ElectionDistrictID: string;
      ZipCode: string | null;
      ParishID: string | null;
      District: number | null;
      PARISH: string | null;
    };
    const src = await readJsonl<E>(`${DATA_DIR}/ElectionDistricts.jsonl`);
    let resolved = 0;
    let unresolved = 0;
    const rows = src.map((r) => {
      const parishId = r.ParishID ? parishMap.get(r.ParishID.toLowerCase()) ?? null : null;
      if (r.ParishID) {
        if (parishId != null) resolved++;
        else unresolved++;
      }
      return [
        strOrNull(r.ElectionDistrictID),
        strOrNull(r.ZipCode),
        parishId,
        intOrNull(r.District),
        strOrNull(r.PARISH),
      ];
    });
    await batchInsert(
      client,
      "lsbd.election_districts",
      ["legacy_uid", "zip_code", "parish_id", "district", "parish_name"],
      rows
    );
    console.log(`  election_districts: ${rows.length} rows (parish_id resolved=${resolved} unresolved=${unresolved})`);
  }

  // ── verify counts ──────────────────────────────────────────────────────────
  const counts = await client.query(`
    SELECT 'countries' AS tbl, count(*)::int AS n FROM lsbd.countries
    UNION ALL SELECT 'states', count(*)::int FROM lsbd.states
    UNION ALL SELECT 'parishes', count(*)::int FROM lsbd.parishes
    UNION ALL SELECT 'cities', count(*)::int FROM lsbd.cities
    UNION ALL SELECT 'zipcodes', count(*)::int FROM lsbd.zipcodes
    UNION ALL SELECT 'election_districts', count(*)::int FROM lsbd.election_districts
    ORDER BY tbl
  `);
  console.log("\nFinal row counts:");
  for (const r of counts.rows) console.log(`  ${r.tbl}: ${r.n}`);

  await client.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
