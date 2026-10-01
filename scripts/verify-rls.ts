// scripts/verify-rls.ts
//
// Post-apply check for drizzle/0005, 0006 and 0007. Exits 1 if any check fails.
// Prints counts and pass/fail only, never keys or row values.
//
//   npx tsx scripts/verify-rls.ts --stage=0005   after 0005_public_cms_lockdown.sql
//   npx tsx scripts/verify-rls.ts --stage=0006   after 0006_db_roles.sql
//   npx tsx scripts/verify-rls.ts --stage=0007   after 0007_public_view_owner_rights.sql (default)
//
// Stages are cumulative: --stage=0006 also runs the 0005 checks.
//
// Two paths are checked:
//   - the anon key over REST (@supabase/supabase-js), the surface anyone on the
//     internet has; reads NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY from .env.local;
//   - SUPABASE_DB_URL_SESSION + SET ROLE, the same role assertions as
//     tests/it/grants.test.ts, inside one BEGIN ... ROLLBACK.

import * as fs from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import type { Client } from "pg";
import { loadSecrets } from "./lib/secrets";
import { connectPg } from "./lib/pg";
import {
  STAFF_RO_TABLES,
  STAFF_RO_INDIVIDUAL_DENIED_COLUMNS,
  TABLE_SELECTABLE_SQL,
  ANY_COLUMN_SELECTABLE_SQL,
  INDIVIDUAL_SELECTABLE_COLUMNS_SQL,
  diffSets,
} from "./lib/staff-ro-tables";
import { anonRestOutcome } from "./lib/anon-rest-outcome";

const STAGES = ["0005", "0006", "0007"] as const;
type Stage = (typeof STAGES)[number];
type Role = "lsbd_staff_ro" | "lsbd_app" | "anon" | "authenticated";

const DENIED = "42501"; // insufficient_privilege (table or schema)

let failed = 0;

function report(ok: boolean, name: string, detail: string): void {
  if (!ok) failed++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name} - ${detail}`);
}

function loadDotEnv(file: string): void {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && process.env[m[1]] == null) {
      process.env[m[1]] = m[2].replace(/^"|"$/g, "");
    }
  }
}

function parseStage(argv: string[]): Stage {
  const arg = argv.find((a) => a.startsWith("--stage="));
  if (!arg) return "0007";
  const v = arg.slice("--stage=".length);
  if (!(STAGES as readonly string[]).includes(v)) throw new Error("usage: verify-rls.ts [--stage=0005|0006|0007]");
  return v as Stage;
}

// anon over REST. PASS only on a real permission-denied answer from the database,
// or on a successful answer with zero rows. Anything else (network failure, wrong
// URL, stale key, 5xx) is a FAIL: it proves nothing. limit(0) returns no rows but,
// unlike a HEAD request, does return the error body.
// expectHidden: anon has no privilege at all on the relation, so PostgREST answers
// "relation not found" instead of permission denied (lib/anon-rest-outcome.ts).
async function anonRestDenied(anon: SupabaseClient, table: string, expectHidden = false): Promise<void> {
  const name = `anon REST: public.${table}`;
  const r = await anon.from(table).select("*", { count: "exact" }).limit(0);
  const ok = anonRestOutcome(expectHidden, r.error, r.count) === "pass";
  if (r.error) {
    const what = r.error.code === DENIED ? "permission denied" : `not visible to anon (${r.error.code})`;
    return report(ok, name, ok ? what : `unchecked: error ${r.error.code || "(no code)"}, HTTP ${r.status}`);
  }
  report(ok, name, ok ? "0 rows" : `${r.count ?? "unknown"} row(s) visible`);
}

async function inSavepoint(c: Client, name: string, fn: () => Promise<void>): Promise<void> {
  await c.query(`SAVEPOINT ${name}`);
  try {
    await fn();
  } finally {
    await c.query(`ROLLBACK TO SAVEPOINT ${name}`);
  }
}

// Runs the checks as `role`; the savepoint puts the session role back afterwards.
async function asRole(c: Client, role: Role, fn: () => Promise<void>): Promise<void> {
  try {
    await inSavepoint(c, "as_role", async () => {
      await c.query(`SET LOCAL ROLE ${role}`);
      await fn();
    });
  } catch (e) {
    report(false, `SET ROLE ${role}`, pgErr(e));
  }
}

function pgErr(e: unknown): string {
  const code = (e as { code?: string }).code;
  return code ? `error ${code}` : "error";
}

async function expectDenied(c: Client, role: Role, sql: string): Promise<void> {
  const name = `${role}: ${sql}`;
  await inSavepoint(c, "denied", async () => {
    try {
      await c.query(sql);
      report(false, name, "allowed, expected permission denied");
    } catch (e) {
      const code = (e as { code?: string }).code;
      report(code === DENIED, name, code === DENIED ? "permission denied" : `${pgErr(e)}, expected permission denied`);
    }
  });
}

async function expectCount(c: Client, role: Role, relation: string, min: number): Promise<void> {
  const name = `${role}: count(*) FROM ${relation} >= ${min}`;
  await inSavepoint(c, "counted", async () => {
    try {
      const r = await c.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${relation}`);
      report(r.rows[0].n >= min, name, `${r.rows[0].n} rows`);
    } catch (e) {
      report(false, name, pgErr(e));
    }
  });
}

