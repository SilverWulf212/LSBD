import { describe, expect, it } from "vitest";
import { getPublicLicensees, searchPublicLicensees, type PgQueryFn } from "../../src/lib/public-verify-query";

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
});

describe("getPublicLicensees", () => {
  it("looks up by number, optional type, limit 25, sorted D,H,E", async () => {
    const f = fake([{ ...row, type: "H" }, row]);
    const rows = await getPublicLicensees(f.query, "2227", null);
    expect(f.calls[0].params).toEqual(["2227"]);
    expect(f.calls[0].text).toMatch(/LIMIT 25/);
    expect(rows.map((r) => r.type)).toEqual(["D", "H"]);
  });
});
