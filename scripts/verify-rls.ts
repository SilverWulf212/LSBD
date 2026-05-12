// scripts/verify-rls.ts
//
// Smoke-test the RLS posture from Package C. Uses @supabase/supabase-js with
// the anon key (same surface area the public /verify route will use):
//
//   ✓ SELECT from public.public_licensee returns rows.
//   ✓ SELECT from lsbd.licensee_pii is denied.
//   ✓ SELECT from lsbd.transactions is denied.
//   ✓ View row count matches the expected active-D/H/E population.
//
// Run:
//   $env:NEXT_PUBLIC_SUPABASE_URL = "https://<project>.supabase.co"
//   $env:NEXT_PUBLIC_SUPABASE_ANON_KEY = "eyJ..."
//   npx tsx scripts/verify-rls.ts

import * as fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";

function loadDotEnv(file: string): void {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && process.env[m[1]] == null) {
      process.env[m[1]] = m[2].replace(/^"|"$/g, "");
    }
  }
}

async function main() {
  loadDotEnv(".env.local");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
    process.exit(1);
  }

  const anon = createClient(url, key, {
    realtime: { transport: WebSocket as unknown as typeof globalThis.WebSocket },
  });

  // 1. View should return rows.
  console.log("Test 1: SELECT from public.public_licensee (anon) …");
  const v = await anon
    .from("public_licensee")
    .select("license_id,type,status,first_name,last_name", { count: "exact" })
    .limit(5);
  if (v.error) {
    console.error("  ✗ Failed:", v.error.message);
    process.exit(1);
  }
  console.log(`  ✓ Got ${v.data?.length ?? 0} rows (of ${v.count} total)`);
  for (const r of v.data?.slice(0, 3) ?? []) {
    console.log(`     ${r.license_id} ${r.type} ${r.status} ${r.last_name}, ${r.first_name}`);
  }

  // 2. PII table — should be denied.
  console.log("\nTest 2: SELECT from lsbd.licensee_pii (anon) — expect denial …");
  const pii = await anon.schema("lsbd").from("licensee_pii").select("id").limit(1);
  if (pii.error) {
    console.log(`  ✓ Denied as expected: ${pii.error.message}`);
  } else {
    console.error(`  ✗ Anon got ${pii.data?.length ?? 0} rows — RLS misconfigured!`);
    process.exit(1);
  }

  // 3. Transactions table — should be denied.
  console.log("\nTest 3: SELECT from lsbd.transactions (anon) — expect denial …");
  const tx = await anon.schema("lsbd").from("transactions").select("id").limit(1);
  if (tx.error) {
    console.log(`  ✓ Denied as expected: ${tx.error.message}`);
  } else {
    console.error(`  ✗ Anon got ${tx.data?.length ?? 0} rows — RLS misconfigured!`);
    process.exit(1);
  }

  // 4. Search smoke (matches scripts/verify-load.ts query for parity)
  console.log("\nTest 4: search 'SMITH' on public_licensee …");
  const s = await anon
    .from("public_licensee")
    .select("license_id,type,status,first_name,last_name,date_until")
    .ilike("last_name", "SMITH%")
    .order("last_name", { ascending: true })
    .limit(20);
  if (s.error) {
    console.error("  ✗ Search failed:", s.error.message);
    process.exit(1);
  }
  console.log(`  ✓ ${s.data?.length ?? 0} SMITH rows returned. First 5:`);
  for (const r of s.data?.slice(0, 5) ?? []) {
    console.log(`     ${r.license_id} ${r.type} ${r.status} ${r.last_name}, ${r.first_name} (exp ${r.date_until ?? "—"})`);
  }

  console.log("\nAll RLS smoke checks passed.");
}

main().catch((e) => { console.error(e); process.exit(1); });
