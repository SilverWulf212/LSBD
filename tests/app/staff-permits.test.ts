import { describe, expect, it } from "vitest";
import {
  FIRM_PERMITS_LIMIT, HOLDER_PERMITS_LIMIT, PERMIT_FIRM_JOIN, listPermits, parsePermitFilters, permitFilterOptions, permitKind, permitsForFirm,
  permitsForHolder, type PermitFilters,
} from "../../src/lib/staff-permits";
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

const NONE: PermitFilters = { kind: "", type: "", level: "", page: 1 };
const ROW = { id: 1, permit_type_id: 2, type_name: "Nitrous", permit_level: "P", office_id: null, total: 1 };

describe("staff-permits", () => {
  it("splits personal and office on office_id > 0", () => {
    expect(permitKind(null)).toBe("personal");
    expect(permitKind(0)).toBe("personal");
    expect(permitKind(-1)).toBe("personal");
    expect(permitKind(3810)).toBe("office");
  });

  it("parses the filters", () => {
    expect(parsePermitFilters({ kind: "OFFICE", type: " Nitrous ", level: "P", page: "2" }))
      .toEqual({ kind: "office", type: "Nitrous", level: "P", page: 2 });
    expect(parsePermitFilters({ kind: "both" })).toMatchObject({ kind: "" });
  });

  it("filters office permits with office_id > 0 and personal with the complement", async () => {
    const a = fake([]);
    await listPermits(a.query, { ...NONE, kind: "office" });
    expect(a.calls[0].text).toContain("WHERE pm.office_id > 0");
    expect(a.calls[0].params).toEqual([0]);
    const b = fake([]);
    await listPermits(b.query, { ...NONE, kind: "personal" });
    expect(b.calls[0].text).toContain("(pm.office_id IS NULL OR pm.office_id <= 0)");
    expect(b.calls[0].params).toEqual([0]);
  });

  it("binds type and level and compares the type by its fallback name", async () => {
    const f = fake([]);
    await listPermits(f.query, { ...NONE, type: "Nitrous", level: "P" });
    expect(f.calls[0].params).toEqual(["Nitrous", "P", 0]);
    expect(f.calls[0].text).toContain("lower(COALESCE(nullif(btrim(pm.permit_type_name), ''), pt.permit_type)) = lower($1)");
    expect(f.calls[0].text).toContain("upper(btrim(pm.permit_level)) = upper($2)");
    expect(f.calls[0].text).toMatch(/ORDER BY p\.last_name NULLS LAST, p\.first_name NULLS LAST, pm\.id\n/);
  });

  it("falls back to permits.permit_type_name when the type link is NULL", async () => {
    const f = fake([{ ...ROW, permit_type_id: null, linked_type_id: null, type_name: "General Anesthesia" }]);
    const r = await listPermits(f.query, NONE);
    expect(r.rows[0]).toMatchObject({ typeName: "General Anesthesia", typeLinked: false });
  });

  it("reports a dangling type id as not linked and a matched one as linked", async () => {
    const f = fake([{ ...ROW, permit_type_id: 99, linked_type_id: null }, { ...ROW, linked_type_id: 2 }]);
    const r = await listPermits(f.query, NONE);
    expect(r.rows.map((x) => x.typeLinked)).toEqual([false, true]);
  });

  it("reports a missing type as null, not a guess", async () => {
    const f = fake([{ ...ROW, permit_type_id: null, linked_type_id: null, type_name: null }]);
    const r = await listPermits(f.query, NONE);
    expect(r.rows[0]).toMatchObject({ typeName: null, typeLinked: false });
  });

  it("marks the holder not linked for a NULL or dangling dentist_id", async () => {
    const f = fake([
      { ...ROW, dentist_id: null, holder_key: null },
      { ...ROW, dentist_id: 99999, holder_key: null },
    ]);
    const r = await listPermits(f.query, NONE);
    expect(r.rows[0]).toMatchObject({ holderKey: null, holderName: null, dentistId: null });
    expect(r.rows[1]).toMatchObject({ holderKey: null, holderName: null, dentistId: 99999 });
  });

  it("names a linked holder last-first and classifies the row", async () => {
    const f = fake([
      {
        ...ROW, dentist_id: "12345", holder_key: "12345", last_name: "SMITH", first_name: "John",
        holder_license_id: "2227", holder_type: "D", office_id: "3810", firm_id: 3810, firm_name: "Smile LLC",
        issue_date: new Date("2020-01-02T00:00:00Z"),
      },
      { ...ROW, office_id: 77, firm_id: null, firm_name: null },
    ]);
    const r = await listPermits(f.query, NONE);
    expect(r.rows[0]).toMatchObject({
      holderName: "SMITH, John", holderKey: 12345, holderLicenseNumber: "2227", holderType: "D",
      kind: "office", officeId: 3810, firmId: 3810, firmName: "Smile LLC", issueDate: "2020-01-02T00:00:00.000Z",
    });
    // A firm miss keeps the raw office id and no firm.
    expect(r.rows[1]).toMatchObject({ kind: "office", officeId: 77, firmId: null, firmName: null });
  });

  it("uses the one firm join constant", async () => {
    const f = fake([], [], [], []);
    await listPermits(f.query, NONE);
    await permitsForHolder(f.query, 1);
    await permitsForFirm(f.query, 1);
    for (const c of f.calls) {
      expect(c.text).toContain("f.est_name");
      expect(c.text).toContain(PERMIT_FIRM_JOIN);
    }
  });

  it("binds the holder key / firm id", async () => {
    const f = fake([], []);
    await permitsForHolder(f.query, 12345);
    await permitsForFirm(f.query, 3810);
    expect(f.calls[0].params).toEqual([12345]);
    expect(f.calls[0].text).toContain("WHERE pm.dentist_id = $1");
    expect(f.calls[0].text).toMatch(/LIMIT 201$/);
    expect(f.calls[1].params).toEqual([3810]);
    expect(f.calls[1].text).toContain("WHERE pm.office_id = $1 AND pm.office_id > 0");
    expect(f.calls[1].text).toMatch(/LIMIT 501$/);
  });

  it("reports a cut holder or firm permit list", async () => {
    const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ ...ROW, id: i + 1 }));
    const a = fake(rows(HOLDER_PERMITS_LIMIT + 1), rows(HOLDER_PERMITS_LIMIT));
    const cut = await permitsForHolder(a.query, 1);
    expect(cut.truncated).toBe(true);
    expect(cut.rows).toHaveLength(HOLDER_PERMITS_LIMIT);
    expect((await permitsForHolder(a.query, 1)).truncated).toBe(false);
    const b = fake(rows(FIRM_PERMITS_LIMIT + 1));
    const firm = await permitsForFirm(b.query, 1);
    expect(firm.truncated).toBe(true);
    expect(firm.rows).toHaveLength(FIRM_PERMITS_LIMIT);
  });

  it("upper-cases and trims the level filter", () => {
    expect(parsePermitFilters({ level: " p " }).level).toBe("P");
  });

  it("returns sorted distinct filter options", async () => {
    const f = fake([{ name: "General Anesthesia" }, { name: "Nitrous" }], [{ permit_level: "P" }]);
    expect(await permitFilterOptions(f.query)).toEqual({ types: ["General Anesthesia", "Nitrous"], levels: ["P"] });
    expect(f.calls).toHaveLength(2);
    expect(f.calls[0].text).toContain("ORDER BY lower(name), name");
  });
});

