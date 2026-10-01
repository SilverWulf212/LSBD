import { describe, it, expect } from "vitest";
import { runSync, lockBusyVerdict, exitCodeFor, type RunOptions } from "../../scripts/sync/run";
import { runReconcileCli } from "../../scripts/sync/reconcile";
import type { Alerter } from "../../scripts/sync/alert";

// R37 (review I2): no silent stalls. Every path that previously exited quietly (lock busy
// behind a stale holder, a failure before the run row exists, reconcile FAIL) now alerts
// through the event log + healthcheck /fail. Deps are injected; no DB, no VM.

const OPTS: RunOptions = { mode: "quick", tables: "none", transform: false, allowMassDelete: false };

function recorder(): Alerter & { fails: string[]; oks: number } {
  const r = {
    fails: [] as string[],
    oks: 0,
    async ok() {
      r.oks++;
    },
    async fail(m: string) {
      r.fails.push(m);
    },
  };
  return r;
}

/** Minimal pg.Client stand-in: answers by SQL pattern, records everything. */
function fakeClient(handlers: Array<[RegExp, (params?: unknown[]) => unknown[] | Error]>) {
  const sqls: string[] = [];
  const c = {
    sqls,
    ended: false,
    async query(sql: string, params?: unknown[]) {
      sqls.push(sql);
      for (const [re, h] of handlers) {
        if (re.test(sql)) {
          const out = h(params);
          if (out instanceof Error) throw out;
          return { rows: out, rowCount: out.length };
        }
      }
      return { rows: [], rowCount: 0 };
    },
    async end() {
      c.ended = true;
    },
    on() {
      return c;
    },
  };
  return c;
}

const noSchema = async () => [];
const noQuery = (async function* () {}) as never;

describe("lockBusyVerdict", () => {
  it("a young sync holder is a quiet skip", () => {
    const v = lockBusyVerdict({ pid: 7, app: "lsbd-sync", state: "active", stateAgeSec: 5, runAgeSec: 240 });
    expect(v.stale).toBe(false);
    expect(v.message).toMatch(/pid 7/);
    expect(v.message).toMatch(/lsbd-sync/);
    expect(v.message).toMatch(/4 min/);
  });
  it("a sync holder whose run started > 30 min ago is stale (run age wins over activity)", () => {
    const v = lockBusyVerdict({ pid: 7, app: "lsbd-sync", state: "active", stateAgeSec: 3, runAgeSec: 31 * 60 });
    expect(v.stale).toBe(true);
    expect(v.message).toMatch(/31 min/);
  });
  it("a non-sync holder (psql, apply-transforms) is aged by its last state change", () => {
    expect(lockBusyVerdict({ pid: 9, app: "psql", state: "idle", stateAgeSec: 45 * 60, runAgeSec: 2 * 3600 }).stale).toBe(true);
    expect(lockBusyVerdict({ pid: 9, app: "lsbd-apply-transforms", state: "active", stateAgeSec: 20, runAgeSec: 2 * 3600 }).stale).toBe(false);
  });
  it("an unknown holder (released meanwhile, or not visible) is not stale", () => {
    expect(lockBusyVerdict(null).stale).toBe(false);
  });
});

