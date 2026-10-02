import { describe, it, expect } from "vitest";
import { dbPoolConfig } from "../../src/lib/db/client-options";
import { SUPABASE_ROOT_CA_2021 } from "../../src/lib/db/supabase-ca";

const TXN = "postgresql://u:p@aws-1-us-west-1.pooler.supabase.com:6543/postgres";

describe("dbPoolConfig", () => {
  // The app uses node-postgres, not postgres.js: through Supavisor's
  // transaction pooler (6543), postgres.js hangs forever once a warm
  // connection receives concurrent queries (reproduced 2026-09-30; next build
  // timed out prerendering /admin/*). node-postgres queues per connection and
  // passed the same 11-process concurrent probe.
  it("uses one pooled connection per instance with full TLS verification", () => {
    expect(dbPoolConfig(TXN)).toEqual({
      connectionString: TXN,
      max: 1,
      connectionTimeoutMillis: 10_000,
      ssl: { ca: SUPABASE_ROOT_CA_2021, rejectUnauthorized: true },
    });
  });

  it("pins the Supabase root CA", () => {
    expect(SUPABASE_ROOT_CA_2021).toMatch(/^-----BEGIN CERTIFICATE-----\n/);
    expect(SUPABASE_ROOT_CA_2021.trim()).toMatch(/-----END CERTIFICATE-----$/);
  });
});

describe("dbPoolConfig strips TLS query params so the pinned CA always applies (R40)", () => {
  // node-postgres merges the parsed connection string OVER the explicit config, and any
  // sslmode replaces ssl with {} -> the pinned CA would be silently discarded.
  const PINNED = { ca: SUPABASE_ROOT_CA_2021, rejectUnauthorized: true };

  it("removes sslmode=require (the usual Supabase / Vercel-integration suffix)", () => {
    const cfg = dbPoolConfig(`${TXN}?sslmode=require`);
    expect(cfg.connectionString).toBe(TXN);
    expect(cfg.ssl).toEqual(PINNED);
  });

  it("removes every ssl* parameter but keeps the others", () => {
    const cfg = dbPoolConfig(
      `${TXN}?sslmode=verify-full&ssl=true&sslrootcert=system&sslcert=a.crt&sslkey=a.key&uselibpqcompat=true&application_name=lsbd&options=-c%20search_path%3Dlsbd`,
    );
    const u = new URL(cfg.connectionString!);
    expect([...u.searchParams.keys()].sort()).toEqual(["application_name", "options"]);
    expect(u.searchParams.get("options")).toBe("-c search_path=lsbd");
    expect(cfg.ssl).toEqual(PINNED);
  });

  it("is case-insensitive on parameter names and leaves a param-free URL untouched", () => {
    expect(dbPoolConfig(`${TXN}?SSLMODE=disable`).connectionString).toBe(TXN);
    expect(dbPoolConfig(TXN).connectionString).toBe(TXN);
  });

  it("node-postgres ends up with the pinned CA even when the URL said sslmode=require", async () => {
    const { default: ConnectionParameters } = await import("pg/lib/connection-parameters");
    const p = new ConnectionParameters(dbPoolConfig(`${TXN}?sslmode=require`));
    expect(p.ssl).toEqual(PINNED);
  });
});
