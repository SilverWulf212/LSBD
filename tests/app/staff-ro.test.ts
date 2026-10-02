import { describe, expect, it } from "vitest";
import {
  STAFF_RO_ROLE,
  runStaffRo,
  type RoClient,
  type RoQueryFn,
} from "../../src/lib/db/lsbd-ro";

type Call = { text: string; params: unknown[] | undefined };

function harness(opts: { failOn?: Record<string, Error>; hold?: string; connectError?: Error } = {}) {
  const calls: Call[] = [];
  const releases: unknown[] = [];
  const events: string[] = [];
  let unblock: (() => void) | undefined;
  const gate = new Promise<void>((res) => (unblock = res));
  const client: RoClient = {
    async query(text, params) {
      calls.push({ text, params });
      events.push(`start ${text}`);
      if (opts.hold === text) await gate;
      events.push(`end ${text}`);
      const err = opts.failOn?.[text];
      if (err) throw err;
      return { rows: [] };
    },
    release(destroy) {
      releases.push(destroy);
    },
  };
  const connect = async () => {
    if (opts.connectError) throw opts.connectError;
    return client;
  };
  return {
    calls,
    releases,
    events,
    connect,
    unblock: () => unblock?.(),
    texts: () => calls.map((c) => c.text),
  };
}

const SET_ROLE = "SET LOCAL ROLE lsbd_staff_ro";

