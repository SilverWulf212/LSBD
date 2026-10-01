import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { SUPABASE_ROOT_CA_2021 } from "../../src/lib/db/supabase-ca";

// R40: the shared db client and the anon Supabase client must not throw at import (that is
// what broke `next build` page-data collection when an env var was unset). A missing env
// fails on first use instead, with a clear message.

const KEYS = ["POSTGRES_URL", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  vi.resetModules();
});
afterEach(() => {
  vi.unstubAllGlobals();
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("src/lib/db (lazy)", () => {
  it("imports without POSTGRES_URL and throws a clear error on first use", async () => {
    const mod = await import("../../src/lib/db");
    expect(() => mod.db.select).toThrow(/POSTGRES_URL is not set/);
  });

  it("creates one pool on first use, with the pinned CA and ssl params stripped", async () => {
    process.env.POSTGRES_URL = "postgresql://u:p@aws-1-us-west-1.pooler.supabase.com:6543/postgres?sslmode=require";
    const { db } = await import("../../src/lib/db");
    expect(typeof db.select).toBe("function");
    const pool = db.$client;
    expect(db.$client).toBe(pool); // same instance on every access
    const opts = (pool as unknown as { options: { connectionString: string; ssl: unknown } }).options;
    expect(opts.connectionString).toBe("postgresql://u:p@aws-1-us-west-1.pooler.supabase.com:6543/postgres");
    expect(opts.ssl).toEqual({ ca: SUPABASE_ROOT_CA_2021, rejectUnauthorized: true });
    // Builders work through the proxy (methods are bound to the real instance).
    expect(typeof db.select().from).toBe("function");
  });
});

describe("src/lib/supabase-anon (lazy)", () => {
  it("imports without env and throws a clear error on first use", async () => {
    const mod = await import("../../src/lib/supabase-anon");
    expect(() => mod.supabaseAnon.from).toThrow(/NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set/);
  });

  it("creates the client on first use", async () => {
    // supabase-js builds a Realtime client at construction; Node 20 has no global WebSocket.
    if (typeof (globalThis as { WebSocket?: unknown }).WebSocket === "undefined") vi.stubGlobal("WebSocket", class {});
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-test-key";
    const { supabaseAnon } = await import("../../src/lib/supabase-anon");
    expect(typeof supabaseAnon.from).toBe("function");
    expect(typeof supabaseAnon.from("public_licensee").select).toBe("function");
  });
});
