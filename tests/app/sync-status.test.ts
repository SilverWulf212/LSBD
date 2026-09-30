import { describe, it, expect } from "vitest";
import {
  isCentralBusinessHours,
  isSyncStale,
  loadSyncStatus,
  mapRunRow,
  SYNC_RUNS_SQL,
  SYNC_TABLES_SQL,
  LATEST_OK_SQL,
  type QueryFn,
} from "../../src/lib/sync-status";

const H = 60 * 60 * 1000;
// Wed 2026-09-30 15:00 CDT
const WED_3PM = new Date("2026-09-30T20:00:00Z");

describe("isCentralBusinessHours", () => {
  it("is true Mon-Fri 08:00 <= t < 18:00 Central", () => {
    expect(isCentralBusinessHours(WED_3PM)).toBe(true);
    expect(isCentralBusinessHours(new Date("2026-09-30T13:00:00Z"))).toBe(true); // 08:00 CDT
    expect(isCentralBusinessHours(new Date("2026-09-30T12:59:00Z"))).toBe(false); // 07:59 CDT
    expect(isCentralBusinessHours(new Date("2026-09-30T22:59:00Z"))).toBe(true); // 17:59 CDT
    expect(isCentralBusinessHours(new Date("2026-09-30T23:00:00Z"))).toBe(false); // 18:00 CDT
  });
  it("is false on weekends", () => {
    expect(isCentralBusinessHours(new Date("2026-10-03T16:00:00Z"))).toBe(false); // Sat 11:00
    expect(isCentralBusinessHours(new Date("2026-10-04T16:00:00Z"))).toBe(false); // Sun 11:00
  });
  it("follows standard time in winter (CST, UTC-6)", () => {
    expect(isCentralBusinessHours(new Date("2026-12-02T14:00:00Z"))).toBe(true); // 08:00 CST
    expect(isCentralBusinessHours(new Date("2026-12-02T13:59:00Z"))).toBe(false); // 07:59 CST
  });
  it("uses the Central weekday, not UTC", () => {
    // Fri 2026-10-02 17:30 CDT = 22:30Z Friday -> in hours
    expect(isCentralBusinessHours(new Date("2026-10-02T22:30:00Z"))).toBe(true);
    // Fri 2026-10-02 19:30 CDT = 00:30Z Saturday -> out of hours (evening)
    expect(isCentralBusinessHours(new Date("2026-10-03T00:30:00Z"))).toBe(false);
    // Sun 2026-10-04 23:30 CDT = 04:30Z Monday in UTC -> still Sunday in Central
    expect(isCentralBusinessHours(new Date("2026-10-05T04:30:00Z"))).toBe(false);
  });
});

describe("isSyncStale", () => {
  const ok = (msAgo: number, from = WED_3PM) => ({
    startedAt: new Date(from.getTime() - msAgo - 60_000),
    finishedAt: new Date(from.getTime() - msAgo),
  });
  it("is stale when the latest ok run finished more than 2h ago in business hours", () => {
    expect(isSyncStale(ok(2 * H + 60_000), WED_3PM)).toBe(true);
    expect(isSyncStale(ok(2 * H - 60_000), WED_3PM)).toBe(false);
  });
  it("is stale when there is no ok run at all in business hours", () => {
    expect(isSyncStale(null, WED_3PM)).toBe(true);
  });
  it("never flags outside business hours", () => {
    const sat = new Date("2026-10-03T16:00:00Z");
    expect(isSyncStale(ok(48 * H, sat), sat)).toBe(false);
    expect(isSyncStale(null, sat)).toBe(false);
    const night = new Date("2026-10-01T03:00:00Z"); // Wed 22:00 CDT
    expect(isSyncStale(ok(10 * H, night), night)).toBe(false);
  });
  it("falls back to started_at when finished_at is missing", () => {
    expect(isSyncStale({ startedAt: new Date(WED_3PM.getTime() - H), finishedAt: null }, WED_3PM)).toBe(false);
    expect(isSyncStale({ startedAt: new Date(WED_3PM.getTime() - 3 * H), finishedAt: null }, WED_3PM)).toBe(true);
  });
});

