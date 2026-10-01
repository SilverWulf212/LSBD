// scripts/apply-sql.ts
//
// Applies one hand-written SQL file to Supabase. Replaces scripts/apply-migration.ts
// for new migrations: TLS is verified against the pinned CA (scripts/lib/pg.ts), the
// whole file runs in ONE transaction and the first error rolls everything back, and
// the lsbd_sync advisory lock is held for the apply so DDL never races a sync run.
//
// Run: npx tsx scripts/apply-sql.ts drizzle/0005_public_cms_lockdown.sql

import * as fs from "node:fs";
import * as path from "node:path";
import type { Client } from "pg";
import { loadSecrets } from "./lib/secrets";
import { connectPg } from "./lib/pg";

// A file that opens or ends a transaction itself would escape the one this runner
// wraps it in: an early COMMIT makes the rest of the file non-atomic. The BEGIN of a
// PL/pgSQL block is not matched, because it is never followed by `;`.
const TRANSACTION_CONTROL =
  /^[ \t]*((?:BEGIN|START[ \t]+TRANSACTION|COMMIT|ROLLBACK)(?:[ \t]+(?:TRANSACTION|WORK))?[ \t]*;)/im;

/** The first statement-level transaction-control statement in `sql`, or null. */
export function findTransactionControl(sql: string): string | null {
  const m = TRANSACTION_CONTROL.exec(sql);
  return m ? m[1] : null;
}

// pg's message alone often does not say where in a long file the error is.
function pgDetail(e: unknown): string {
  const { code, position, where } = e as { code?: string; position?: string; where?: string };
  const parts = [
    code ? `code ${code}` : "",
    position ? `position ${position}` : "",
    where ? `where: ${where}` : "",
  ].filter(Boolean);
  return parts.length ? ` (${parts.join("; ")})` : "";
}

export async function applySqlFile(c: Client, file: string): Promise<void> {
  const sql = fs.readFileSync(file, "utf8");
  await c.query("BEGIN");
  try {
    await c.query(sql);
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK").catch(() => undefined);
    throw new Error(`${path.basename(file)}: ${(e as Error).message}${pgDetail(e)}`);
  }
}

async function main(): Promise<void> {
  const file = process.argv[2];
  if (!file || !fs.existsSync(file)) throw new Error("usage: apply-sql.ts <file.sql>");
  const control = findTransactionControl(fs.readFileSync(file, "utf8"));
  if (control) {
    throw new Error(`${path.basename(file)} contains "${control}"; the runner wraps the file in one transaction, remove it`);
  }
  const url = loadSecrets()["SUPABASE_DB_URL_SESSION"];
  if (!url) throw new Error("SUPABASE_DB_URL_SESSION missing from secrets");
  const c = await connectPg(url, { applicationName: "lsbd-apply-sql" });
  try {
    // Same key and wait rules as scripts/sync/apply-transforms.ts.
    console.log("waiting for the lsbd_sync advisory lock ...");
    await c.query("SET lock_timeout = 0");
    await c.query("SELECT pg_advisory_lock(hashtext('lsbd_sync'))");
    await c.query("SET lock_timeout = '60s'");
    const started = Date.now();
    await applySqlFile(c, file);
    console.log(`${path.basename(file)} applied in ${Date.now() - started}ms`);
  } finally {
    await c.query("SELECT pg_advisory_unlock(hashtext('lsbd_sync'))").catch(() => undefined);
    await c.end();
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error(`apply-sql failed: ${(e as Error).message}`);
    process.exitCode = 1;
  });
}
