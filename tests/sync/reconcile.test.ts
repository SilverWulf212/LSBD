import { describe, it, expect } from "vitest";
import { compareTable, reportFileName, renderReport } from "../../scripts/sync/reconcile";

const kh = (k: string, h: string) => ({ k, h });

describe("compareTable", () => {
  it("identical sets: everything matches, zero differences", () => {
    const s = [kh("1", "a"), kh("2", "b"), kh("3", "c")];
    const r = compareTable(3, s, [kh("3", "c"), kh("1", "a"), kh("2", "b")]);
    expect(r).toEqual({ countMatch: true, setMatch: true, missing: 0, extra: 0, hashMismatch: 0 });
  });

  it("one key missing in raw and one hash differing", () => {
    const source = [kh("1", "a"), kh("2", "b"), kh("3", "c")];
    const raw = [kh("1", "a"), kh("2", "X")];
    const r = compareTable(3, source, raw);
    expect(r.missing).toBe(1);
    expect(r.hashMismatch).toBe(1);
    expect(r.extra).toBe(0);
    expect(r.setMatch).toBe(false);
  });

  it("a raw key that the source no longer has counts as extra", () => {
    const r = compareTable(1, [kh("1", "a")], [kh("1", "a"), kh("9", "z")]);
    expect(r.extra).toBe(1);
    expect(r.setMatch).toBe(false);
    expect(r.countMatch).toBe(false);
  });

  it("a source count that differs from the number of source keys is a count mismatch", () => {
    const s = [kh("1", "a"), kh("2", "b")];
    const r = compareTable(3, s, [kh("1", "a"), kh("2", "b")]);
    expect(r.countMatch).toBe(false);
    expect(r.setMatch).toBe(true);
    expect(r.hashMismatch).toBe(0);
  });

  it("empty table on both sides matches", () => {
    expect(compareTable(0, [], [])).toEqual({ countMatch: true, setMatch: true, missing: 0, extra: 0, hashMismatch: 0 });
  });
});

describe("reportFileName", () => {
  it("uses local time yyyyMMdd-HHmm", () => {
    expect(reportFileName(new Date(2026, 8, 30, 2, 5))).toBe("reconcile-20260930-0205.md");
  });
});

describe("renderReport", () => {
  const base = {
    when: new Date(2026, 8, 30, 2, 0),
    durationSec: 12.3,
    rows: [
      { name: "A", mode: "keys" as const, sourceCount: 5, rawCount: 5, pass: true, rechecked: false, note: "" },
      { name: "B", mode: "counts" as const, sourceCount: 4, rawCount: 3, pass: false, rechecked: true, note: "" },
    ],
    dupGroups: [{ type: "D", licenseId: "123", n: 2 }],
    orphans: "n/a (transforms not installed)",
    ssn: [{ table: "tblDenHyg", source: 10, raw: 9, failures: 1 }],
  };
  it("contains both sections, PASS/FAIL rows and the recheck marker", () => {
    const md = renderReport(base);
    expect(md).toContain("## 1. Reconciliation");
    expect(md).toContain("## 2. Data quality for staff review");
    expect(md).toMatch(/\| A \|.*PASS/);
    expect(md).toMatch(/\| B \|.*FAIL \(rechecked\)/);
    expect(md).toContain("n/a (transforms not installed)");
    expect(md).toContain("| D | 123 | 2 |");
  });
});