describe("staff-permits fix round 1 (own name wins)", () => {
  it("shows the permit's own name when the lookup name differs", async () => {
    const f = fake([{ ...ROW, type_name: "Moderate", linked_type_id: 2 }]);
    const r = await listPermits(f.query, NONE);
    expect(r.rows[0]).toMatchObject({ typeName: "Moderate", typeLinked: true });
    expect(f.calls[0].text).toContain("COALESCE(nullif(btrim(pm.permit_type_name), ''), pt.permit_type) AS type_name");
    expect(f.calls[0].text).toContain("pt.id AS linked_type_id");
  });

  it("falls back to the lookup name when the own name is NULL or blank (SQL and row)", async () => {
    const f = fake([{ ...ROW, type_name: "Enteral", linked_type_id: 3 }]);
    const r = await listPermits(f.query, NONE);
    expect(r.rows[0].typeName).toBe("Enteral");
    expect(f.calls[0].text).toMatch(/COALESCE\(nullif\(btrim\(pm\.permit_type_name\), ''\), pt\.permit_type\)/);
  });

  it("computes typeLinked from the lookup row id, not its name", async () => {
    const f = fake([{ ...ROW, type_name: "Local", linked_type_id: null }, { ...ROW, linked_type_id: 7 }]);
    const r = await listPermits(f.query, NONE);
    expect(r.rows.map((x) => x.typeLinked)).toEqual([false, true]);
  });

  it("returns the level upper-cased and trimmed in SQL", async () => {
    const f = fake([{ ...ROW, permit_level: "P" }]);
    const r = await listPermits(f.query, NONE);
    expect(r.rows[0].level).toBe("P");
    expect(f.calls[0].text).toContain("upper(btrim(pm.permit_level))");
  });

  it("binds case-insensitive filters without interpolating", async () => {
    const f = fake([]);
    await listPermits(f.query, { ...NONE, type: "nitrous'x", level: "p" });
    expect(f.calls[0].params).toEqual(["nitrous'x", "p", 0]);
    expect(f.calls[0].text).not.toContain("nitrous");
    expect(f.calls[0].text).toContain("= lower($1)");
    expect(f.calls[0].text).toContain("= upper($2)");
  });

  it("bounds and dedupes the option queries", async () => {
    const f = fake([], []);
    await permitFilterOptions(f.query);
    expect(f.calls[0].text).toContain("DISTINCT ON (lower(");
    expect(f.calls[0].text).toMatch(/LIMIT 200$/);
    expect(f.calls[1].text).toContain("upper(btrim(permit_level))");
    expect(f.calls[1].text).toMatch(/LIMIT 200$/);
  });

  it("sends no semicolon in any SQL", async () => {
    const f = fake([], [], [], [], []);
    await listPermits(f.query, { kind: "office", type: "a", level: "b", page: 1 });
    await permitFilterOptions(f.query);
    await permitsForHolder(f.query, 1);
    await permitsForFirm(f.query, 1);
    for (const c of f.calls) expect(c.text).not.toContain(";");
  });
});