describe("runStaffRo", () => {
  it("runs BEGIN, SET LOCAL ROLE, the queries, COMMIT, then releases", async () => {
    const h = harness();
    const r = await runStaffRo(h.connect, async (q) => {
      await q("SELECT $1::int AS n", [5]);
      return "done";
    });
    expect(r).toBe("done");
    expect(h.texts()).toEqual(["BEGIN", SET_ROLE, "SELECT $1::int AS n", "COMMIT"]);
    expect(h.calls[2].params).toEqual([5]);
    expect(h.releases).toEqual([undefined]);
  });

  it("passes an empty array when no params are given", async () => {
    const h = harness();
    await runStaffRo(h.connect, async (q) => {
      await q("SELECT 1");
    });
    expect(h.calls[2].params).toEqual([]);
  });

  it("rolls back and rethrows when the callback throws", async () => {
    const h = harness();
    const boom = new Error("boom");
    await expect(
      runStaffRo(h.connect, async () => {
        throw boom;
      }),
    ).rejects.toBe(boom);
    expect(h.texts()).toEqual(["BEGIN", SET_ROLE, "ROLLBACK"]);
    expect(h.releases).toEqual([undefined]);
  });

  it("never runs the callback when SET LOCAL ROLE is refused", async () => {
    const denied = Object.assign(new Error("permission denied to set role"), { code: "42501" });
    const h = harness({ failOn: { [SET_ROLE]: denied } });
    let ran = false;
    await expect(
      runStaffRo(h.connect, async () => {
        ran = true;
      }),
    ).rejects.toBe(denied);
    expect(ran).toBe(false);
    expect(h.texts()).toEqual(["BEGIN", SET_ROLE, "ROLLBACK"]);
    expect(h.releases).toEqual([undefined]);
  });

  it("destroys the client when ROLLBACK fails, and rethrows the original error", async () => {
    const h = harness({ failOn: { ROLLBACK: new Error("rollback failed") } });
    const boom = new Error("boom");
    await expect(
      runStaffRo(h.connect, async () => {
        throw boom;
      }),
    ).rejects.toBe(boom);
    expect(h.releases).toEqual([true]);
  });

  it("destroys the client when COMMIT fails", async () => {
    const commitErr = new Error("commit failed");
    const h = harness({ failOn: { COMMIT: commitErr } });
    await expect(runStaffRo(h.connect, async () => "x")).rejects.toBe(commitErr);
    expect(h.releases).toEqual([true]);
  });

  it("rejects without releasing when connect fails", async () => {
    const err = new Error("no connection");
    const h = harness({ connectError: err });
    await expect(runStaffRo(h.connect, async () => "x")).rejects.toBe(err);
    expect(h.releases).toEqual([]);
    expect(h.calls).toEqual([]);
  });

  it("rolls back and releases cleanly when BEGIN fails (a failed statement is not a failed ROLLBACK)", async () => {
    const err = new Error("begin failed");
    const h = harness({ failOn: { BEGIN: err } });
    let ran = false;
    await expect(runStaffRo(h.connect, async () => { ran = true; })).rejects.toBe(err);
    expect(ran).toBe(false);
    expect(h.texts()).toEqual(["BEGIN", "ROLLBACK"]);
    expect(h.releases).toEqual([undefined]);
  });

  it("runs no queued query after ROLLBACK when the first of three is refused", async () => {
    const denied = Object.assign(new Error("denied"), { code: "42501" });
    const h = harness({ failOn: { A: denied } });
    await expect(
      runStaffRo(h.connect, async (q) => {
        await Promise.all([q("A"), q("B"), q("C")]);
      }),
    ).rejects.toBe(denied);
    const t = h.texts();
    expect(t).not.toContain("C");
    expect(t.slice(t.indexOf("ROLLBACK") + 1)).toEqual([]);
    expect(h.releases).toEqual([undefined]);
    expect(h.events[h.events.length - 1]).toBe("end ROLLBACK");
  });

  it("runs no queued query after ROLLBACK when the callback throws with queries pending", async () => {
    const boom = new Error("boom");
    const h = harness();
    await expect(
      runStaffRo(h.connect, async (q) => {
        void q("A").catch(() => undefined);
        void q("B").catch(() => undefined);
        void q("C").catch(() => undefined);
        throw boom;
      }),
    ).rejects.toBe(boom);
    const t = h.texts();
    expect(t.slice(t.indexOf("ROLLBACK") + 1)).toEqual([]);
    expect(t).not.toContain("C");
    expect(h.releases).toEqual([undefined]);
  });

  it("drains an unawaited query before COMMIT on success", async () => {
    const h = harness();
    await runStaffRo(h.connect, async (q) => {
      void q("A");
    });
    expect(h.texts()).toEqual(["BEGIN", SET_ROLE, "A", "COMMIT"]);
  });

  it("rejects multi-statement SQL before sending anything", async () => {
    const h = harness();
    await runStaffRo(h.connect, async (q) => {
      await expect(q("SELECT 1; RESET ROLE")).rejects.toThrow("staff queries are single statements");
      await expect(q("SELECT 1")).resolves.toEqual([]);
    });
    expect(h.texts()).toEqual(["BEGIN", SET_ROLE, "SELECT 1", "COMMIT"]);
  });

  it("releases exactly once and keeps the callback error when release throws", async () => {
    const boom = new Error("boom");
    const releases: unknown[] = [];
    const client: RoClient = {
      async query() { return { rows: [] }; },
      release(d) { releases.push(d); throw new Error("release failed"); },
    };
    await expect(
      runStaffRo(async () => client, async () => { throw boom; }),
    ).rejects.toBe(boom);
    expect(releases).toEqual([undefined]);
  });

  it("serialises concurrent calls on the one client", async () => {
    const h = harness({ hold: "A" });
    const p = runStaffRo(h.connect, async (q) => {
      const both = Promise.all([q("A"), q("B")]);
      await new Promise((r) => setTimeout(r, 10));
      h.unblock();
      await both;
    });
    await p;
    const ab = h.events.filter((e) => e.endsWith(" A") || e.endsWith(" B"));
    expect(ab).toEqual(["start A", "end A", "start B", "end B"]);
  });

  it("refuses a query after the transaction has ended", async () => {
    const h = harness();
    let leaked!: RoQueryFn;
    await runStaffRo(h.connect, async (q) => {
      leaked = q;
    });
    await expect(leaked("SELECT 1")).rejects.toThrow("withStaffRo: query after the transaction ended");
    expect(h.texts()).not.toContain("SELECT 1");
  });

  it("exports the role name used in SET LOCAL ROLE", () => {
    expect(STAFF_RO_ROLE).toBe("lsbd_staff_ro");
  });
});
