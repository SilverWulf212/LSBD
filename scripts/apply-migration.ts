// scripts/apply-migration.ts
//
// Apply a single Drizzle migration file to Postgres, splitting on the
// `--> statement-breakpoint` sentinel and running each statement
// continue-on-error. Idempotent for our common shapes
// (CREATE TYPE / ADD COLUMN — both fail loudly if not idempotent yet).
//
// Usage:
//   $env:POSTGRES_URL = "<session pooler url>"
//   npx tsx scripts/apply-migration.ts drizzle/0001_user_roles.sql

import * as fs from "node:fs";
import * as path from "node:path";
import { Client } from "pg";
import { scriptPgConfig } from "./lib/pg";

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: tsx scripts/apply-migration.ts <path-to.sql>");
    process.exit(1);
  }
  if (!process.env.POSTGRES_URL) {
    console.error("Set POSTGRES_URL to the Supabase session pooler URL.");
    process.exit(1);
  }

  const sql = fs.readFileSync(path.resolve(file), "utf8");
  const statements = sql
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const client = new Client({
    ...scriptPgConfig(process.env.POSTGRES_URL),
    statement_timeout: 120_000,
  });
  await client.connect();
  console.log(`Connected. Applying ${statements.length} statements from ${file}…`);

  let applied = 0;
  const failures: { i: number; snippet: string; error: string }[] = [];
  for (let i = 0; i < statements.length; i++) {
    const s = statements[i];
    try {
      await client.query(s);
      applied++;
    } catch (e) {
      failures.push({
        i: i + 1,
        snippet: s.slice(0, 140).replace(/\s+/g, " "),
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  console.log(`Done. ${applied}/${statements.length} succeeded; ${failures.length} failed.`);
  for (const f of failures) {
    console.log(`  [${f.i}] ${f.snippet}`);
    console.log(`     ↳ ${f.error}`);
  }

  await client.end();
  process.exit(failures.length > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
