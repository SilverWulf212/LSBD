import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import { dbPoolConfig } from "./client-options";

const connectionString = process.env.POSTGRES_URL;
if (!connectionString) {
  throw new Error("POSTGRES_URL is not set");
}

const pool = new Pool(dbPoolConfig(connectionString));

export const db = drizzle(pool, { schema });
