// Queries behind the public /verify pages.
//
// Reads public.public_licensee through the server-side POSTGRES_URL connection
// (src/lib/db), never the anon key. The query executor is injected so this is
// unit-testable without a database (see tests/app/public-verify-query.test.ts).
// User input reaches SQL only as a bound parameter.

import { escapeLike } from "./sql-like";
import {
  LAST_PAGE,
  MAX_RESULTS,
  PAGE_SIZE,
  PUBLIC_LICENSEE_COLUMNS,
  sortByTypeOrder,
  type LicenseType,
  type PublicLicensee,
} from "./public-verify-helpers";

export type PgQueryFn = (
  text: string,
  params: readonly unknown[]
) => Promise<readonly Record<string, unknown>[]>;

export interface SearchParams {
  licenseId?: string;
  lastName?: string;
  firstName?: string;
  type?: LicenseType | "all";
  page?: number;
}

export interface SearchResult {
  rows: PublicLicensee[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/** Upper bound for rows sharing one license number (all types + duplicates). */
const MAX_PER_NUMBER = 25;

const COLUMNS = PUBLIC_LICENSEE_COLUMNS.split(",").join(", ");

function toStr(v: unknown): string | null {
  return v === null || v === undefined ? null : String(v);
}

// timestamptz columns arrive as Date; the public type keeps ISO strings.
function toIso(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  return v instanceof Date ? v.toISOString() : String(v);
}

function mapRow(r: Record<string, unknown>): PublicLicensee {
  return {
    license_id: String(r.license_id),
    type: r.type as LicenseType,
    status: r.status as PublicLicensee["status"],
    action: toStr(r.action),
    date_since: toIso(r.date_since),
    date_until: toIso(r.date_until),
    first_name: toStr(r.first_name),
    middle_name: toStr(r.middle_name),
    last_name: toStr(r.last_name),
    license_name: toStr(r.license_name),
    suffix: toStr(r.suffix),
    prefix: toStr(r.prefix),
  };
}

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;
const MAX_INPUT_LENGTH = 100;

/**
 * Validate a search request. Must have either a license number OR
 * a last-name prefix ≥ 2 chars, and no field may hold control characters
 * (Postgres rejects NUL in text) or run past 100 characters.
 */
export function validateSearch(p: SearchParams): { ok: true } | { ok: false; reason: string } {
  for (const v of [p.licenseId, p.lastName, p.firstName]) {
    if (v && (v.length > MAX_INPUT_LENGTH || CONTROL_CHARS.test(v))) {
      return { ok: false, reason: "Enter a valid name or license number." };
    }
  }
  const lic = (p.licenseId ?? "").trim();
  const last = (p.lastName ?? "").trim();
  if (!lic && last.length < 2) {
    return { ok: false, reason: "Enter a license number, or at least 2 characters of last name." };
  }
  return { ok: true };
}

export async function searchPublicLicensees(query: PgQueryFn, p: SearchParams): Promise<SearchResult> {
  let page = Math.min(LAST_PAGE, Math.max(1, Math.floor(p.page ?? 1) || 1));
  const params: unknown[] = [];
  const where: string[] = [];
  const bind = (v: unknown) => `$${params.push(v)}`;

  const lic = (p.licenseId ?? "").trim();
  if (lic) where.push(`license_id = ${bind(lic)}`);

  const last = (p.lastName ?? "").trim();
  if (last) where.push(`last_name ILIKE ${bind(escapeLike(last) + "%")}`);

  const first = (p.firstName ?? "").trim();
  if (first) where.push(`first_name ILIKE ${bind(escapeLike(first) + "%")}`);

  if (p.type && p.type !== "all") where.push(`type = ${bind(p.type)}`);

  // A license-number search can match several types (D/H/E share number
  // ranges); order by type first so they appear together. The limit keeps a
  // page inside the MAX_RESULTS cap (the last page holds only what is left).
  const offsetRef = `$${params.length + 1}`;
  const run = (offset: number) =>
    query(
      `SELECT ${COLUMNS}, count(*) OVER() AS total
FROM public.public_licensee
${where.length ? `WHERE ${where.join(" AND ")}` : ""}
ORDER BY ${lic ? "type, " : ""}last_name NULLS LAST, first_name NULLS LAST, date_since NULLS LAST
LIMIT ${Math.min(PAGE_SIZE, MAX_RESULTS - offset)} OFFSET ${offsetRef}`,
      [...params, offset]
    );

  let data = await run((page - 1) * PAGE_SIZE);
  // A page past the last row returns nothing, and so no total: show page 1
  // rather than "no matches" for licensees who exist.
  if (data.length === 0 && page > 1) {
    page = 1;
    data = await run(0);
  }

  // count(*) OVER() is a bigint, which arrives as a string.
  const total = data.length ? Number(data[0].total) || 0 : 0;
  const capped = Math.min(total, MAX_RESULTS);
  const lastPage = Math.max(1, Math.ceil(capped / PAGE_SIZE));

  const rows = data.map(mapRow);
  return {
    rows: lic ? sortByTypeOrder(rows) : rows,
    total: capped,
    page: Math.min(page, lastPage),
    pageSize: PAGE_SIZE,
    hasMore: total > MAX_RESULTS,
  };
}

/**
 * Every public record holding `licenseId`, optionally narrowed to one type.
 * Returns ALL matches (sorted D, H, E) — several types can share a number,
 * and a few (type, number) pairs are genuine duplicates; the caller must
 * show them all rather than pick one.
 */
export async function getPublicLicensees(
  query: PgQueryFn,
  licenseId: string,
  type?: LicenseType | null
): Promise<PublicLicensee[]> {
  const params: unknown[] = [licenseId];
  if (type) params.push(type);
  const text = `SELECT ${COLUMNS}
FROM public.public_licensee
WHERE license_id = $1${type ? " AND type = $2" : ""}
ORDER BY type, date_since NULLS LAST
LIMIT ${MAX_PER_NUMBER}`;
  const data = await query(text, params);
  return sortByTypeOrder(data.map(mapRow));
}
