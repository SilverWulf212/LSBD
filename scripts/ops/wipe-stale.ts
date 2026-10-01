// scripts/ops/wipe-stale.ts
//
// One-shot wipe of every base table in schema `lsbd` (stale 2026-05-12 load,
// including cardholder data in vs_auth / vs_capture). Never touches schema
// `public` (live CMS content) and issues no DDL.
//
// Without --yes: print exact per-table counts and exit 1.
// With --yes:    TRUNCATE all lsbd base tables in ONE statement inside a
//                transaction (RESTART IDENTITY CASCADE), then re-count and
//                confirm every table is 0.
//
// Abort (exit 1, no truncate) if any FK outside `lsbd` references a table in
// `lsbd`, since CASCADE would silently empty it.
//
// Run: npx tsx scripts/ops/wipe-stale.ts [--yes]

import type { Client } from "pg";
import { loadSecrets } from "../lib/secrets";
import { connectPg } from "../lib/pg";

function qi(ident: string): string {
  return '"' + ident.replace(/"/g, '""') + '"';
}

async function countAll(client: Client, tables: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  for (const t of tables) {
    const r = await client.query(`SELECT count(*)::bigint AS n FROM lsbd.${qi(t)}`);
    counts.set(t, Number(r.rows[0].n));
  }
  return counts;
}

function printCounts(counts: Map<string, number>): number {
  let total = 0;
  for (const [t, n] of counts) {
    console.log(`${t}: ${n}`);
    total += n;
  }
  console.log(`-- ${counts.size} tables, ${total} rows total`);
  return total;
}

async function main(): Promise<void> {
  const yes = process.argv.includes("--yes");
  const url = loadSecrets()["SUPABASE_DB_URL_SESSION"];
  if (!url) {
    console.error("SUPABASE_DB_URL_SESSION not found in secrets file");
    process.exit(1);
  }

  const client = await connectPg(url, { applicationName: "lsbd-wipe-stale" });
  try {
    const tr = await client.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'lsbd' AND table_type = 'BASE TABLE'
       ORDER BY table_name`,
    );
    const tables: string[] = tr.rows.map((r) => r.table_name);
    if (tables.length === 0) {
      console.error("no base tables found in schema lsbd; nothing to do");
      process.exit(1);
    }

    // R6: FKs from outside lsbd into lsbd would be emptied by CASCADE.
    const fk = await client.query(
      `SELECT c.conname,
              cn.nspname || '.' || cc.relname AS referencing_table,
              fn.nspname || '.' || fc.relname AS referenced_table
       FROM pg_constraint c
       JOIN pg_class cc ON cc.oid = c.conrelid
       JOIN pg_namespace cn ON cn.oid = cc.relnamespace
       JOIN pg_class fc ON fc.oid = c.confrelid
       JOIN pg_namespace fn ON fn.oid = fc.relnamespace
       WHERE c.contype = 'f' AND cn.nspname <> 'lsbd' AND fn.nspname = 'lsbd'`,
    );
    if (fk.rows.length > 0) {
      console.error("ABORT: foreign keys from outside schema lsbd reference lsbd tables:");
      for (const r of fk.rows) {
        console.error(`  ${r.conname}: ${r.referencing_table} -> ${r.referenced_table}`);
      }
      console.error("Nothing was truncated.");
      process.exit(1);
    }

    console.log("== before ==");
    const before = await countAll(client, tables);
    printCounts(before);

    if (!yes) {
      console.error("dry run: re-run with --yes to truncate all lsbd tables");
      process.exit(1);
    }

    const list = tables.map((t) => `lsbd.${qi(t)}`).join(", ");
    await client.query("BEGIN");
    try {
      await client.query(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    }
    console.log(`wiped ${tables.length} tables`);

    console.log("== after ==");
    const after = await countAll(client, tables);
    const total = printCounts(after);
    const nonZero = [...after].filter(([, n]) => n !== 0);
    if (total !== 0 || nonZero.length > 0) {
      console.error(`ERROR: ${nonZero.length} tables not empty after wipe`);
      process.exit(1);
    }
    console.log("verified: every lsbd table is 0");
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
