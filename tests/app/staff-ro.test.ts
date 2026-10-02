import { describe, expect, it } from "vitest";
import {
  STAFF_RO_ROLE,
  runStaffRo,
  type RoClient,
  type RoQueryFn,
} from "../../src/lib/db/lsbd-ro";

type Call = { text: string; params: unknown[] | undefined };

function harness(opts: { failOn?: Record<string, Error>; hold?: string } = {}) {
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
  const connect = async () => client;
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
    const h = harness();
    const err = new Error("no connection");
    await expect(
      runStaffRo(async () => {
        throw err;
      }, async () => "x"),
    ).rejects.toBe(err);
    expect(h.releases).toEqual([]);
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
