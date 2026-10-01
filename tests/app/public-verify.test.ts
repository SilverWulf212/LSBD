import { describe, it, expect } from "vitest";
import {
  parseLicenseType,
  groupByType,
  sortByTypeOrder,
  isExpired,
  licenseDetailHref,
  resolveSearchInput,
  isValidLicenseId,
  PUBLIC_LICENSEE_COLUMNS,
  type LicenseType,
} from "../../src/lib/public-verify-helpers";

const row = (type: LicenseType, tag: string) => ({ type, license_id: "2227", tag });

describe("parseLicenseType", () => {
  it("accepts D/H/E in any case and rejects everything else", () => {
    expect(parseLicenseType("D")).toBe("D");
    expect(parseLicenseType("h")).toBe("H");
    expect(parseLicenseType(" e ")).toBe("E");
    expect(parseLicenseType(["H", "D"])).toBe("H");
    expect(parseLicenseType("X")).toBeNull();
    expect(parseLicenseType("all")).toBeNull();
    expect(parseLicenseType(undefined)).toBeNull();
    expect(parseLicenseType("")).toBeNull();
  });
});

describe("groupByType", () => {
  it("groups in D, H, E order with labels and omits empty types", () => {
    const g = groupByType([row("E", "e1"), row("D", "d1"), row("H", "h1")]);
    expect(g.map((x) => [x.type, x.label, x.rows.map((r) => r.tag)])).toEqual([
      ["D", "Dentist", ["d1"]],
      ["H", "Hygienist", ["h1"]],
      ["E", "EDDA", ["e1"]],
    ]);
    expect(groupByType([row("H", "h1")]).map((x) => x.type)).toEqual(["H"]);
    expect(groupByType([])).toEqual([]);
  });

  it("keeps same-type duplicates (never silently picks one)", () => {
    const g = groupByType([row("E", "e1"), row("E", "e2"), row("H", "h1")]);
    expect(g).toHaveLength(2);
    expect(g[1].type).toBe("E");
    expect(g[1].rows.map((r) => r.tag)).toEqual(["e1", "e2"]);
  });
});

describe("sortByTypeOrder", () => {
  it("sorts D, H, E and is stable within a type", () => {
    const s = sortByTypeOrder([row("E", "e1"), row("H", "h1"), row("E", "e2"), row("D", "d1")]);
    expect(s.map((r) => r.tag)).toEqual(["d1", "h1", "e1", "e2"]);
  });
});

describe("isExpired (Central calendar day)", () => {
  const until = "2026-12-31T06:00:00+00:00"; // Dec 31, 2026 00:00 CST
  it("is not expired on the expiry day itself", () => {
    expect(isExpired(until, new Date("2026-12-31T20:00:00Z"))).toBe(false); // 2 PM Dec 31 CST
    expect(isExpired(until, new Date("2027-01-01T05:30:00Z"))).toBe(false); // 11:30 PM Dec 31 CST
  });
  it("is expired from the next Central day", () => {
    expect(isExpired(until, new Date("2027-01-01T06:30:00Z"))).toBe(true); // 12:30 AM Jan 1 CST
  });
  it("treats the 3000-10-10 no-expiry sentinel and null as not expired", () => {
    expect(isExpired("3000-10-10T05:00:00+00:00", new Date("2026-09-30T12:00:00Z"))).toBe(false);
    expect(isExpired(null, new Date())).toBe(false);
  });
});

describe("licenseDetailHref", () => {
  it("includes the type when known and encodes the number", () => {
    expect(licenseDetailHref("2227", "H")).toBe("/public/verify/2227?type=H");
    expect(licenseDetailHref("2227")).toBe("/public/verify/2227");
    expect(licenseDetailHref("A 1/2", null)).toBe("/public/verify/A%201%2F2");
  });
});

describe("resolveSearchInput", () => {
  it("maps a numeric q to a license-number search", () => {
    expect(resolveSearchInput({ q: " 2227 " })).toEqual({
      licenseId: "2227",
      lastName: "",
      firstName: "",
      type: "all",
      page: 1,
    });
  });
  it("maps an alphabetic q to a last-name search", () => {
    expect(resolveSearchInput({ q: "smith" }).lastName).toBe("smith");
    expect(resolveSearchInput({ q: "smith" }).licenseId).toBe("");
  });
  it("lets explicit fields win over q", () => {
    expect(resolveSearchInput({ q: "999", license_id: "2227" }).licenseId).toBe("2227");
    expect(resolveSearchInput({ q: "999", last_name: "Doe" }).licenseId).toBe("");
  });
  it("validates type and page", () => {
    expect(resolveSearchInput({ type: "h" }).type).toBe("H");
    expect(resolveSearchInput({ type: "x; drop" }).type).toBe("all");
    expect(resolveSearchInput({ page: "3" }).page).toBe(3);
    expect(resolveSearchInput({ page: "-2" }).page).toBe(1);
    expect(resolveSearchInput({ page: "abc" }).page).toBe(1);
  });
  it("resolveSearchInput takes the first of repeated params and clamps the page", () => {
    const r = resolveSearchInput({ q: ["smith", "jones"], page: "999", type: ["h", "d"] });
    expect(r.lastName).toBe("smith");
    expect(r.page).toBe(4);
    expect(r.type).toBe("H");
  });
  it("isValidLicenseId", () => {
    expect(isValidLicenseId("2227")).toBe(true);
    expect(isValidLicenseId("unknown-12345")).toBe(true);
    expect(isValidLicenseId("%E0")).toBe(false);
    expect(isValidLicenseId("")).toBe(false);
    expect(isValidLicenseId("a".repeat(21))).toBe(false);
  });
});

describe("PUBLIC_LICENSEE_COLUMNS", () => {
  it("is exactly the legacy public field list (no PII, no internal keys)", () => {
    expect(PUBLIC_LICENSEE_COLUMNS.split(",")).toEqual([
      "license_id", "type", "status", "action", "date_since", "date_until",
      "first_name", "middle_name", "last_name", "license_name", "suffix", "prefix",
    ]);
  });
});