async function rlsEnabled(c: Client, schemas: string[]): Promise<void> {
  const r = await c.query<{ t: string }>(
    `SELECT n.nspname || '.' || c.relname AS t
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = ANY($1::text[]) AND c.relkind IN ('r', 'p') AND NOT c.relrowsecurity
      ORDER BY 1`,
    [schemas],
  );
  const off = r.rows.map((x) => x.t);
  report(off.length === 0, `row level security on every table in ${schemas.join(", ")}`,
    off.length === 0 ? "0 tables without it" : `off on: ${off.join(", ")}`);
}

// A catalog query whose result must be exactly `expected` (table or column names).
async function expectNames(c: Client, name: string, sql: string, params: unknown[], expected: readonly string[]): Promise<void> {
  await inSavepoint(c, "names", async () => {
    try {
      const r = await c.query<{ t: string }>(sql, params);
      const { extra, missing } = diffSets(r.rows.map((x) => x.t), expected);
      const ok = extra.length === 0 && missing.length === 0;
      const detail = ok
        ? `${expected.length} as expected`
        : [extra.length ? `extra: ${extra.join(", ")}` : "", missing.length ? `missing: ${missing.join(", ")}` : ""]
            .filter(Boolean).join("; ");
      report(ok, name, detail);
    } catch (e) {
      report(false, name, pgErr(e));
    }
  });
}

async function main(): Promise<void> {
  const stage = parseStage(process.argv.slice(2));
  const at = (s: Stage): boolean => STAGES.indexOf(stage) >= STAGES.indexOf(s);
  loadDotEnv(".env.local");

  const restUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!restUrl || !anonKey) throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set");
  const dbUrl = loadSecrets()["SUPABASE_DB_URL_SESSION"];
  if (!dbUrl) throw new Error("SUPABASE_DB_URL_SESSION missing from secrets");

  console.log(`verify-rls: checks for stage ${stage}`);

  console.log("\nanon key over REST");
  const anon = createClient(restUrl, anonKey, {
    realtime: { transport: WebSocket as unknown as typeof globalThis.WebSocket },
  });
  for (const t of ["users", "audit_log", "posts"]) await anonRestDenied(anon, t);
  if (at("0007")) await anonRestDenied(anon, "public_licensee", true);

  console.log("\ndatabase roles (SET ROLE, rolled back)");
  const c = await connectPg(dbUrl, { applicationName: "lsbd-verify-rls" });
  try {
    await c.query("BEGIN");
    await rlsEnabled(c, ["lsbd", "public"]);

    for (const role of ["anon", "authenticated"] as const) {
      await asRole(c, role, async () => {
        await expectDenied(c, role, "SELECT 1 FROM public.users");
        if (at("0007")) {
          await expectDenied(c, role, "SELECT 1 FROM public.public_licensee");
          await expectDenied(c, role, "SELECT 1 FROM lsbd.license");
        }
      });
      if (at("0007")) {
        await expectNames(c, `catalog: lsbd relations selectable by ${role}`, ANY_COLUMN_SELECTABLE_SQL, [role], []);
      }
    }

    if (at("0006")) {
      await expectNames(c, "catalog: lsbd relations with a SELECT grant to lsbd_staff_ro",
        TABLE_SELECTABLE_SQL, ["lsbd_staff_ro"], STAFF_RO_TABLES);
      await expectNames(c, "catalog: PII columns of lsbd.individual selectable by lsbd_staff_ro",
        INDIVIDUAL_SELECTABLE_COLUMNS_SQL, ["lsbd_staff_ro", [...STAFF_RO_INDIVIDUAL_DENIED_COLUMNS]], []);

      await asRole(c, "lsbd_staff_ro", async () => {
        await expectCount(c, "lsbd_staff_ro", "lsbd.license", 19000);
        await expectCount(c, "lsbd_staff_ro", "lsbd.individual", 1);
        for (const col of STAFF_RO_INDIVIDUAL_DENIED_COLUMNS) {
          await expectDenied(c, "lsbd_staff_ro", `SELECT ${col} FROM lsbd.individual`);
        }
        await expectDenied(c, "lsbd_staff_ro", "SELECT 1 FROM lsbd.licensee_pii");
        await expectDenied(c, "lsbd_staff_ro", "UPDATE lsbd.person SET first_name = first_name WHERE false");
        await expectDenied(c, "lsbd_staff_ro", "SELECT 1 FROM public.users");
      });

      await asRole(c, "lsbd_app", async () => {
        await expectCount(c, "lsbd_app", "public.users", 1);
        await expectCount(c, "lsbd_app", "lsbd_raw._sync_runs", 1);
        await expectDenied(c, "lsbd_app", "DELETE FROM public.audit_log WHERE false");
        await expectDenied(c, "lsbd_app", "SELECT 1 FROM lsbd.license");
        // Until 0007 the view runs with the caller's rights, and lsbd_app has none on lsbd.
        if (at("0007")) {
          await expectCount(c, "lsbd_app", "public.public_licensee", 13000);
          const name = "lsbd_app: public.public_licensee has column legacy_key";
          await inSavepoint(c, "cols", async () => {
            try {
              const r = await c.query("SELECT * FROM public.public_licensee LIMIT 0");
              const has = r.fields.some((f) => f.name === "legacy_key");
              report(has, name, `${r.fields.length} columns`);
            } catch (e) {
              report(false, name, pgErr(e));
            }
          });
        }
      });
    }
  } finally {
    await c.query("ROLLBACK").catch(() => undefined);
    await c.end();
  }

  console.log(failed === 0 ? `\nAll checks passed for stage ${stage}.` : `\n${failed} check(s) FAILED for stage ${stage}.`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(`verify-rls failed: ${(e as Error).message}`);
  process.exitCode = 1;
});
