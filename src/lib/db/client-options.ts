import type { PoolConfig } from "pg";
import { SUPABASE_ROOT_CA_2021 } from "./supabase-ca";

// node-postgres pool config for the app's shared client.
//
// Why node-postgres and not postgres.js: through Supabase's transaction
// pooler (Supavisor, port 6543), postgres.js hangs forever once a warm
// connection receives concurrent queries — `next build` timed out
// prerendering /admin/* (2026-09-30). node-postgres queues queries per
// connection and uses unnamed statements, which transaction mode supports.
//
// `max: 1` is safe for serverless and for `next build` (which spawns several
// workers, each with its own pool). TLS is fully verified against the pinned
// Supabase root CA.
export function dbPoolConfig(connectionString: string): PoolConfig {
  return {
    connectionString,
    max: 1,
    ssl: { ca: SUPABASE_ROOT_CA_2021, rejectUnauthorized: true },
  };
}
