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

import { checkSchema, summaryLine, guarded, isError } from "../../scripts/sync/reconcile";

describe("checkSchema", () => {
  it("flags an empty source schema", () => {
    const r = checkSchema([], new Map([["A", 3]]));
    expect(r.empty).toBe(true);
    expect(r.sourceMissing).toEqual(["A"]);
  });
  it("flags a source table with no raw table", () => {
    const r = checkSchema(["A", "B"], new Map([["A", 1]]));
    expect(r.empty).toBe(false);
    expect(r.missingRaw).toEqual(["B"]);
    expect(r.sourceMissing).toEqual([]);
  });
  it("flags a raw table with live rows but no source table; ignores empty raw-only tables", () => {
    const r = checkSchema(["A"], new Map([["A", 1], ["Old", 5], ["Empty", 0]]));
    expect(r.sourceMissing).toEqual(["Old"]);
    expect(r.missingRaw).toEqual([]);
  });
  it("clean schema has no problems", () => {
    expect(checkSchema(["A"], new Map([["A", 0]]))).toEqual({ empty: false, missingRaw: [], sourceMissing: [] });
  });
});

describe("summaryLine", () => {
  const row = (pass: boolean) => ({ name: "x", mode: "keys" as const, sourceCount: 1, rawCount: 1, pass, rechecked: false, note: "" });
  it("an empty schema is a FAIL, never PASS 0/0", () => {
    expect(summaryLine([])).toBe("FAIL: source schema empty");
    expect(summaryLine([row(true)], true)).toBe("FAIL: source schema empty");
  });
  it("PASS n/n and FAIL n tables", () => {
    expect(summaryLine([row(true), row(true)])).toBe("PASS 2/2");
    expect(summaryLine([row(true), row(false)])).toBe("FAIL 1 tables");
  });
});

describe("Section 2 isolation", () => {
  it("guarded turns a throw into a redacted error value", async () => {
    const r = await guarded(async () => {
      throw new Error(`bad value 'secret-ssn' in column "SSN"`);
    });
    expect(isError(r)).toBe(true);
    expect(JSON.stringify(r)).not.toContain("secret-ssn");
  });
  it("guarded passes a result through, including arrays", async () => {
    const r = await guarded(async () => [1, 2]);
    expect(isError(r)).toBe(false);
    expect(r).toEqual([1, 2]);
  });
  it("renderReport renders failing Section 2 items and still gives the Section 1 result", () => {
    const md = renderReport({
      when: new Date(2026, 8, 30, 2, 0),
      durationSec: 1,
      rows: [{ name: "A", mode: "keys", sourceCount: 1, rawCount: 1, pass: true, rechecked: false, note: "" }],
      dupGroups: { error: "connection lost" },
      orphans: "error: boom",
      ssn: [{ table: "tblDenHyg", source: 0, raw: 0, failures: 0, error: "bridge down" }],
    });
    expect(md).toContain("PASS 1/1");
    expect(md).toContain("error: connection lost");
    expect(md).toContain("error: boom");
    expect(md).toContain("error: bridge down");
  });
  it("renderReport for an empty schema says so", () => {
    const md = renderReport({ when: new Date(), durationSec: 0, rows: [], schemaEmpty: true, dupGroups: [], orphans: "n/a", ssn: [] });
    expect(md).toContain("FAIL: source schema empty");
  });
});
