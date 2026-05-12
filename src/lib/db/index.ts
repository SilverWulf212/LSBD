import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.POSTGRES_URL;
if (!connectionString) {
  throw new Error("POSTGRES_URL is not set");
}

// Supabase transaction pooler (port 6543) does not support prepared statements.
// Auto-detect; override with POSTGRES_PREPARE=true|false if needed.
const isTransactionPooler = /:6543\b/.test(connectionString);
const prepare = process.env.POSTGRES_PREPARE
  ? process.env.POSTGRES_PREPARE === "true"
  : !isTransactionPooler;

// Pool sizing — keep small. Each Next.js build worker / serverless invocation
// creates its own client, and the Supabase session pooler caps concurrent
// clients. `max: 1` is safe for serverless and for `next build` (which spawns
// ~11 workers).
const client = postgres(connectionString, { prepare, max: 1 });

export const db = drizzle(client, { schema });