describe("runSync alerting (injected deps)", () => {
  it("lock busy, young holder: skipped, exit 0, holder logged, no alert", async () => {
    const a = recorder();
    const c = fakeClient([
      [/pg_try_advisory_lock/, () => [{ got: false }]],
      [/pg_locks/, () => [{ pid: 11, app: "lsbd-sync", state: "active", state_age: "2", run_age: "120" }]],
    ]);
    const s = await runSync(OPTS, { readSchema: noSchema, query: noQuery, db: async () => c as never, alert: a });
    expect(s.status).toBe("skipped");
    expect(exitCodeFor(s.status)).toBe(0);
    expect(a.fails).toEqual([]);
    expect(a.oks).toBe(0);
    expect(c.sqls.some((q) => /INSERT INTO lsbd_raw._sync_runs/.test(q))).toBe(false);
  });

  it("lock busy, holder older than 30 min: failed (exit 1) and alerted with pid, app and age", async () => {
    const a = recorder();
    const c = fakeClient([
      [/pg_try_advisory_lock/, () => [{ got: false }]],
      [/pg_locks/, () => [{ pid: 4242, app: "lsbd-sync", state: "idle in transaction", state_age: "3000", run_age: "2700" }]],
    ]);
    const s = await runSync(OPTS, { readSchema: noSchema, query: noQuery, db: async () => c as never, alert: a });
    expect(s.status).toBe("failed");
    expect(exitCodeFor(s.status)).toBe(1);
    expect(a.fails).toHaveLength(1);
    expect(a.fails[0]).toMatch(/pid 4242/);
    expect(a.fails[0]).toMatch(/lsbd-sync/);
    expect(a.fails[0]).toMatch(/45 min/);
    expect(c.ended).toBe(true);
  });

  it("connect failure (before any run row): alerted, redacted, rethrown", async () => {
    const a = recorder();
    await expect(
      runSync(OPTS, {
        readSchema: noSchema,
        query: noQuery,
        db: async () => {
          throw new Error('password authentication failed for user "postgres.secretref"');
        },
        alert: a,
      }),
    ).rejects.toThrow(/password authentication failed/);
    expect(a.fails).toHaveLength(1);
    expect(a.fails[0]).toMatch(/before the run completed|failed/);
    expect(a.fails[0]).not.toContain("secretref");
  });

  it("run-row insert failure (lock held): alerted and the lock is released", async () => {
    const a = recorder();
    const c = fakeClient([
      [/pg_try_advisory_lock/, () => [{ got: true }]],
      [/INSERT INTO lsbd_raw._sync_runs/, () => new Error("relation \"lsbd_raw._sync_runs\" does not exist")],
    ]);
    await expect(
      runSync(OPTS, { readSchema: noSchema, query: noQuery, db: async () => c as never, alert: a }),
    ).rejects.toThrow(/does not exist/);
    expect(a.fails).toHaveLength(1);
    expect(c.sqls.some((q) => /pg_advisory_unlock/.test(q))).toBe(true);
  });

  it("a completed ok run pings ok once; a failed final UPDATE alerts once", async () => {
    const okA = recorder();
    const okC = fakeClient([
      [/pg_try_advisory_lock/, () => [{ got: true }]],
      [/INSERT INTO lsbd_raw._sync_runs/, () => [{ id: "5" }]],
    ]);
    const s = await runSync(OPTS, { readSchema: noSchema, query: noQuery, db: async () => okC as never, alert: okA });
    expect(s.status).toBe("ok");
    expect(okA.oks).toBe(1);
    expect(okA.fails).toEqual([]);

    const badA = recorder();
    const badC = fakeClient([
      [/pg_try_advisory_lock/, () => [{ got: true }]],
      [/INSERT INTO lsbd_raw._sync_runs/, () => [{ id: "6" }]],
      [/UPDATE lsbd_raw._sync_runs SET finished_at/, () => new Error("canceling statement due to statement timeout")],
    ]);
    await expect(
      runSync(OPTS, { readSchema: noSchema, query: noQuery, db: async () => badC as never, alert: badA }),
    ).rejects.toThrow(/statement timeout/);
    expect(badA.fails).toHaveLength(1);
    expect(badA.oks).toBe(0);
  });
});

describe("runReconcileCli alerting", () => {
  it("PASS: exit 0, no alert", async () => {
    const a = recorder();
    expect(await runReconcileCli({ main: async () => 0, alert: a })).toBe(0);
    expect(a.fails).toEqual([]);
  });
  it("FAIL: exit 1 and alerted", async () => {
    const a = recorder();
    expect(await runReconcileCli({ main: async () => 1, alert: a })).toBe(1);
    expect(a.fails).toHaveLength(1);
    expect(a.fails[0]).toMatch(/reconcile/i);
  });
  it("crash: exit 1 and alerted with a redacted message", async () => {
    const a = recorder();
    const code = await runReconcileCli({
      main: async () => {
        throw new Error("invalid input syntax for type integer: \"123-45-6789\"");
      },
      alert: a,
    });
    expect(code).toBe(1);
    expect(a.fails).toHaveLength(1);
    expect(a.fails[0]).not.toContain("123-45-6789");
  });
});
