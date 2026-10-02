// scripts/verify-legacy-keys.ts
//
// Task 10 verification. Reads the KEY MAP from the header of
// drizzle/0003_legacy_keys.sql (the contract Task 11 builds on) and checks the
// live Supabase `lsbd` schema against it:
//   1. The map lists exactly the base tables that exist in `lsbd` (86).
//   2. For every table, a PRIMARY KEY or UNIQUE constraint exists whose column
//      set is exactly the documented key, and every key column is NOT NULL.
//   3. No UNIQUE/PK constraint and no unique index remains on
//      license(license_id) alone.
//   4. license_type_license_id_idx exists, is NOT unique, and covers
//      (type, license_id).
// Prints "<ok>/<total>" and exits 1 on any failure. Read-only. Never prints secrets.
//
// Run:
//   npx tsx scripts/verify-legacy-keys.ts

import * as fs from "node:fs";
import * as path from "node:path";
import { Client } from "pg";
import { loadSecrets } from "./lib/secrets";
import { scriptPgConfig } from "./lib/pg";

const MIGRATION = path.resolve(__dirname, "../drizzle/0003_legacy_keys.sql");

type KeyRow = { table: string; source: string; sourcePk: string; key: string[] };

export function parseKeyMap(sql: string): KeyRow[] {
  const lines = sql.split(/\r?\n/);
  const begin = lines.findIndex((l) => l.trim() === "-- BEGIN KEY MAP");
  const end = lines.findIndex((l) => l.trim() === "-- END KEY MAP");
  if (begin < 0 || end < begin) throw new Error("KEY MAP markers not found");
  return lines.slice(begin + 1, end).map((l) => {
    const cells = l.replace(/^--/, "").split("|").map((c) => c.trim());
    if (cells.length < 4 || !cells[0] || !cells[3]) throw new Error(`bad KEY MAP row: ${l}`);
    return {
      table: cells[0],
      source: cells[1],
      sourcePk: cells[2],
      key: cells[3].split(",").map((c) => c.trim()).sort(),
    };
  });
}

const sameSet = (a: string[], b: string[]) =>
  a.length === b.length && [...a].sort().every((v, i) => v === [...b].sort()[i]);

async function main() {
  const map = parseKeyMap(fs.readFileSync(MIGRATION, "utf8"));
  const dup = map.map((r) => r.table).filter((t, i, a) => a.indexOf(t) !== i);
  if (dup.length) throw new Error(`duplicate tables in KEY MAP: ${dup.join(", ")}`);

  const url = process.env.POSTGRES_URL ?? loadSecrets()["SUPABASE_DB_URL_SESSION"];
  if (!url) throw new Error("SUPABASE_DB_URL_SESSION not found in secrets file");
  const client = new Client(scriptPgConfig(url));
  await client.connect();

  try {
    const tables = (
      await client.query<{ t: string }>(
        `SELECT tablename AS t FROM pg_tables WHERE schemaname = 'lsbd' ORDER BY 1`,
      )
    ).rows.map((r) => r.t);

    // PK + UNIQUE constraints with their column sets.
    const cons = (
      await client.query<{ t: string; name: string; kind: string; cols: string[] }>(`
        SELECT tc.table_name AS t, tc.constraint_name AS name, tc.constraint_type AS kind,
               array_agg(kcu.column_name::text ORDER BY kcu.ordinal_position) AS cols
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON kcu.constraint_schema = tc.constraint_schema
         AND kcu.constraint_name = tc.constraint_name
         AND kcu.table_name = tc.table_name
        WHERE tc.table_schema = 'lsbd' AND tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE')
        GROUP BY tc.table_name, tc.constraint_name, tc.constraint_type`)
    ).rows;

    const notNull = new Set(
      (
        await client.query<{ k: string }>(`
          SELECT table_name || '.' || column_name AS k FROM information_schema.columns
          WHERE table_schema = 'lsbd' AND is_nullable = 'NO'`)
      ).rows.map((r) => r.k),
    );

    // Every index on license, with uniqueness and column list.
    const licenseIdx = (
      await client.query<{ name: string; uniq: boolean; cols: string[] }>(`
        SELECT i.relname AS name, ix.indisunique AS uniq,
               array_agg(a.attname::text ORDER BY k.ord) AS cols
        FROM pg_index ix
        JOIN pg_class c ON c.oid = ix.indrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_class i ON i.oid = ix.indexrelid
        JOIN unnest(ix.indkey) WITH ORDINALITY k(attnum, ord) ON true
        JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = k.attnum
        WHERE n.nspname = 'lsbd' AND c.relname = 'license'
        GROUP BY i.relname, ix.indisunique`)
    ).rows;

    const failures: string[] = [];
    const mapped = new Set(map.map((r) => r.table));
    for (const t of tables) if (!mapped.has(t)) failures.push(`${t}: exists in lsbd but missing from KEY MAP`);
    for (const t of mapped) if (!tables.includes(t)) failures.push(`${t}: in KEY MAP but not a table in lsbd`);

    let ok = 0;
    for (const row of map) {
      if (!tables.includes(row.table)) continue;
      const hit = cons.find((c) => c.t === row.table && sameSet(c.cols, row.key));
      const nullable = row.key.filter((c) => !notNull.has(`${row.table}.${c}`));
      if (!hit) {
        failures.push(`${row.table}: no PK/UNIQUE constraint on (${row.key.join(", ")})`);
      } else if (nullable.length) {
        failures.push(`${row.table}: key column(s) nullable: ${nullable.join(", ")}`);
      } else {
        ok++;
        console.log(
          `  ok  ${row.table.padEnd(25)} (${row.key.join(", ")})`.padEnd(66) +
            ` ${hit.kind === "PRIMARY KEY" ? "PK    " : "UNIQUE"} ${hit.name}`,
        );
      }
    }

    // license_id alone must not be unique, by constraint or by index.
    const badCons = cons.filter((c) => c.t === "license" && sameSet(c.cols, ["license_id"]));
    const badIdx = licenseIdx.filter((i) => i.uniq && sameSet(i.cols, ["license_id"]));
    for (const c of badCons) failures.push(`license: unique constraint on (license_id) alone remains: ${c.name}`);
    for (const i of badIdx) failures.push(`license: unique index on (license_id) alone remains: ${i.name}`);
    const typeIdx = licenseIdx.find((i) => i.name === "license_type_license_id_idx");
    if (!typeIdx) failures.push("license: license_type_license_id_idx missing");
    else if (typeIdx.uniq) failures.push("license: license_type_license_id_idx must be NON-unique");
    else if (typeIdx.cols.join(",") !== "type,license_id")
      failures.push(`license: license_type_license_id_idx covers (${typeIdx.cols.join(", ")}), expected (type, license_id)`);

    console.log("");
    console.log(`license(license_id) alone: unique constraints=${badCons.length}, unique indexes=${badIdx.length}`);
    console.log(
      `license_type_license_id_idx: ${typeIdx ? `${typeIdx.uniq ? "UNIQUE" : "non-unique"} (${typeIdx.cols.join(", ")})` : "MISSING"}`,
    );
    console.log(`lsbd tables: ${tables.length}; KEY MAP rows: ${map.length}`);
    console.log(`${ok}/${map.length}`);

    if (failures.length) {
      console.log("\nFAILURES:");
      for (const f of failures) console.log(`  - ${f}`);
      process.exitCode = 1;
    }
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  });
}
