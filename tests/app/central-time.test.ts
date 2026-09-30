import { describe, it, expect } from "vitest";
import {
  formatCentralDate,
  formatCentralDateTime,
  centralDayKey,
  centralClock,
} from "../../src/lib/central-time";

describe("formatCentralDate", () => {
  it("shows a source midnight-Central DateUntil on its own day (no off-by-one)", () => {
    // Source 2027-12-31 00:00 (naive Central) is stored as 06:00Z (CST).
    expect(formatCentralDate("2027-12-31T06:00:00+00:00")).toBe("Dec 31, 2027");
    expect(formatCentralDate("2027-12-31 06:00:00+00", "long")).toBe("December 31, 2027");
  });

  it("handles daylight time (CDT, UTC-5)", () => {
    expect(formatCentralDate("1968-06-07T05:00:00+00:00")).toBe("Jun 7, 1968");
  });

  it("does not use UTC: 03:00Z on Jan 1 is still Dec 31 in Central", () => {
    expect(formatCentralDate("2027-01-01T03:00:00Z")).toBe("Dec 31, 2026");
  });

  it("returns an em dash for null, empty and invalid input", () => {
    expect(formatCentralDate(null)).toBe("—");
    expect(formatCentralDate("")).toBe("—");
    expect(formatCentralDate("not a date")).toBe("—");
  });
});

describe("formatCentralDateTime", () => {
  it("formats in Central with the zone abbreviation", () => {
    expect(formatCentralDateTime("2026-09-30T20:44:23Z")).toBe("Sep 30, 2026, 3:44 PM CDT");
    expect(formatCentralDateTime(new Date("2026-12-02T14:05:00Z"))).toBe("Dec 2, 2026, 8:05 AM CST");
    expect(formatCentralDateTime(null)).toBe("—");
  });
});

describe("centralDayKey", () => {
  it("returns the Central calendar day as YYYY-MM-DD", () => {
    expect(centralDayKey("2027-12-31T06:00:00Z")).toBe("2027-12-31");
    expect(centralDayKey("2027-01-01T05:59:00Z")).toBe("2026-12-31");
    expect(centralDayKey(null)).toBeNull();
  });
});

describe("centralClock", () => {
  it("returns Central weekday and 24h hour", () => {
    // Wed 2026-09-30 15:44 CDT
    expect(centralClock(new Date("2026-09-30T20:44:00Z"))).toEqual({ weekday: 3, hour: 15 });
    // 00:30 Central is hour 0, not 24
    expect(centralClock(new Date("2026-10-01T05:30:00Z"))).toEqual({ weekday: 4, hour: 0 });
    // Sat 2026-10-03 10:00 CDT
    expect(centralClock(new Date("2026-10-03T15:00:00Z"))).toEqual({ weekday: 6, hour: 10 });
  });
});
