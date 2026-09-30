// scripts/sync/bootstrap-raw.ts
//
// Creates the lsbd_raw mirror schema in Supabase from the live MSSQL schema.
// Idempotent (CREATE ... IF NOT EXISTS). Writes the DDL to supabase/lsbd_raw.sql
// (schema only, no data) and applies it over the session pooler in one transaction.
// Only ever touches schema lsbd_raw.
//
// Run: npm run sync:bootstrap

import * as fs from "node:fs";
import * as path from "node:path";
import { Client } from "pg";
import { loadSecrets } from "../lib/secrets";
import { readSchema, closeBridge } from "./mssql";
import { EXCLUDED_TABLES, policyFor } from "./policy";
import { bookkeepingDdl, rawTableDdl } from "./raw-ddl";
import type { SourceTable } from "./types";

export const OUT_FILE = path.resolve(__dirname, "../../supabase/lsbd_raw.sql");

/**
 * Splits SQL into statements on `;` that are outside single-quoted strings and
 * double-quoted identifiers (both with doubled-quote escapes). Statements are
 * returned trimmed, without the trailing `;`; empty ones are dropped.
 */
export function splitStatements(sql: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quote: "'" | '"' | null = null;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (quote) {
      cur += ch;
      if (ch === quote) {
        if (sql[i + 1] === quote) cur += sql[++i]; // doubled quote = escaped
        else quote = null;
      }
    } else if (ch === "'" || ch === '"') {
      quote = ch;
      cur += ch;
    } else if (ch === ";") {
      if (cur.trim()) out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  if (quote) throw new Error("splitStatements: unterminated quote");
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** Bookkeeping first (it creates the schema), then one block per data table, sorted by name. */
export function buildBootstrapSql(tables: SourceTable[]): { sql: string; tableCount: number } {
  const used = tables
    .filter((t) => !EXCLUDED_TABLES.has(t.name))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const parts = [bookkeepingDdl(), ...used.map((t) => rawTableDdl(t, policyFor(t.name)))];
  return { sql: parts.join("\n\n") + "\n", tableCount: used.length };
}

const ALLOWED = /^(CREATE SCHEMA IF NOT EXISTS lsbd_raw\b|CREATE TABLE IF NOT EXISTS lsbd_raw\.|REVOKE ALL ON lsbd_raw\.|ALTER TABLE lsbd_raw\.)/;

async function main(): Promise<void> {
  const url = loadSecrets()["SUPABASE_DB_URL_SESSION"];
  if (!url) throw new Error("SUPABASE_DB_URL_SESSION not found in secrets file");

  let tables: SourceTable[];
  try {
    tables = await readSchema();
  } finally {
    await closeBridge();
  }

  const { sql, tableCount } = buildBootstrapSql(tables);
  const statements = splitStatements(sql);
  for (const s of statements) {
    if (!ALLOWED.test(s)) throw new Error(`refusing statement outside lsbd_raw: ${s.slice(0, 80)}`);
  }

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, sql, "utf8");

  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query("BEGIN");
    try {
      for (const s of statements) await client.query(s);
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    }
  } finally {
    await client.end();
  }
  console.log(`${tableCount} tables created`);
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  });
}
