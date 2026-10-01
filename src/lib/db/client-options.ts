import type { PoolConfig } from "pg";
import { SUPABASE_ROOT_CA_2021 } from "./supabase-ca";

/** Full TLS verification against the pinned Supabase root CA (certificate checks always on). */
export const PINNED_SSL = { ca: SUPABASE_ROOT_CA_2021, rejectUnauthorized: true } as const;

// Connection-string parameters that node-postgres (pg-connection-string) turns into its own
// `ssl` value. The parsed URL is merged OVER the explicit config, so any of these would
// silently replace the pinned-CA ssl object (sslmode=require -> ssl = {} -> the pooler's
// private root fails "self-signed certificate in certificate chain").
const TLS_PARAMS = new Set(["ssl", "sslmode", "sslrootcert", "sslcert", "sslkey", "sslpassword", "uselibpqcompat"]);

/** Removes TLS-related query parameters from a postgres connection string; keeps the rest. */
export function stripSslParams(connectionString: string): string {
  const q = connectionString.indexOf("?");
  if (q < 0) return connectionString;
  const params = new URLSearchParams(connectionString.slice(q + 1));
  for (const k of [...params.keys()]) {
    if (TLS_PARAMS.has(k.toLowerCase())) params.delete(k);
  }
  const rest = params.toString();
  return rest ? `${connectionString.slice(0, q)}?${rest}` : connectionString.slice(0, q);
}

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
// Supabase root CA; ssl* params in the URL are stripped so they cannot override it.
export function dbPoolConfig(connectionString: string): PoolConfig {
  return {
    connectionString: stripSslParams(connectionString),
    max: 1,
    ssl: { ...PINNED_SSL },
  };
}
