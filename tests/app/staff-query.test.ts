import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  cleanText, lastPage, pageHref, pageWindow, parsePage, rangeText, rowBool, rowIso, rowNum, rowStr, runPaged,
} from "../../src/lib/staff-query";
import type { RoQueryFn } from "../../src/lib/db/lsbd-ro";

function fake(...results: Record<string, unknown>[][]) {
  const calls: { text: string; params: readonly unknown[] }[] = [];
  let i = 0;
  const query: RoQueryFn = async (text, params = []) => {
    calls.push({ text, params });
    return results[Math.min(i++, results.length - 1)] ?? [];
  };
  return { query, calls };
}

describe("staff-query", () => {
  it("clamps the page number", () => {
    for (const v of [undefined, "", "0", "-1", "abc", "2.5", "1e9", "10001", ["x", "3"]]) expect(parsePage(v)).toBe(1);
    expect(parsePage("772")).toBe(772);
    expect(parsePage(["3", "9"])).toBe(3);
    expect(parsePage("10000")).toBe(10000);
  });
  it("cleans text input", () => {
    expect(cleanText("  smith ")).toBe("smith");
    expect(cleanText(["a", "b"])).toBe("a");
    expect(cleanText("a\u0000b")).toBe("");
    expect(cleanText("a".repeat(101))).toBe("");
    expect(cleanText(undefined)).toBe("");
  });
  it("builds page links that keep the filters", () => {
    expect(pageHref("/admin/licensees", { last: "O'BRIEN & CO", type: "D", city: "" }, 2))
      .toBe("/admin/licensees?last=O%27BRIEN+%26+CO&type=D&page=2");
    expect(pageHref("/admin/licensees", { last: "50%" }, 1)).toBe("/admin/licensees?last=50%25");
    expect(pageHref("/admin/permits", {}, 1)).toBe("/admin/permits");
  });
  it("windows the page list", () => {
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageWindow(2, 3)).toEqual([1, 2, 3]);
    expect(pageWindow(1, 772)).toEqual([1, 2, "gap", 772]);
    expect(pageWindow(400, 772)).toEqual([1, "gap", 399, 400, 401, "gap", 772]);
    expect(pageWindow(772, 772)).toEqual([1, "gap", 771, 772]);
  });
  it("describes the visible range", () => {
    expect(rangeText(3, 25, 19285, 25)).toBe("Showing 51–75 of 19,285");
    expect(rangeText(772, 25, 19285, 10)).toBe("Showing 19,276–19,285 of 19,285");
    expect(lastPage(19285)).toBe(772);
    expect(lastPage(0)).toBe(1);
  });
  it("appends LIMIT and a bound OFFSET", async () => {
    const f = fake([{ id: 1, total: "19285" }]);
    const r = await runPaged(f.query, "SELECT id, count(*) OVER() AS total FROM t WHERE a = $1", ["x"], 772, (row) => ({ id: row.id }));
    expect(f.calls[0].text).toMatch(/\nLIMIT 25 OFFSET \$2$/);
    expect(f.calls[0].params).toEqual(["x", 19275]);
    expect(r).toEqual({ rows: [{ id: 1 }], total: 19285, page: 772, pageSize: 25 });
  });
  it("falls back to page 1 when the page is past the last row", async () => {
    const f = fake([], [{ id: 1, total: "40" }]);
    const r = await runPaged(f.query, "SELECT id, count(*) OVER() AS total FROM t", [], 5, (row) => ({ id: row.id }));
    expect(f.calls).toHaveLength(2);
    expect(f.calls[1].params.at(-1)).toBe(0);
    expect(r.page).toBe(1);
    expect(r.total).toBe(40);
  });
  it("does not query twice for an empty page 1", async () => {
    const f = fake([]);
    const r = await runPaged(f.query, "SELECT id, count(*) OVER() AS total FROM t", [], 1, (row) => row);
    expect(f.calls).toHaveLength(1);
    expect(r).toMatchObject({ rows: [], total: 0, page: 1 });
  });
  it("converts row values", () => {
    expect(rowIso(new Date("2027-01-01T05:59:59Z"))).toBe("2027-01-01T05:59:59.000Z");
    expect(rowNum("19285")).toBe(19285);
    expect(rowNum(null)).toBeNull();
    expect(rowStr(undefined)).toBeNull();
    expect(rowBool(null)).toBeNull();
  });
  it("the table is a server component built on the shared pagination", () => {
    const src = readFileSync("src/components/admin/server-table.tsx", "utf8");
    expect(src).not.toContain("use client");
    expect(src).toContain("@/components/ui/pagination");
    expect(src).toContain("pageHref(");
    expect(src).toContain("pageWindow(");
  });
});
