// Pure helpers for the public /verify pages. No Supabase import here so the
// logic is unit-testable without env vars (see tests/app/public-verify.test.ts).
//
// License identity note: a license NUMBER is not unique. Dentists, hygienists
// and EDDAs share number ranges, and a handful of (type, number) pairs are
// genuine duplicates in the Board's records. Anything keyed on license_id
// alone is wrong; group/disambiguate by type and never silently pick a row.

import { centralDayKey } from "./central-time";

export type LicenseType = "D" | "H" | "E";

export type PublicLicensee = {
  license_id: string;
  type: LicenseType;
  status: "ACT" | "PRB";
  action: string | null;
  date_since: string | null;
  date_until: string | null;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  license_name: string | null;
  suffix: string | null;
  prefix: string | null;
};

/** Legacy public fields only — the same columns public.public_licensee exposes. */
export const PUBLIC_LICENSEE_COLUMNS =
  "license_id,type,status,action,date_since,date_until,first_name,middle_name,last_name,license_name,suffix,prefix";

export const TYPE_LABEL: Record<LicenseType, string> = {
  D: "Dentist",
  H: "Hygienist",
  E: "EDDA",
};

export const STATUS_LABEL: Record<"ACT" | "PRB", string> = {
  ACT: "Active",
  PRB: "Probation",
};

/** Display order for types sharing a license number. */
export const TYPE_ORDER: readonly LicenseType[] = ["D", "H", "E"];

/** Parse a `type` query param. Anything other than D/H/E (any case) → null. */
export function parseLicenseType(v: string | string[] | null | undefined): LicenseType | null {
  const s = (Array.isArray(v) ? v[0] : v ?? "").trim().toUpperCase();
  return s === "D" || s === "H" || s === "E" ? s : null;
}

/** Stable sort by D, H, E; preserves incoming order within a type. */
export function sortByTypeOrder<T extends { type: LicenseType }>(rows: readonly T[]): T[] {
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => TYPE_ORDER.indexOf(a.r.type) - TYPE_ORDER.indexOf(b.r.type) || a.i - b.i)
    .map((x) => x.r);
}

/** Group rows by type in D, H, E order. Empty groups are omitted; duplicates are kept. */
export function groupByType<T extends { type: LicenseType }>(
  rows: readonly T[]
): { type: LicenseType; label: string; rows: T[] }[] {
  return TYPE_ORDER.map((type) => ({
    type,
    label: TYPE_LABEL[type],
    rows: rows.filter((r) => r.type === type),
  })).filter((g) => g.rows.length > 0);
}

/**
 * True when the Central calendar day of `dateUntil` is before today's Central
 * day. A license expiring Dec 31 is still shown as current all of Dec 31.
 * Null/invalid dates are never "expired".
 */
export function isExpired(dateUntil: string | null, now: Date = new Date()): boolean {
  const until = centralDayKey(dateUntil);
  const today = centralDayKey(now);
  if (!until || !today) return false;
  return until < today;
}

/** Link to the detail page for one (type, number). */
export function licenseDetailHref(licenseId: string, type?: LicenseType | null): string {
  const base = `/public/verify/${encodeURIComponent(licenseId)}`;
  return type ? `${base}?type=${type}` : base;
}

/**
 * Normalise the /verify query string. Supports the explicit form fields
 * (license_id, last_name, first_name, type, page) and a single `q` shortcut:
 * `q` containing a digit is treated as a license number, otherwise as a
 * last-name prefix. Explicit fields win over `q`.
 */
export function resolveSearchInput(sp: {
  q?: string;
  license_id?: string;
  last_name?: string;
  first_name?: string;
  type?: string;
  page?: string;
}): {
  licenseId: string;
  lastName: string;
  firstName: string;
  type: LicenseType | "all";
  page: number;
} {
  let licenseId = (sp.license_id ?? "").trim();
  let lastName = (sp.last_name ?? "").trim();
  const q = (sp.q ?? "").trim();
  if (q && !licenseId && !lastName) {
    if (/\d/.test(q)) licenseId = q;
    else lastName = q;
  }
  return {
    licenseId,
    lastName,
    firstName: (sp.first_name ?? "").trim(),
    type: parseLicenseType(sp.type) ?? "all",
    page: Math.max(1, Math.floor(Number(sp.page ?? 1)) || 1),
  };
}
