// scripts/seed-admin.ts
//
// Seed an admin user in public.users for first login. Idempotent — if the
// email already exists, the row is updated with the new password and role.
//
// Run:
//   $env:POSTGRES_URL = "<session pooler url>"
//   $env:ADMIN_EMAIL = "you@example.com"
//   $env:ADMIN_PASSWORD = "long-strong-passphrase"
//   $env:ADMIN_NAME = "Your Name"
//   npx tsx scripts/seed-admin.ts

import { hash } from "bcryptjs";
import { Client } from "pg";

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME ?? "Administrator";

  if (!email || !password) {
    console.error("Set ADMIN_EMAIL and ADMIN_PASSWORD env vars.");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("ADMIN_PASSWORD must be at least 8 characters.");
    process.exit(1);
  }
  if (!process.env.POSTGRES_URL) {
    console.error("Set POSTGRES_URL.");
    process.exit(1);
  }

  const passwordHash = await hash(password, 10);

  const client = new Client({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const result = await client.query(
    `INSERT INTO users (email, password_hash, name, role)
     VALUES ($1, $2, $3, 'admin')
     ON CONFLICT (email) DO UPDATE
       SET password_hash = EXCLUDED.password_hash,
           name = EXCLUDED.name,
           role = 'admin',
           updated_at = now()
     RETURNING id, email, role`,
    [email, passwordHash, name]
  );

  console.log("Seeded admin:", result.rows[0]);

  await client.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
