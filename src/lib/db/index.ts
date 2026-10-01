import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import { dbPoolConfig } from "./client-options";

function createDb() {
  const connectionString = process.env.POSTGRES_URL;
  if (!connectionString) {
    throw new Error("POSTGRES_URL is not set");
  }
  return drizzle(new Pool(dbPoolConfig(connectionString)), { schema });
}

type Db = ReturnType<typeof createDb>;

let instance: Db | null = null;

function getDb(): Db {
  if (!instance) instance = createDb();
  return instance;
}

// Lazy: nothing is created (and nothing throws) at import time, so `next build` can
// collect page data without POSTGRES_URL. The pool is created on first use; a missing
// env var then fails that request with "POSTGRES_URL is not set". Methods are bound to
// the real instance, so call sites (`db.select()...`, `db.transaction(...)`) are unchanged.
export const db: Db = new Proxy({} as Db, {
  get(_target, prop) {
    const real = getDb();
    const value = Reflect.get(real, prop, real);
    return typeof value === "function" ? value.bind(real) : value;
  },
  has(_target, prop) {
    return Reflect.has(getDb(), prop);
  },
});
