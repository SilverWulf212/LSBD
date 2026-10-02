// The one file to change when the Board confirms what each code means.
// Codes come from lsbd.license (type/status/class enums); an unknown code is
// always shown as the code itself, never hidden.

export const LICENSE_TYPES = ["D", "H", "E", "O"] as const;
export const LICENSE_STATUSES = [
  "ACT", "SUS", "REV", "REP", "ARC", "PRB", "DEC", "EXP", "OTH", "TMP", "INA", "RET", "VOL",
] as const;
export const LICENSE_CLASSES = ["L", "A", "I", "P", "T", "O", "C", "V", "NL"] as const;

export type StaffLicenseType = (typeof LICENSE_TYPES)[number];
export type StaffLicenseStatus = (typeof LICENSE_STATUSES)[number];
export type StaffLicenseClass = (typeof LICENSE_CLASSES)[number];

export const TYPE_LABELS: Record<StaffLicenseType, string> = {
  D: "Dentist",
  H: "Hygienist",
  E: "EDDA",
  O: "Office",
};

// Labels from tbl_status (controller ruling CR5).
export const STATUS_LABELS: Partial<Record<StaffLicenseStatus, string>> = {
  ACT: "Active",
  SUS: "Suspended",
  REV: "Revoked",
  REP: "Reprimanded",
  ARC: "Archived",
  PRB: "Probation",
  DEC: "Deceased",
  EXP: "Expired",
  OTH: "Other",
  TMP: "Temporary",
  INA: "Inactive",
  RET: "Retired",
  VOL: "Voluntary",
};

// Labels from tbl_class (controller ruling CR5).
export const CLASS_LABELS: Partial<Record<StaffLicenseClass, string>> = {
  L: "Licensee",
  A: "Applicant",
  I: "Intern",
  P: "Provisional",
  T: "Instructor",
  O: "Other",
  C: "Credentialing",
  V: "Volunteer",
  NL: "Non-Licensee",
};

export const ADDRESS_TYPE_LABELS = {
  home: "Home",
  office: "Office",
  permanent: "Permanent",
} as const;

export const NO_STATUS_LABEL = "No status";
export const NOT_LINKED_TEXT = "not linked";

function lookup(map: Partial<Record<string, string>>, code: string | null, empty: string): string {
  if (code === null || code === "") return empty;
  return map[code] ?? code;
}

export function typeLabel(code: string | null): string {
  return lookup(TYPE_LABELS, code, "—");
}

export function statusLabel(code: string | null): string {
  return lookup(STATUS_LABELS, code, NO_STATUS_LABEL);
}

export function classLabel(code: string | null): string {
  return lookup(CLASS_LABELS, code, "—");
}

/** "LAST, First Middle, Suffix"; falls back gracefully when parts are missing. */
export function formatPersonName(p: {
  lastName: string | null;
  firstName: string | null;
  middleName?: string | null;
  suffix?: string | null;
}): string {
  const given = [p.firstName, p.middleName].filter(Boolean).join(" ");
  const parts = [p.lastName, given, p.suffix].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "(no name on record)";
}