describe("mapRunRow", () => {
  it("coerces bigint strings, dates and text[] (array or {a,b} literal)", () => {
    const r = mapRunRow({
      id: "48",
      started_at: "2026-09-30 20:44:23.63+00",
      finished_at: null,
      mode: "full",
      status: "ok",
      tables_changed: "{tblDenHyg,Office}",
      inserted: 1,
      updated: "2",
      deleted: 0,
      orphans_skipped: null,
      error: null,
      blocked_tables: null,
      schema_drift: ["Office.NewCol"],
    });
    expect(r.id).toBe(48);
    expect(r.startedAt?.toISOString()).toBe("2026-09-30T20:44:23.630Z");
    expect(r.finishedAt).toBeNull();
    expect(r.tablesChanged).toEqual(["tblDenHyg", "Office"]);
    expect(r.updated).toBe(2);
    expect(r.orphansSkipped).toBeNull();
    expect(r.blockedTables).toEqual([]);
    expect(r.schemaDrift).toEqual(["Office.NewCol"]);
  });
});

describe("loadSyncStatus", () => {
  it("queries only lsbd_raw bookkeeping with the right shape and maps results", async () => {
    const seen: string[] = [];
    const fakeRun = {
      id: "47",
      started_at: new Date("2026-09-30T19:00:00Z"),
      finished_at: new Date("2026-09-30T19:02:00Z"),
      mode: "quick",
      status: "ok",
      tables_changed: ["tblDenHyg"],
      inserted: 1,
      updated: 1,
      deleted: 0,
      orphans_skipped: 0,
      error: null,
      blocked_tables: [],
      schema_drift: [],
    };
    const query: QueryFn = async (text) => {
      seen.push(text);
      if (text === SYNC_RUNS_SQL)
        return [fakeRun, { ...fakeRun, id: "46", status: "failed", error: "boom (redacted)" }];
      if (text === LATEST_OK_SQL) return [fakeRun];
      if (text === SYNC_TABLES_SQL)
        return [
          {
            table_name: "tblDenHyg",
            source_count: "19285",
            raw_live_count: "19285",
            last_changed_at: "2026-09-30T19:01:00Z",
            last_synced_at: "2026-09-30T19:02:00Z",
          },
        ];
      throw new Error("unexpected query");
    };
    const s = await loadSyncStatus(query, WED_3PM);
    expect([...seen].sort()).toEqual([LATEST_OK_SQL, SYNC_RUNS_SQL, SYNC_TABLES_SQL].sort());
    expect(s.runs.map((r) => [r.id, r.status])).toEqual([
      [47, "ok"],
      [46, "failed"],
    ]);
    expect(s.runs[1].error).toBe("boom (redacted)");
    expect(s.tables).toEqual([
      {
        tableName: "tblDenHyg",
        sourceCount: 19285,
        rawLiveCount: 19285,
        lastChangedAt: new Date("2026-09-30T19:01:00Z"),
        lastSyncedAt: new Date("2026-09-30T19:02:00Z"),
      },
    ]);
    expect(s.latestOk?.id).toBe(47);
    expect(s.stale).toBe(false); // finished 58 min before Wed 3 PM CDT

    const late = await loadSyncStatus(query, new Date("2026-09-30T22:30:00Z")); // 5:30 PM CDT
    expect(late.stale).toBe(true);
  });

  it("returns empty state and a stale flag when there are no runs (business hours)", async () => {
    const s = await loadSyncStatus(async () => [], WED_3PM);
    expect(s).toEqual({ runs: [], tables: [], latestOk: null, stale: true });
  });

  it("SQL reads lsbd_raw only, newest first, 20 runs, ok-only latest", () => {
    expect(SYNC_RUNS_SQL).toMatch(/FROM lsbd_raw\._sync_runs/);
    expect(SYNC_RUNS_SQL).toMatch(/ORDER BY started_at DESC/);
    expect(SYNC_RUNS_SQL).toMatch(/LIMIT 20\b/);
    expect(LATEST_OK_SQL).toMatch(/WHERE status = 'ok'/);
    expect(LATEST_OK_SQL).toMatch(/LIMIT 1\b/);
    expect(SYNC_TABLES_SQL).toMatch(/FROM lsbd_raw\._sync_tables/);
    for (const q of [SYNC_RUNS_SQL, LATEST_OK_SQL, SYNC_TABLES_SQL]) {
      expect(q.trim()).toMatch(/^SELECT\b/);
      expect(q).not.toMatch(/\b(insert|delete|drop|alter|grant|truncate)\b/i);
    }
  });
});
