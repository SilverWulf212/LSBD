// scripts/sync/apply-transforms.ts
//
// Installs the transform layer (spec section 4.2): applies supabase/transforms/*.sql
// in filename order, each file in its own transaction (BEGIN ... COMMIT; a failing
// file rolls back and stops the run). The files are CREATE OR REPLACE / IF NOT
// EXISTS, so re-applying is safe. Only touches schema lsbd (views, functions,
// the registry); it never runs a transform itself.
//
// Run: npm run sync:transforms:apply

import * as fs from "node:fs";
import * as path from "node:path";
import { Client } from "pg";
import { loadSecrets } from "../lib/secrets";

export const TRANSFORMS_DIR = path.resolve(__dirname, "../../supabase/transforms");

export function transformFiles(dir: string = TRANSFORMS_DIR): string[] {
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => path.join(dir, f));
}

export async function applyTransforms(c: Client, files: string[] = transformFiles()): Promise<void> {
  for (const file of files) {
    const sql = fs.readFileSync(file, "utf8");
    const started = Date.now();
    await c.query("BEGIN");
    try {
      await c.query(sql);
      await c.query("COMMIT");
    } catch (e) {
      await c.query("ROLLBACK").catch(() => undefined);
      throw new Error(`${path.basename(file)}: ${(e as Error).message}`);
    }
    console.log(`${path.basename(file).padEnd(22)} applied in ${Date.now() - started}ms`);
  }
}

async function main(): Promise<void> {
  const url = loadSecrets()["SUPABASE_DB_URL_SESSION"];
  if (!url) throw new Error("SUPABASE_DB_URL_SESSION missing from secrets");
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  c.on("error", () => undefined);
  await c.connect();
  try {
    await applyTransforms(c);
    const reg = await c.query<{ domain: string; sort_order: number; n: number }>(
      `SELECT domain, sort_order, cardinality(source_tables) AS n FROM lsbd._transform_registry ORDER BY sort_order`,
    );
    for (const r of reg.rows) console.log(`registered ${r.domain.padEnd(12)} order ${r.sort_order} (${r.n} source tables)`);
  } finally {
    await c.end();
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error(`apply-transforms failed: ${(e as Error).message}`);
    process.exitCode = 1;
  });
}
