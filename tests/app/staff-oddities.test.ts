import { describe, expect, it } from "vitest";
import { licenceOddities } from "../../src/lib/staff-oddities";

// now = Fri 2026-10-02 10:00 CDT
const NOW = new Date("2026-10-02T15:00:00Z");
const base = { status: "ACT", dateUntil: "2027-01-01T05:59:59Z", type: "D", duplicateCount: 1 };

describe("licenceOddities", () => {
  it("has no oddities for an ordinary licence", () => expect(licenceOddities(base, NOW)).toEqual([]));

  it("flags ACT and PRB past expiry by Central calendar day", () => {
    expect(licenceOddities({ ...base, dateUntil: "2026-10-02T04:59:59Z" }, NOW)).toEqual(["expired-active"]); // Oct 1 23:59 CDT
    expect(licenceOddities({ ...base, dateUntil: "2026-10-02T05:00:00Z" }, NOW)).toEqual([]); // expires today
    expect(licenceOddities({ ...base, status: "PRB", dateUntil: "2020-12-31T06:00:00Z" }, NOW)).toEqual(["expired-active"]);
    expect(licenceOddities({ ...base, status: "SUS", dateUntil: "2020-12-31T06:00:00Z" }, NOW)).toEqual([]);
    expect(licenceOddities({ ...base, dateUntil: "3000-10-10T05:00:00Z" }, NOW)).toEqual([]); // EDDA "no expiry"
    expect(licenceOddities({ ...base, dateUntil: null }, NOW)).toEqual([]);
  });

  it("flags a NULL status", () => expect(licenceOddities({ ...base, status: null }, NOW)).toEqual(["no-status"]));

  it("flags duplicates only when the type is known", () => {
    expect(licenceOddities({ ...base, duplicateCount: 2 }, NOW)).toEqual(["duplicate-number"]);
    expect(licenceOddities({ ...base, type: null, duplicateCount: 2 }, NOW)).toEqual([]);
  });

  it("returns several oddities in a fixed order", () =>
    expect(licenceOddities({ status: null, dateUntil: null, type: "E", duplicateCount: 3 }, NOW)).toEqual([
      "no-status",
      "duplicate-number",
    ]));
});
