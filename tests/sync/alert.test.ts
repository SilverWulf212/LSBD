import { describe, it, expect } from "vitest";
import { makeAlerter, eventLogInvocation } from "../../scripts/sync/alert";

// R37: one alert path (healthcheck ping + Windows event log) shared by the runner and reconcile.

function deps(url: string | undefined) {
  const fetched: string[] = [];
  const spawned: { args: string[]; msg: string | undefined }[] = [];
  return {
    fetched,
    spawned,
    d: {
      healthcheckUrl: () => url,
      fetch: (async (u: string) => {
        fetched.push(u);
        return new Response("ok");
      }) as unknown as typeof fetch,
      spawnSync: ((file: string, args: string[], o: { env: NodeJS.ProcessEnv }) => {
        spawned.push({ args, msg: o.env.LSBD_SYNC_MSG });
        return { status: 0 };
      }) as never,
      log: () => undefined,
    },
  };
}

describe("makeAlerter", () => {
  it("ok pings the healthcheck URL and writes no event", async () => {
    const t = deps("https://hc-ping.com/abc/");
    await makeAlerter(t.d).ok();
    expect(t.fetched).toEqual(["https://hc-ping.com/abc/"]);
    expect(t.spawned).toEqual([]);
  });

  it("fail pings <url>/fail and writes the event log, message via env only", async () => {
    const t = deps("https://hc-ping.com/abc/");
    await makeAlerter(t.d).fail("lock stale; pid 42");
    expect(t.fetched).toEqual(["https://hc-ping.com/abc/fail"]);
    expect(t.spawned).toHaveLength(1);
    expect(t.spawned[0].msg).toBe("lock stale; pid 42");
    expect(t.spawned[0].args.join(" ")).not.toContain("pid 42");
  });

  it("fail still writes the event log when no healthcheck URL is configured", async () => {
    const t = deps(undefined);
    await makeAlerter(t.d).fail("x");
    expect(t.fetched).toEqual([]);
    expect(t.spawned).toHaveLength(1);
  });

  it("never throws when the ping or the event log fails", async () => {
    const a = makeAlerter({
      healthcheckUrl: () => "https://hc-ping.com/abc",
      fetch: (async () => {
        throw new Error("offline");
      }) as unknown as typeof fetch,
      spawnSync: (() => {
        throw new Error("no powershell");
      }) as never,
      log: () => undefined,
    });
    await expect(a.fail("x")).resolves.toBeUndefined();
    await expect(a.ok()).resolves.toBeUndefined();
  });

  it("uses the given event id", () => {
    expect(eventLogInvocation("m", 1002).args.join(" ")).toContain("-EventId 1002");
    expect(eventLogInvocation("m").args.join(" ")).toContain("-EventId 1001");
  });
});
