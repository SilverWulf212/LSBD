// scripts/snapshot-lsbd.ts
//
// Snapshot every non-empty table in the `lsbd` schema to a single JSONL file
// per table. Serves as our pre-B-2 checkpoint (since pg_dump isn't installed
// on this host). Output goes to D:/extracted/checkpoints/<label>/.
//
// Run:
//   $env:POSTGRES_URL = "<session pooler url>"
//   npx tsx scripts/snapshot-lsbd.ts after-B-1

import * as fs from "node:fs";
import * as path from "node:path";
import { Client } from "pg";

async function main() {
  const label = process.argv[2];
  if (!label) {
    console.error("Usage: tsx scripts/snapshot-lsbd.ts <label>");
    console.error("Example: tsx scripts/snapshot-lsbd.ts after-B-1");
    process.exit(1);
  }
  if (!process.env.POSTGRES_URL) {
    console.error("Set POSTGRES_URL.");
    process.exit(1);
  }

  const root = process.env.LSBD_CHECKPOINT_DIR ?? "D:/extracted/checkpoints";
  const outDir = path.join(root, label);
  fs.mkdirSync(outDir, { recursive: true });

  const client = new Client({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false },
    statement_timeout: 600_000,
  });
  await client.connect();

  const tables = await client.query<{ table_name: string }>(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'lsbd' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);

  console.log(`Snapshotting ${tables.rows.length} tables → ${outDir}`);

  const manifest: { table: string; rows: number; bytes: number }[] = [];
  for (const { table_name: t } of tables.rows) {
    const res = await client.query(`SELECT * FROM lsbd.${t}`);
    const file = path.join(outDir, `${t}.jsonl`);
    const sw = fs.createWriteStream(file);
    let bytes = 0;
    for (const r of res.rows) {
      const line = JSON.stringify(r) + "\n";
      sw.write(line);
      bytes += line.length;
    }
    await new Promise<void>((resolve, reject) => {
      sw.end((err?: Error | null) => (err ? reject(err) : resolve()));
    });
    manifest.push({ table: t, rows: res.rows.length, bytes });
    if (res.rows.length > 0) {
      console.log(`  ${t}: ${res.rows.length} rows (${(bytes / 1024).toFixed(1)} KiB)`);
    }
  }

  fs.writeFileSync(
    path.join(outDir, "_manifest.json"),
    JSON.stringify({ label, takenAt: new Date().toISOString(), tables: manifest }, null, 2)
  );

  const populated = manifest.filter((m) => m.rows > 0).length;
  const empty = manifest.length - populated;
  const totalRows = manifest.reduce((a, b) => a + b.rows, 0);
  const totalBytes = manifest.reduce((a, b) => a + b.bytes, 0);
  console.log(
    `\nDone. ${populated} populated tables, ${empty} empty. ` +
      `${totalRows} rows total, ${(totalBytes / 1024 / 1024).toFixed(2)} MiB.`
  );

  await client.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
