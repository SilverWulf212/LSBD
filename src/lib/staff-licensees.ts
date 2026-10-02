// Licensee search for the staff read-only screens. Relative imports only (vitest has no `@/`).
import type { RoQueryFn } from "./db/lsbd-ro";
import { escapeLike } from "./sql-like";
import { LICENSE_STATUSES, LICENSE_TYPES, type StaffLicenseStatus, type StaffLicenseType } from "./staff-labels";
import {
  cleanText, parsePage, rowIso, rowNum, rowStr, runPaged, type Paged, type RawSearchParams,
} from "./staff-query";

export type LicenseeFilters = {
  last: string;
  first: string;
  number: string;
  type: StaffLicenseType | "";
  status: StaffLicenseStatus | "none" | "";
  city: string;
  page: number;
};

export function parseLicenseeFilters(sp: RawSearchParams): LicenseeFilters {
  const type = cleanText(sp.type, 10).toUpperCase();
  const status = cleanText(sp.status, 10).toUpperCase();
  return {
    last: cleanText(sp.last),
    first: cleanText(sp.first),
    number: cleanText(sp.number, 20),
    type: (LICENSE_TYPES as readonly string[]).includes(type) ? (type as StaffLicenseType) : "",
    status:
      status === "NONE"
        ? "none"
        : (LICENSE_STATUSES as readonly string[]).includes(status)
          ? (status as StaffLicenseStatus)
          : "",
    city: cleanText(sp.city),
    page: parsePage(sp.page),
  };
}

export type LicenseeListRow = {
  key: number;
  lastName: string | null;
  firstName: string | null;
  middleName: string | null;
  suffix: string | null;
  hasLicence: boolean;
  licenseNumber: string | null;
  type: string | null;
  status: string | null;
  class: string | null;
  dateUntil: string | null;
  officeCity: string | null;
  duplicateCount: number;
};

// Starts from person so a person without a licence still lists. City is the office address.
// Keep the scalar subqueries on single lines: the only line starting with WHERE is the outer filter.
const BASE = `SELECT p.legacy_key, p.last_name, p.first_name, p.middle_name, p.suffix,
       l.id AS license_row_id, l.license_id, l.type, l.status, l.class, l.date_until,
       (SELECT a.city FROM lsbd.person_address a WHERE a.person_id = p.id AND a.address_type = 'office') AS office_city,
       (SELECT count(*) FROM lsbd.license d WHERE d.type = l.type AND d.license_id = l.license_id) AS duplicate_count,
       count(*) OVER() AS total
FROM lsbd.person p
LEFT JOIN lsbd.license l ON l.legacy_key = p.legacy_key`;
// Some source names start with a carriage return or space; sort on the trimmed value.
const ORDER =
  "ORDER BY btrim(p.last_name, E' \\t\\r\\n') NULLS LAST, btrim(p.first_name, E' \\t\\r\\n') NULLS LAST, p.legacy_key";
// The SQL text carries one backslash between the quotes.
const ESC = " ESCAPE '\\'";

export function searchLicensees(q: RoQueryFn, f: LicenseeFilters): Promise<Paged<LicenseeListRow>> {
  const where: string[] = [];
  const params: unknown[] = [];
  const bind = (v: unknown) => `$${params.push(v)}`;

  if (f.last) {
    const n = bind(`${escapeLike(f.last)}%`);
    where.push(`(p.last_name ILIKE ${n}${ESC} OR p.married_name ILIKE ${n}${ESC})`);
  }
  if (f.first) where.push(`p.first_name ILIKE ${bind(`${escapeLike(f.first)}%`)}${ESC}`);
  if (f.number) where.push(`l.license_id = ${bind(f.number)}`);
  if (f.type) where.push(`l.type = ${bind(f.type)}`);
  if (f.status === "none") where.push("l.id IS NOT NULL AND l.status IS NULL");
  else if (f.status) where.push(`l.status = ${bind(f.status)}`);
  if (f.city) {
    where.push(
      `EXISTS (SELECT 1 FROM lsbd.person_address a WHERE a.person_id = p.id AND a.address_type = 'office' AND a.city ILIKE ${bind(`${escapeLike(f.city)}%`)}${ESC})`,
    );
  }

  const sql = `${BASE}${where.length ? `\nWHERE ${where.join(" AND ")}` : ""}\n${ORDER}`;
  return runPaged(q, sql, params, f.page, (r) => ({
    key: rowNum(r.legacy_key) as number,
    lastName: rowStr(r.last_name),
    firstName: rowStr(r.first_name),
    middleName: rowStr(r.middle_name),
    suffix: rowStr(r.suffix),
    hasLicence: r.license_row_id !== null && r.license_row_id !== undefined,
    licenseNumber: rowStr(r.license_id),
    type: rowStr(r.type),
    status: rowStr(r.status),
    class: rowStr(r.class),
    dateUntil: rowIso(r.date_until),
    officeCity: rowStr(r.office_city),
    duplicateCount: rowNum(r.duplicate_count) ?? 0,
  }));
}
