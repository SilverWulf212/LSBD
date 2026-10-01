import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { Client } from "pg";
import { loadSecrets } from "../../scripts/lib/secrets";
import { connectPg } from "../../scripts/lib/pg";

// Live test of drizzle/0005, 0006 and 0007 against the real Supabase project.
// The three files run inside ONE transaction that is always rolled back, so
// nothing persists (CREATE ROLE is transactional too). The lsbd_sync advisory
// lock is held for the whole test so the DDL never races a sync run.
// Run with:  $env:LSBD_IT='1'; npx vitest run tests/it/grants.test.ts --no-file-parallelism

const FILES = [
  "drizzle/0005_public_cms_lockdown.sql",
  "drizzle/0006_db_roles.sql",
  "drizzle/0007_public_view_owner_rights.sql",
];

const DENIED = { code: "42501" }; // insufficient_privilege (table or schema)
const T = 120_000;

describe.skipIf(process.env.LSBD_IT !== "1")("database roles and grants (live, rolled back)", () => {
  let c: Client;
  let locked = false;

  beforeAll(async () => {
    const url = loadSecrets()["SUPABASE_DB_URL_SESSION"];
    if (!url) throw new Error("SUPABASE_DB_URL_SESSION missing");
    c = await connectPg(url, { applicationName: "lsbd-it" });
    // Same key and wait rules as scripts/apply-sql.ts.
    await c.query("SET lock_timeout = 0");
    await c.query("SELECT pg_advisory_lock(hashtext('lsbd_sync'))");
    locked = true;
    await c.query("SET lock_timeout = '60s'");
    await c.query("BEGIN");
    for (const file of FILES) await c.query(readFileSync(file, "utf8"));
  }, 600_000);

  afterAll(async () => {
    if (!c) return;
    await c.query("ROLLBACK").catch(() => undefined);
    if (locked) await c.query("SELECT pg_advisory_unlock(hashtext('lsbd_sync'))").catch(() => undefined);
    await c.end();
  });

  // Runs fn as `role`. The savepoint puts the session role back (and keeps the
  // outer transaction usable) whatever fn does.
  async function asRole(role: "lsbd_staff_ro" | "lsbd_app" | "anon", fn: () => Promise<void>): Promise<void> {
    await c.query("SAVEPOINT as_role");
    try {
      await c.query(`SET LOCAL ROLE ${role}`);
      await fn();
    } finally {
      await c.query("ROLLBACK TO SAVEPOINT as_role");
    }
  }

  async function expectDenied(sql: string): Promise<void> {
    await c.query("SAVEPOINT denied");
    try {
      await expect(c.query(sql), sql).rejects.toMatchObject(DENIED);
    } finally {
      await c.query("ROLLBACK TO SAVEPOINT denied");
    }
  }

  async function count(sql: string): Promise<number> {
    const r = await c.query<{ n: number }>(sql);
    return r.rows[0].n;
  }

  it("lsbd_staff_ro reads licensing data, never PII, CMS tables or writes", async () => {
    await asRole("lsbd_staff_ro", async () => {
      expect(await count("SELECT count(*)::int AS n FROM lsbd.license")).toBeGreaterThanOrEqual(19000);
      await expectDenied("SELECT 1 FROM lsbd.licensee_pii");
      // lsbd.individual: column grant without ssn, dob, sex, race.
      expect(await count("SELECT count(indv_id)::int AS n FROM lsbd.individual")).toBeGreaterThanOrEqual(1);
      await expectDenied("SELECT ssn FROM lsbd.individual");
      await expectDenied("SELECT dob FROM lsbd.individual");
      await expectDenied("UPDATE lsbd.person SET first_name = first_name WHERE false");
      await expectDenied("SELECT 1 FROM public.users");
    });
  }, T);

  it("lsbd_app reads the public view, CMS tables and sync status; cannot delete audit rows or read lsbd", async () => {
    await asRole("lsbd_app", async () => {
      expect(await count("SELECT count(*)::int AS n FROM public.public_licensee")).toBeGreaterThanOrEqual(13000);
      const cols = await c.query("SELECT * FROM public.public_licensee LIMIT 0");
      expect(cols.fields.map((f) => f.name)).toContain("legacy_key");
      expect(await count("SELECT count(*)::int AS n FROM public.users")).toBeGreaterThanOrEqual(1);
      expect(await count("SELECT count(*)::int AS n FROM lsbd_raw._sync_runs")).toBeGreaterThanOrEqual(1);
      await expectDenied("DELETE FROM public.audit_log WHERE false");
      await expectDenied("SELECT 1 FROM lsbd.license");
    });
  }, T);

  it("anon is denied on CMS tables, the public view and lsbd", async () => {
    await asRole("anon", async () => {
      await expectDenied("SELECT 1 FROM public.users");
      await expectDenied("SELECT 1 FROM public.public_licensee");
      await expectDenied("SELECT 1 FROM lsbd.license");
    });
  }, T);

  it("every table in lsbd and public has row level security on", async () => {
    const r = await c.query<{ t: string }>(
      `SELECT n.nspname || '.' || c.relname AS t
         FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname IN ('lsbd', 'public') AND c.relkind IN ('r', 'p') AND NOT c.relrowsecurity
        ORDER BY 1`,
    );
    expect(r.rows.map((x) => x.t)).toEqual([]);
  }, T);
});
