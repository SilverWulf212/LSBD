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
import { db } from "./index";

export const STAFF_RO_ROLE = "lsbd_staff_ro";

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
  let ended = false;
  let released = false;
  // pg deprecates overlapping client.query calls, so each call waits for the last.
  let chain: Promise<unknown> = Promise.resolve();

  const q: RoQueryFn = (text, params = []) => {
    if (ended) {
      return Promise.reject(new Error("withStaffRo: query after the transaction ended"));
    }
    const run = async () => (await client.query(text, [...params])).rows;
    const next = chain.then(run, run);
    chain = next.catch(() => undefined);
    return next;
  };

  try {
    await client.query("BEGIN");
    await client.query(`SET LOCAL ROLE ${STAFF_RO_ROLE}`);
    const result = await fn(q);
    ended = true;
    await chain;
    try {
      await client.query("COMMIT");
    } catch (err) {
      // Unknown transaction state: do not reuse this connection.
      released = true;
      client.release(true);
      throw err;
    }
    released = true;
    client.release();
    return result;
  } catch (err) {
    ended = true;
    if (!released) {
      try {
        await client.query("ROLLBACK");
        client.release();
      } catch {
        client.release(true);
      }
    }
    throw err;
  }
}

/** Production binding: runStaffRo(() => db.$client.connect(), fn). */
export function withStaffRo<T>(fn: (q: RoQueryFn) => Promise<T>): Promise<T> {
  return runStaffRo(() => db.$client.connect(), fn);
}
