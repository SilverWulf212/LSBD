import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import type { AttemptStore } from "@/lib/login-limiter";

/** Postgres-backed sign-in attempt log (public.login_attempts, see drizzle/0008). */
export const pgAttemptStore: AttemptStore = {
  async countSince(key, since) {
    const res = await db.execute(
      sql`SELECT count(*)::int AS n FROM public.login_attempts WHERE key = ${key} AND attempted_at >= ${since.toISOString()}::timestamptz`
    );
    return Number((res.rows[0] as { n: number } | undefined)?.n ?? 0);
  },
  async record(key) {
    await db.execute(sql`INSERT INTO public.login_attempts (key) VALUES (${key})`);
    await db.execute(
      sql`DELETE FROM public.login_attempts WHERE attempted_at < now() - interval '24 hours'`
    );
  },
  async clear(key) {
    await db.execute(sql`DELETE FROM public.login_attempts WHERE key = ${key}`);
  },
};
