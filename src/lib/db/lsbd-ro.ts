// Read-only access to the `lsbd` schema for the staff screens.
//
// D2: this is the ONLY way staff pages and loaders touch `lsbd.*`. Never use
//     db.select, db.execute, db.$client or the Drizzle relational API for it.
// D3: the app pool has ONE connection (max: 1). Inside a withStaffRo callback never
//     call auth(), requireCapability(), db.* or a nested withStaffRo: each would wait
//     forever for the connection the callback is holding. Check the capability first,
//     then open the transaction.
//
// Read-only is enforced by the database: SET LOCAL ROLE lsbd_staff_ro inside a
// transaction on the existing pool. SET LOCAL ends with the transaction, so the
// connection is the normal role again when it goes back to the pool.
// A query the callback starts and never awaits is still drained before COMMIT/ROLLBACK,
// and its rejection is the callback's to handle. Queries are single statements only.
import { db } from "./index";

export const STAFF_RO_ROLE = "lsbd_staff_ro";
// The role's own statement_timeout is a login-time setting and does not apply under
// SET LOCAL ROLE, so the timeouts are set transaction-locally (set_config(..., true)).
export const STAFF_STATEMENT_TIMEOUT_MS = 15000;
export const STAFF_IDLE_TX_TIMEOUT_MS = 30000;
const SET_TIMEOUTS_SQL = `SELECT set_config('statement_timeout', '${STAFF_STATEMENT_TIMEOUT_MS}', true), set_config('idle_in_transaction_session_timeout', '${STAFF_IDLE_TX_TIMEOUT_MS}', true)`;

export type RoQueryFn = (
  text: string,
  params?: readonly unknown[],
) => Promise<readonly Record<string, unknown>[]>;

export interface RoClient {
  query(text: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
  release(destroy?: boolean | Error): void;
}

/** Testable core: `connect` supplies the client. */
export async function runStaffRo<T>(
  connect: () => Promise<RoClient>,
  fn: (q: RoQueryFn) => Promise<T>,
): Promise<T> {
  const client = await connect();
  let ended = false; // no new q() calls
  let aborted = false; // queued q() calls that have not started yet must not start
  // pg deprecates overlapping client.query calls, so each call waits for the last.
  let chain: Promise<unknown> = Promise.resolve();

  const q: RoQueryFn = (text, params = []) => {
    if (ended) {
      return Promise.reject(new Error("withStaffRo: query after the transaction ended"));
    }
    if (text.includes(";")) {
      return Promise.reject(new Error("staff queries are single statements"));
    }
    const run = async () => {
      if (aborted) throw new Error("withStaffRo: query after the transaction ended");
      return (await client.query(text, [...params])).rows;
    };
    const next = chain.then(run, run);
    chain = next.catch(() => undefined);
    return next;
  };

  let outcome: { ok: true; value: T } | { ok: false; error: unknown };
  try {
    await client.query("BEGIN");
    await client.query(`SET LOCAL ROLE ${STAFF_RO_ROLE}`);
    await client.query(SET_TIMEOUTS_SQL);
    outcome = { ok: true, value: await fn(q) };
  } catch (error) {
    outcome = { ok: false, error };
    aborted = true;
  }
  ended = true;
  // Drain what the callback started so nothing runs after COMMIT/ROLLBACK/release.
  await chain;

  // A connection whose COMMIT or ROLLBACK failed may still be inside the transaction.
  let broken = false;
  try {
    await client.query(outcome.ok ? "COMMIT" : "ROLLBACK");
  } catch (error) {
    broken = true;
    if (outcome.ok) outcome = { ok: false, error };
  }
  try {
    // Exactly once on every path.
    if (broken) client.release(true);
    else client.release();
  } catch {
    // Nothing useful to do; never let it replace the real outcome.
  }
  if (outcome.ok) return outcome.value;
  throw outcome.error;
}

/** Production binding: runStaffRo(() => db.$client.connect(), fn). */
export function withStaffRo<T>(fn: (q: RoQueryFn) => Promise<T>): Promise<T> {
  return runStaffRo(() => db.$client.connect(), fn);
}
