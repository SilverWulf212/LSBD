import { describe, expect, it } from "vitest";
import {
  EDUCATION_NOT_LINKED_MESSAGE, loadLicenseeCore, loadLicenseeDetail, loadLicenseeRelations, NO_INDIVIDUAL_REASON,
  parseLicenseeKey, type LicenseeCore,
} from "../../src/lib/staff-licensee-detail";
import type { RoQueryFn } from "../../src/lib/db/lsbd-ro";

const UUID = "11111111-2222-3333-4444-555555555555";
const ALL = { contact: true, discipline: true };
const NO_PII = { contact: false, discipline: false };

const person = {
  person_id: 7, legacy_key: 12345, individual_id: UUID, first_name: "Ann", middle_name: null, last_name: "Smith",
  license_name: null, married_name: null, prefix: null, suffix: null, use_license_name: false,
  email: "a@x.org", url: null, phone1: "555", ext1: null, phone2: null, ext2: null, fax: "556",
  license_row_id: 9, license_id: "2227", type: "D", class: "L", status: "ACT",
  date_since: new Date("2001-05-15T05:00:00Z"), date_inactive: null, date_reinstate: null, date_renew: null,
  date_until: new Date("2027-01-01T06:00:00Z"), reg_year: 2026, renew_month: 12, permit_number: null,
  is_current: true, action: null, credential_exam: null, duplicate_count: "2",
};

/** Answers by matching a substring of the SQL text; unmatched queries return []. */
function fakeFor(personRow: Record<string, unknown> | null, answers: Record<string, Record<string, unknown>[]> = {}) {
  const calls: { text: string; params: readonly unknown[] }[] = [];
  const query: RoQueryFn = async (text, params = []) => {
    calls.push({ text, params });
    if (text.includes("FROM lsbd.person p\n")) return personRow ? [personRow] : [];
    for (const [needle, rows] of Object.entries(answers)) if (text.includes(needle)) return rows;
    return [];
  };
  return { query, calls, textMatching: (n: string) => calls.find((c) => c.text.includes(n))?.text ?? "" };
}

