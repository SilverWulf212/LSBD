import { describe, expect, it } from "vitest";
import {
  countProfessionalAssociations, firmStatusOptions, getFirm, listFirms, parseFirmFilters, parseFirmId,
  type FirmFilters,
} from "../../src/lib/staff-firms";
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

const NONE: FirmFilters = { name: "", number: "", city: "", status: "", page: 1 };

describe("staff-firms", () => {
  it("parses the filters", () => {
    expect(parseFirmFilters({ name: " smile ", page: "abc" })).toEqual({
      name: "smile", number: "", city: "", status: "", page: 1,
    });
  });

  it("parses a firm id like a licensee key", () => {
    expect(parseFirmId("3810")).toBe(3810);
    expect(parseFirmId("0")).toBeNull();
    expect(parseFirmId("007")).toBeNull();
    expect(parseFirmId("1 OR 1")).toBeNull();
  });

  it("searches the name as an escaped contains match", async () => {
    const f = fake([]);
    await listFirms(f.query, { ...NONE, name: "100%_dental", city: "Baton" });
    expect(f.calls[0].params).toEqual(["%100\\%\\_dental%", "Baton%", 0]);
    expect(f.calls[0].text).toContain("FROM lsbd.professional_llc");
    expect(f.calls[0].text).toContain("est_name ILIKE $1 ESCAPE '\\'");
    expect(f.calls[0].text).toContain("city ILIKE $2 ESCAPE '\\'");
  });

  it("filters number and status exactly", async () => {
    const f = fake([]);
    await listFirms(f.query, { ...NONE, number: "160179", status: "CUR" });
    expect(f.calls[0].params).toEqual(["160179", "CUR", 0]);
    expect(f.calls[0].text).toContain("license_id = $1");
    expect(f.calls[0].text).toContain("btrim(status) = $2");
  });

  it("lists everyone when no filter is set", async () => {
    const f = fake([]);
    await listFirms(f.query, NONE);
    expect(f.calls[0].text).not.toMatch(/\nWHERE /);
    expect(f.calls[0].params).toEqual([0]);
  });

  it("orders by name with a unique tie-break", async () => {
    const f = fake([]);
    await listFirms(f.query, NONE);
    expect(f.calls[0].text).toMatch(/ORDER BY est_name NULLS LAST, id\n/);
  });

  it("maps a list row and reads the total", async () => {
    const f = fake([
      {
        id: "3810", license_id: "160179", est_name: "X", status: "CUR", type: "PLLC", city: "Baton Rouge",
        state: "LA", date_until: new Date("2027-01-01T00:00:00Z"), total: "2",
      },
    ]);
    const r = await listFirms(f.query, NONE);
    expect(r.total).toBe(2);
    expect(r.rows[0]).toEqual({
      id: 3810, number: "160179", name: "X", status: "CUR", type: "PLLC", city: "Baton Rouge", state: "LA",
      dateUntil: "2027-01-01T00:00:00.000Z",
    });
  });

  it("never selects notes or comments", async () => {
    const f = fake([], [], [], []);
    await listFirms(f.query, { ...NONE, name: "a", number: "1", city: "c", status: "s" });
    await firmStatusOptions(f.query);
    await getFirm(f.query, 1);
    await countProfessionalAssociations(f.query);
    for (const c of f.calls) {
      expect(c.text).not.toContain("notes");
      expect(c.text).not.toContain("comment");
    }
  });

  it("returns null for an unknown firm", async () => {
    const f = fake([]);
    expect(await getFirm(f.query, 3810)).toBeNull();
    expect(f.calls[0].params).toEqual([3810]);
    expect(f.calls[0].text).toContain("WHERE id = $1");
  });

  it("maps a firm", async () => {
    const f = fake([
      {
        id: 3810, license_id: "160179", est_name: "X", status: "CUR", type: "PLLC", city: "Baton Rouge", state: "LA",
        date_until: new Date("2027-01-01T00:00:00Z"), date_since: new Date("2010-05-01T00:00:00Z"),
        office_id: "12", phone1: "555", email: null,
      },
    ]);
    const r = await getFirm(f.query, 3810);
    expect(r).toMatchObject({
      id: 3810, dateUntil: "2027-01-01T00:00:00.000Z", dateSince: "2010-05-01T00:00:00.000Z",
      officeId: 12, phone1: "555", email: null, dateRenew: null,
    });
  });

  it("lists distinct statuses", async () => {
    const f = fake([{ status: "CUR" }, { status: "INA" }]);
    expect(await firmStatusOptions(f.query)).toEqual(["CUR", "INA"]);
    expect(f.calls[0].text).toContain("DISTINCT btrim(status)");
    expect(f.calls[0].text).toContain("nullif(btrim(status), '') IS NOT NULL");
  });

  it("counts professional associations", async () => {
    expect(await countProfessionalAssociations(fake([{ n: "0" }]).query)).toBe(0);
    expect(await countProfessionalAssociations(fake([{ n: "7" }]).query)).toBe(7);
  });
});
