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
      ssl: { ca: SUPABASE_ROOT_CA_2021, rejectUnauthorized: true },
    });
  });

  it("pins the Supabase root CA", () => {
    expect(SUPABASE_ROOT_CA_2021).toMatch(/^-----BEGIN CERTIFICATE-----\n/);
    expect(SUPABASE_ROOT_CA_2021.trim()).toMatch(/-----END CERTIFICATE-----$/);
  });
});
