import { describe, expect, it } from "vitest";
import { parseLicenseeFilters, searchLicensees, type LicenseeFilters } from "../../src/lib/staff-licensees";
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

const NONE: LicenseeFilters = { last: "", first: "", number: "", type: "", status: "", city: "", page: 1 };

describe("staff-licensees", () => {
  it("parses and validates the filters", () => {
    expect(parseLicenseeFilters({ last: ["smith", "x"], type: "d", status: "cur", city: " Baton ", page: "-3" }))
      .toEqual({ last: "smith", first: "", number: "", type: "D", status: "", city: "Baton", page: 1 });
    expect(parseLicenseeFilters({ status: "NONE", type: "X" })).toMatchObject({ status: "none", type: "" });
    expect(parseLicenseeFilters({ status: "prb", page: "772" })).toMatchObject({ status: "PRB", page: 772 });
  });

  it("binds input as parameters and escapes LIKE wildcards", async () => {
    const f = fake([]);
    await searchLicensees(f.query, { ...NONE, last: "%", first: "a_b", city: "50%" });
    const { text, params } = f.calls[0];
    expect(params).toEqual(["\\%%", "a\\_b%", "50\\%%", 0]);
    expect(text).not.toContain("a_b");
    expect(text).toContain("p.married_name ILIKE");
    expect(text).toContain("a.address_type = 'office'");
  });

  it("lists everyone when no filter is set", async () => {
    const f = fake([]);
    await searchLicensees(f.query, NONE);
    const { text, params } = f.calls[0];
    expect(text).not.toMatch(/\nWHERE /);
    expect(params).toEqual([0]);
    expect(text).toMatch(/LIMIT 25 OFFSET \$1$/);
  });

  it("filters number, type and status exactly", async () => {
    const f = fake([]);
    await searchLicensees(f.query, { ...NONE, number: "2227", type: "H", status: "ACT" });
    expect(f.calls[0].params).toEqual(["2227", "H", "ACT", 0]);
    expect(f.calls[0].text).toContain("l.license_id = $1");
    expect(f.calls[0].text).toContain("l.type = $2");
    expect(f.calls[0].text).toContain("l.status = $3");
  });

  it("filters licences with no status without a parameter", async () => {
    const f = fake([]);
    await searchLicensees(f.query, { ...NONE, status: "none" });
    expect(f.calls[0].text).toContain("l.id IS NOT NULL AND l.status IS NULL");
    expect(f.calls[0].params).toEqual([0]);
  });

  it("orders with a unique tie-break", async () => {
    const f = fake([]);
    await searchLicensees(f.query, NONE);
    expect(f.calls[0].text).toMatch(
      /ORDER BY p\.last_name NULLS LAST, p\.first_name NULLS LAST, p\.legacy_key\n/,
    );
  });

  it("binds offset 19275 for page 772", async () => {
    const f = fake([{ legacy_key: 1, total: "1" }]);
    await searchLicensees(f.query, { ...NONE, page: 772 });
    expect(f.calls[0].params).toEqual([19275]);
  });

  it("sends a single statement", async () => {
    const f = fake([]);
    await searchLicensees(f.query, { ...NONE, last: "a;b", city: "x" });
    expect(f.calls[0].text).not.toContain(";");
  });

  it("keeps a person who has no licence row", async () => {
    const f = fake([{
      legacy_key: 77, last_name: "DOE", first_name: null, middle_name: null, suffix: null, license_row_id: null,
      license_id: null, type: null, status: null, class: null, date_until: null, office_city: null,
      duplicate_count: "0", total: "1",
    }]);
    const r = await searchLicensees(f.query, NONE);
    expect(r.rows[0]).toMatchObject({ key: 77, hasLicence: false, licenseNumber: null, duplicateCount: 0 });
    expect(r.total).toBe(1);
  });

  it("maps a licence row", async () => {
    const f = fake([{
      legacy_key: 5, last_name: "SMITH", first_name: "ANN", middle_name: "B", suffix: "JR", license_row_id: 9,
      license_id: "2227", type: "H", status: "ACT", class: "L", date_until: new Date("2027-01-31T00:00:00Z"),
      office_city: "BATON ROUGE", duplicate_count: "2", total: "40",
    }]);
    const r = await searchLicensees(f.query, NONE);
    expect(r.rows[0]).toEqual({
      key: 5, lastName: "SMITH", firstName: "ANN", middleName: "B", suffix: "JR", hasLicence: true,
      licenseNumber: "2227", type: "H", status: "ACT", class: "L", dateUntil: "2027-01-31T00:00:00.000Z",
      officeCity: "BATON ROUGE", duplicateCount: 2,
    });
    expect(r.rows[0]).not.toHaveProperty("total");
    expect(r.total).toBe(40);
  });
});
