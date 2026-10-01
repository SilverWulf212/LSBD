import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { scriptPgConfig, sessionSetupSql, connectPg, SYNC_TIMEOUTS } from "../../scripts/lib/pg";
import { SUPABASE_ROOT_CA_2021 } from "../../src/lib/db/supabase-ca";

// R39 (review I4): every sync / ops script connects with full TLS verification against the
// pinned Supabase root CA, through one shared helper. R37 (review I2): every sync connection
// carries a statement_timeout, a lock_timeout and an idle-in-transaction timeout.

const URL_SESSION = "postgresql://postgres.ref:pw@aws-1-us-west-1.pooler.supabase.com:5432/postgres";
const PINNED = { ca: SUPABASE_ROOT_CA_2021, rejectUnauthorized: true };

describe("scriptPgConfig", () => {
  it("verifies TLS against the pinned CA and strips ssl* URL params", () => {
    const cfg = scriptPgConfig(`${URL_SESSION}?sslmode=require`, "lsbd-sync");
    expect(cfg.ssl).toEqual(PINNED);
    expect(cfg.connectionString).toBe(URL_SESSION);
    expect(cfg.application_name).toBe("lsbd-sync");
  });
});

describe("sessionSetupSql", () => {
  it("sets application_name and all three timeouts", () => {
    expect(sessionSetupSql("lsbd-sync", SYNC_TIMEOUTS)).toEqual([
      "SET application_name = 'lsbd-sync'",
      "SET statement_timeout = '10min'",
      "SET lock_timeout = '60s'",
      "SET idle_in_transaction_session_timeout = '10min'",
    ]);
  });
  it("refuses values that are not plain names / durations", () => {
    expect(() => sessionSetupSql("x'; DROP TABLE t; --", SYNC_TIMEOUTS)).toThrow();
    expect(() => sessionSetupSql("ok", { ...SYNC_TIMEOUTS, lockTimeout: "1s'; x" })).toThrow();
  });
});

describe("connectPg", () => {
  it("connects with the pinned config, then applies the session settings in order", async () => {
    const calls: string[] = [];
    let seen: Record<string, unknown> | null = null;
    const fake = {
      on: () => fake,
      connect: async () => {
        calls.push("connect");
      },
      query: async (sql: string) => {
        calls.push(sql);
        return { rows: [] };
      },
      end: async () => undefined,
    };
    const c = await connectPg(`${URL_SESSION}?sslmode=disable`, { applicationName: "lsbd-reconcile" }, (cfg) => {
      seen = cfg as Record<string, unknown>;
      return fake as never;
    });
    expect(c).toBe(fake);
    expect(seen!.ssl).toEqual(PINNED);
    expect(seen!.connectionString).toBe(URL_SESSION);
    expect(calls).toEqual(["connect", ...sessionSetupSql("lsbd-reconcile", SYNC_TIMEOUTS)]);
  });

  it("closes the client when a session setting fails", async () => {
    let ended = false;
    const fake = {
      on: () => fake,
      connect: async () => undefined,
      query: async () => {
        throw new Error("nope");
      },
      end: async () => {
        ended = true;
      },
    };
    await expect(connectPg(URL_SESSION, { applicationName: "x" }, () => fake as never)).rejects.toThrow("nope");
    expect(ended).toBe(true);
  });
});

describe("no unverified TLS in sync / ops / app code", () => {
  const ROOT = path.resolve(__dirname, "../..");
  const DIRS = ["scripts/sync", "scripts/ops", "scripts/lib", "tests/it", "src"];
  function files(dir: string): string[] {
    const out: string[] = [];
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) out.push(...files(p));
      else if (/\.(ts|tsx|mts)$/.test(e.name)) out.push(p);
    }
    return out;
  }
  it("never sets rejectUnauthorized: false", () => {
    const bad = DIRS.flatMap((d) => files(path.join(ROOT, d))).filter((f) =>
      /rejectUnauthorized\s*:\s*false/.test(fs.readFileSync(f, "utf8")),
    );
    expect(bad.map((f) => path.relative(ROOT, f))).toEqual([]);
  });
});
