import { describe, expect, it } from "vitest";
import { getPublicLicensees, searchPublicLicensees, validateSearch, type PgQueryFn } from "../../src/lib/public-verify-query";

function fake(rows: Record<string, unknown>[] = []) {
  const calls: { text: string; params: readonly unknown[] }[] = [];
  const query: PgQueryFn = async (text, params) => { calls.push({ text, params }); return rows; };
  return { query, calls };
}
const row = {
  license_id: "2227", type: "D", status: "ACT", action: null,
  date_since: new Date("2001-07-01T05:00:00Z"), date_until: new Date("2027-01-01T05:59:59Z"),
  first_name: "A", middle_name: null, last_name: "SMITH", license_name: null, suffix: null, prefix: null,
  total: "61",
};

describe("searchPublicLicensees", () => {
  it("binds input as parameters and escapes LIKE wildcards", async () => {
    const f = fake([row]);
    await searchPublicLicensees(f.query, { lastName: "%%", firstName: "a_b", type: "all", page: 1 });
    const { text, params } = f.calls[0];
    expect(text).toContain("public.public_licensee");
    expect(text).not.toContain("%%");
    expect(text).not.toContain("a_b");
    expect(params).toContain("\\%\\%%");
    expect(params).toContain("a\\_b%");
    expect(text).toMatch(/LIMIT 15/);
  });
  it("converts dates to ISO strings and caps the total", async () => {
    const f = fake([row]);
    const r = await searchPublicLicensees(f.query, { lastName: "smith", type: "all", page: 1 });
    expect(r.rows[0].date_until).toBe("2027-01-01T05:59:59.000Z");
    expect(r.rows[0]).not.toHaveProperty("total");
    expect(r.total).toBe(50);
    expect(r.hasMore).toBe(true);
    expect(r.pageSize).toBe(15);
  });
  it("returns an empty result with total 0", async () => {
    const r = await searchPublicLicensees(fake([]).query, { licenseId: "999999", type: "all", page: 1 });
    expect(r).toMatchObject({ rows: [], total: 0, hasMore: false });
  });
  it("adds the type filter only for D/H/E", async () => {
    const f = fake([]);
    await searchPublicLicensees(f.query, { licenseId: "2227", type: "H", page: 2 });
    expect(f.calls[0].params).toEqual(expect.arrayContaining(["2227", "H"]));
    expect(f.calls[0].text).toMatch(/OFFSET/);
  });
  it("adds no type parameter for all", async () => {
    const f = fake([]);
    await searchPublicLicensees(f.query, { licenseId: "2227", type: "all", page: 1 });
    expect(f.calls[0].params).toEqual(["2227", 0]);
    expect(f.calls[0].text).not.toMatch(/type = /);
  });
  it("binds offset 15 for page 2", async () => {
    const f = fake([row]);
    const r = await searchPublicLicensees(f.query, { lastName: "smith", type: "all", page: 2 });
    expect(f.calls[0].params).toEqual(["smith%", 15]);
    expect(r.page).toBe(2);
  });
  it("limits page 4 to the 5 rows left under the 50-row cap", async () => {
    const f = fake([row]);
    await searchPublicLicensees(f.query, { lastName: "smith", type: "all", page: 4 });
    expect(f.calls[0].params).toEqual(["smith%", 45]);
    expect(f.calls[0].text).toMatch(/LIMIT 5 OFFSET/);
  });
  it("falls back to page 1 when the requested page is past the last row", async () => {
    const calls: { text: string; params: readonly unknown[] }[] = [];
    const query: PgQueryFn = async (text, params) => {
      calls.push({ text, params });
      return calls.length === 1 ? [] : [{ ...row, total: "20" }];
    };
    const r = await searchPublicLicensees(query, { lastName: "smith", type: "all", page: 3 });
    expect(calls).toHaveLength(2);
    expect(calls[0].params).toEqual(["smith%", 30]);
    expect(calls[1].params).toEqual(["smith%", 0]);
    expect(calls[1].text).toMatch(/LIMIT 15 OFFSET/);
    expect(r).toMatchObject({ page: 1, total: 20, hasMore: false });
    expect(r.rows).toHaveLength(1);
  });
  it("does not query twice for an empty page 1", async () => {
    const f = fake([]);
    await searchPublicLicensees(f.query, { licenseId: "999999", type: "all", page: 1 });
    expect(f.calls).toHaveLength(1);
  });
});

describe("validateSearch", () => {
  const invalid = { ok: false, reason: "Enter a valid name or license number." };
  it("accepts a license number or a 2-letter last name", () => {
    expect(validateSearch({ licenseId: "2227" })).toEqual({ ok: true });
    expect(validateSearch({ lastName: "sm" })).toEqual({ ok: true });
    expect(validateSearch({ lastName: "s" }).ok).toBe(false);
  });
  it("rejects control characters, including NUL", () => {
    expect(validateSearch({ lastName: "smi\u0000th" })).toEqual(invalid);
    expect(validateSearch({ licenseId: "22\u001b27" })).toEqual(invalid);
    expect(validateSearch({ lastName: "smith", firstName: "a\u007fb" })).toEqual(invalid);
  });
  it("rejects input longer than 100 characters", () => {
    expect(validateSearch({ lastName: "a".repeat(101) })).toEqual(invalid);
    expect(validateSearch({ lastName: "smith", firstName: "a".repeat(101) })).toEqual(invalid);
    expect(validateSearch({ licenseId: "1".repeat(101) })).toEqual(invalid);
    expect(validateSearch({ lastName: "a".repeat(100) })).toEqual({ ok: true });
  });
});

describe("getPublicLicensees", () => {
  it("looks up by number, optional type, limit 25, sorted D,H,E", async () => {
    const f = fake([{ ...row, type: "H" }, row]);
    const rows = await getPublicLicensees(f.query, "2227", null);
    expect(f.calls[0].params).toEqual(["2227"]);
    expect(f.calls[0].text).toMatch(/LIMIT 25/);
    expect(rows.map((r) => r.type)).toEqual(["D", "H"]);
  });
  it("binds the type when given", async () => {
    const f = fake([]);
    await getPublicLicensees(f.query, "2227", "H");
    expect(f.calls[0].params).toEqual(["2227", "H"]);
    expect(f.calls[0].text).toMatch(/type = \$2/);
  });
});