describe("staff-licensee-detail", () => {
  it("accepts only a positive 32-bit integer key", () => {
    expect(parseLicenseeKey("12345")).toBe(12345);
    for (const v of ["0", "-1", "1.5", "abc", "", "01", "2147483648", "1 OR 1=1", "%25E0"]) {
      expect(parseLicenseeKey(v)).toBeNull();
    }
  });

  it("returns null for an unknown key after one query", async () => {
    const f = fakeFor(null);
    expect(await loadLicenseeCore(f.query, 999, ALL)).toBeNull();
    expect(f.calls).toHaveLength(1);
    expect(f.calls[0].params).toEqual([999]);
  });

  it("renders a person who has no licence row", async () => {
    const f = fakeFor({ ...person, license_row_id: null, license_id: null, type: null, status: null });
    const core = await loadLicenseeCore(f.query, 12345, ALL);
    expect(core!.licence).toBeNull();
    expect(core!.person.lastName).toBe("Smith");
    expect(core!.addresses).toEqual([]);
    expect(core!.education.rows).toEqual([]);
  });

  it("does not query or return contact fields without pii.read", async () => {
    const f = fakeFor(person);
    const core = await loadLicenseeCore(f.query, 12345, NO_PII);
    expect(core!.contact).toBeNull();
    expect(f.calls[0].text).not.toMatch(/email|phone1|fax/);
    expect(f.textMatching("lsbd.person_address")).toContain("address_type = 'office'");
  });

  it("returns contact fields and every address with pii.read", async () => {
    const f = fakeFor(person, {
      "lsbd.person_address": [
        { address_type: "home", line1: "1 Main", line2: null, line3: null, city: "Baton Rouge", state: "LA", zip: "70801", county: null, country: null },
      ],
    });
    const core = await loadLicenseeCore(f.query, 12345, ALL);
    expect(core!.contact).toMatchObject({ email: "a@x.org", phone1: "555", fax: "556" });
    expect(f.textMatching("lsbd.person_address")).not.toContain("address_type = 'office'");
    expect(core!.addresses).toEqual([
      { type: "home", line1: "1 Main", line2: null, line3: null, city: "Baton Rouge", state: "LA", zip: "70801", county: null, country: null },
    ]);
  });

  it("never selects pa_number or pllc_number", async () => {
    const f = fakeFor(person);
    await loadLicenseeCore(f.query, 12345, ALL);
    for (const c of f.calls) expect(c.text).not.toMatch(/pa_number|pllc_number|SELECT \*|\.\*/);
  });

  it("says other licences cannot be looked up when individual_id is NULL", async () => {
    const f = fakeFor({ ...person, individual_id: null });
    const core = await loadLicenseeCore(f.query, 12345, ALL);
    expect(core!.otherLicences).toEqual({ linked: false, reason: NO_INDIVIDUAL_REASON });
    expect(f.calls.some((c) => c.text.includes("p2.individual_id"))).toBe(false);
  });

  it("lists other licences of the same individual, excluding this one", async () => {
    const f = fakeFor(person, {
      "p2.individual_id": [{ legacy_key: 222, license_id: "88", type: "E", status: "ACT", date_until: null }],
    });
    const core = await loadLicenseeCore(f.query, 12345, ALL);
    expect(f.calls.find((c) => c.text.includes("p2.individual_id"))!.params).toEqual([UUID, 12345]);
    expect(core!.otherLicences).toEqual({
      linked: true,
      rows: [{ key: 222, licenseNumber: "88", type: "E", status: "ACT", dateUntil: null }],
    });
  });

  it("returns the licence-record school and the not-linked message", async () => {
    const f = fakeFor(person, {
      "lsbd.person_education": [{ school_name: "LSU", school_state: "LA", grad_year: 2001, degree: 3 }],
    });
    const core = await loadLicenseeCore(f.query, 12345, ALL);
    expect(f.calls.find((c) => c.text.includes("lsbd.person_education"))!.params).toEqual([7]);
    expect(core!.education.rows).toEqual([
      { source: "licence-record", school: "LSU", state: "LA", year: 2001, degree: "3" },
    ]);
    expect(core!.education.message).toBe(EDUCATION_NOT_LINKED_MESSAGE);
    expect(core!.education.message).toBe("Detailed education history is not linked to licensees yet.");
  });

  it("never queries lsbd.education or education_type (CR4)", async () => {
    const f = fakeFor(person);
    await loadLicenseeCore(f.query, 12345, ALL);
    for (const c of f.calls) {
      expect(c.text).not.toMatch(/lsbd\.education\b/);
      expect(c.text).not.toMatch(/education_type|den_hyg_id/);
    }
  });

  it("carries duplicateCount onto the licence", async () => {
    const f = fakeFor(person);
    const core = await loadLicenseeCore(f.query, 12345, ALL);
    expect(core!.licence!.duplicateCount).toBe(2);
    expect(core!.licence!.status).toBe("ACT");
  });

  it("sends only single statements", async () => {
    const f = fakeFor(person);
    await loadLicenseeCore(f.query, 12345, ALL);
    for (const c of f.calls) expect(c.text).not.toContain(";");
  });
});

function coreOf(individualId: string | null): LicenseeCore {
  return {
    person: {
      key: 12345, personId: 7, individualId, firstName: "Ann", middleName: null, lastName: "Smith",
      licenseName: null, marriedName: null, prefix: null, suffix: null, useLicenseName: false,
    },
    contact: null, licence: null, otherLicences: { linked: false, reason: NO_INDIVIDUAL_REASON },
    addresses: [], education: { rows: [], detailNotLinked: true, message: EDUCATION_NOT_LINKED_MESSAGE },
  };
}
const withIndividual = coreOf(UUID);
const noIndividual = coreOf(null);

