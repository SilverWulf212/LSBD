import { describe, expect, it } from "vitest";
import { licenseTypeEnum, licenseStatusEnum, licenseClassEnum } from "../../src/lib/db/lsbd/core";
import {
  LICENSE_CLASSES,
  LICENSE_STATUSES,
  LICENSE_TYPES,
  classLabel,
  formatPersonName,
  statusLabel,
  typeLabel,
} from "../../src/lib/staff-labels";

describe("staff labels", () => {
  it("lists exactly the database enum values", () => {
    expect([...LICENSE_TYPES]).toEqual(licenseTypeEnum.enumValues);
    expect([...LICENSE_STATUSES]).toEqual(licenseStatusEnum.enumValues);
    expect([...LICENSE_CLASSES]).toEqual(licenseClassEnum.enumValues);
  });

  it("shows Object.prototype names as the code, not a function", () => {
    for (const code of ["constructor", "toString", "__proto__"]) {
      expect(statusLabel(code)).toBe(code);
      expect(classLabel(code)).toBe(code);
      expect(typeLabel(code)).toBe(code);
    }
  });

  it("labels every status and class code (CR5)", () => {
    expect(LICENSE_STATUSES.map(statusLabel)).toEqual([
      "Active", "Suspended", "Revoked", "Reprimanded", "Archived", "Probation", "Deceased",
      "Expired", "Other", "Temporary", "Inactive", "Retired", "Voluntary",
    ]);
    expect(LICENSE_CLASSES.map(classLabel)).toEqual([
      "Licensee", "Applicant", "Intern", "Provisional", "Instructor", "Other",
      "Credentialing", "Volunteer", "Non-Licensee",
    ]);
  });

  it("falls back to the code, then to a placeholder", () => {
    expect(statusLabel("ACT")).toBe("Active");
    expect(statusLabel("REV")).toBe("Revoked");
    expect(statusLabel("ZZZ")).toBe("ZZZ");
    expect(statusLabel(null)).toBe("No status");
    expect(typeLabel("E")).toBe("EDDA");
    expect(typeLabel("Q")).toBe("Q");
    expect(typeLabel(null)).toBe("—");
    expect(classLabel("NL")).toBe("Non-Licensee");
    expect(classLabel("ZZ")).toBe("ZZ");
    expect(classLabel(null)).toBe("—");
  });

  it("formats names last-first", () => {
    expect(formatPersonName({ lastName: "SMITH", firstName: "John", middleName: "A", suffix: "Jr" })).toBe("SMITH, John A, Jr");
    expect(formatPersonName({ lastName: "SMITH", firstName: null })).toBe("SMITH");
    expect(formatPersonName({ lastName: null, firstName: "John" })).toBe("John");
    expect(formatPersonName({ lastName: null, firstName: null })).toBe("(no name on record)");
  });
});
