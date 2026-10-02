import { Client } from "pg";
import { scriptPgConfig } from "./lib/pg";

async function main() {
  const url = process.env.POSTGRES_URL;
  if (!url) throw new Error("POSTGRES_URL is not set");
  const client = new Client(scriptPgConfig(url));
  await client.connect();

  const col = await client.query(`
    SELECT column_name, data_type, udt_name, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'role'
  `);
  console.log("users.role:", col.rows[0]);

  const enumVals = await client.query(`
    SELECT enumlabel FROM pg_enum
    WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'lsbd_role')
    ORDER BY enumsortorder
  `);
  console.log("lsbd_role values:", enumVals.rows.map((r) => r.enumlabel));

  const rows = await client.query(`SELECT id, email, role FROM users ORDER BY id`);
  console.log("users:", rows.rows);

  await client.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