describe("relations", () => {
  it("sends no discipline query without discipline.read", async () => {
    const f = fakeFor(null);
    const r = await loadLicenseeRelations(f.query, withIndividual, { contact: true, discipline: false });
    expect(r.discipline).toBe("hidden");
    expect(f.calls.some((c) => c.text.includes("lsbd.disciplinary"))).toBe(false);
  });

  it("says discipline cannot be looked up when individual_id is NULL", async () => {
    const f = fakeFor(null);
    const r = await loadLicenseeRelations(f.query, noIndividual, ALL);
    expect(r.discipline).toEqual({ linked: false, reason: NO_INDIVIDUAL_REASON });
    expect(f.calls.some((c) => c.text.includes("lsbd.disciplinary"))).toBe(false);
  });

  it("loads discipline by the individual uuid, newest first", async () => {
    const f = fakeFor(null, {
      "lsbd.disciplinary": [{ start_date: new Date("2020-03-01T06:00:00Z"), end_date: null, good_standing: false, notes: "Reprimand" }],
    });
    const r = await loadLicenseeRelations(f.query, withIndividual, ALL);
    const c = f.calls.find((x) => x.text.includes("lsbd.disciplinary"))!;
    expect(c.params).toEqual([UUID]);
    expect(c.text).toContain("ORDER BY start_date DESC NULLS LAST, legacy_id DESC");
    expect(r.discipline).toMatchObject({ linked: true, rows: [{ goodStanding: false, notes: "Reprimand", endDate: null }] });
  });

  it("returns an empty linked list when the individual has no discipline", async () => {
    const f = fakeFor(null);
    const r = await loadLicenseeRelations(f.query, withIndividual, ALL);
    expect(r.discipline).toEqual({ linked: true, rows: [] });
  });

  it("lists affiliations in both directions", async () => {
    const f = fakeFor(null, {
      "WHERE ia.dentist_legacy_id = $1": [
        { other_key: 77, found_key: 77, last_name: "Jones", first_name: "Bo", middle_name: null, suffix: null, license_id: "55", type: "H" },
      ],
      "WHERE ia.individual_legacy_id = $1": [
        { other_key: 88, found_key: 88, last_name: "Doe", first_name: "Al", middle_name: null, suffix: null, license_id: "9", type: "D" },
      ],
    });
    const r = await loadLicenseeRelations(f.query, withIndividual, ALL);
    const aff = f.calls.filter((c) => c.text.includes("lsbd.individual_affiliation"));
    expect(aff).toHaveLength(2);
    for (const c of aff) expect(c.params).toEqual([12345]);
    expect(r.affiliations).toEqual([
      { direction: "dentist-of", otherKey: 77, otherName: "Jones, Bo", otherLicenseNumber: "55", otherType: "H" },
      { direction: "affiliated-to", otherKey: 88, otherName: "Doe, Al", otherLicenseNumber: "9", otherType: "D" },
    ]);
  });

  it("keeps an affiliation whose other person does not exist", async () => {
    const f = fakeFor(null, {
      "WHERE ia.dentist_legacy_id = $1": [
        { other_key: 4242, found_key: null, last_name: null, first_name: null, middle_name: null, suffix: null, license_id: null, type: null },
      ],
    });
    const r = await loadLicenseeRelations(f.query, withIndividual, ALL);
    expect(r.affiliations).toEqual([
      { direction: "dentist-of", otherKey: 4242, otherName: null, otherLicenseNumber: null, otherType: null },
    ]);
  });

  it("keeps an office affiliation with a NULL office", async () => {
    const f = fakeFor(null, {
      "lsbd.office_affiliation": [{ id: 5, office_permit: null, office_id: null, office_name: null, phone: null }],
    });
    const r = await loadLicenseeRelations(f.query, withIndividual, ALL);
    expect(f.calls.find((c) => c.text.includes("lsbd.office_affiliation"))!.params).toEqual([12345]);
    expect(r.offices).toEqual([{ id: 5, officePermit: null, officeId: null, officeName: null, officePhone: null }]);
  });

  it("loads permits for the holder key and has no firm-link section (CR3)", async () => {
    const f = fakeFor(null);
    const r = await loadLicenseeRelations(f.query, withIndividual, ALL);
    expect(f.calls.find((c) => c.text.includes("FROM lsbd.permits"))!.params).toEqual([12345]);
    expect(r).not.toHaveProperty("firmLinks");
    for (const c of f.calls) expect(c.text).not.toMatch(/pllc_number|pa_number|SELECT \*|\.\*/);
  });

  it("never selects individual notes or inactive_reason, and sends single statements", async () => {
    const f = fakeFor(null);
    await loadLicenseeRelations(f.query, withIndividual, ALL);
    for (const c of f.calls) {
      expect(c.text).not.toMatch(/inactive_reason|lsbd\.individual\b|\bemail\b|phone1|\bfax\b/);
      expect(c.text).not.toContain(";");
    }
  });

  it("loadLicenseeDetail returns null for an unknown key and runs one query", async () => {
    const f = fakeFor(null);
    expect(await loadLicenseeDetail(f.query, 999, ALL)).toBeNull();
    expect(f.calls).toHaveLength(1);
  });

  it("loadLicenseeDetail merges core and relations", async () => {
    const f = fakeFor(person);
    const d = await loadLicenseeDetail(f.query, 12345, ALL);
    expect(d).toHaveProperty("licence");
    expect(d).toHaveProperty("permits");
    expect(d!.discipline).toEqual({ linked: true, rows: [] });
  });
});
