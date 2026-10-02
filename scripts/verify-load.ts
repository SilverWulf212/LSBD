// Quick sanity check on the loaded data.
import { Client } from "pg";
import { scriptPgConfig } from "./lib/pg";

async function main() {
  const url = process.env.POSTGRES_URL;
  if (!url) throw new Error("POSTGRES_URL is not set");
  const client = new Client(scriptPgConfig(url));
  await client.connect();

  const q = async (sql: string) => (await client.query(sql)).rows;

  console.log("\n=== Row counts ===");
  console.table(await q(`
    SELECT 'lsbd.person'  AS tbl, count(*)::int AS n FROM lsbd.person
    UNION ALL SELECT 'lsbd.license', count(*)::int FROM lsbd.license
  `));

  console.log("=== License status breakdown ===");
  console.table(await q(`
    SELECT status, count(*)::int AS n FROM lsbd.license GROUP BY status ORDER BY n DESC NULLS LAST
  `));

  console.log("=== License type breakdown ===");
  console.table(await q(`
    SELECT type, count(*)::int AS n FROM lsbd.license GROUP BY type ORDER BY n DESC NULLS LAST
  `));

  console.log("=== ACT + (D or H) — the public verify pool ===");
  const verifyPool = await q(`
    SELECT count(*)::int AS n
    FROM lsbd.license
    WHERE status = 'ACT' AND type IN ('D','H')
  `);
  console.log(`  ${verifyPool[0].n} active dentists+hygienists`);

  console.log("\n=== Sample verify query: 5 active dentists by last name ===");
  console.table(await q(`
    SELECT l.license_id, l.type, l.status,
           p.first_name, p.last_name,
           l.date_since::date AS issued,
           l.date_until::date AS expires
    FROM lsbd.license l
    JOIN lsbd.person  p ON p.id = l.person_id
    WHERE l.status = 'ACT' AND l.type IN ('D','H')
    ORDER BY p.last_name
    LIMIT 5
  `));

  console.log("=== Same shape filtered by name like 'SMITH%' (legacy /verify behavior) ===");
  console.table(await q(`
    SELECT l.license_id, l.type, l.status, l.action,
           p.first_name, p.last_name,
           l.date_since::date AS issued,
           l.date_until::date AS expires
    FROM lsbd.license l
    JOIN lsbd.person  p ON p.id = l.person_id
    WHERE l.status IN ('ACT','PRB') AND l.type IN ('D','H')
      AND upper(p.last_name) LIKE 'SMITH%'
    ORDER BY p.last_name, p.first_name
    LIMIT 10
  `));

  await client.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
