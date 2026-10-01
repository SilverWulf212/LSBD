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

export async function searchPublicLicensees(query: PgQueryFn, p: SearchParams): Promise<SearchResult> {
  const page = Math.min(LAST_PAGE, Math.max(1, Math.floor(p.page ?? 1) || 1));
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
  // ranges); order by type first so they appear together.
  const text = `SELECT ${COLUMNS}, count(*) OVER() AS total
FROM public.public_licensee
${where.length ? `WHERE ${where.join(" AND ")}` : ""}
ORDER BY ${lic ? "type, " : ""}last_name NULLS LAST, first_name NULLS LAST, date_since NULLS LAST
LIMIT ${PAGE_SIZE} OFFSET ${bind((page - 1) * PAGE_SIZE)}`;

  const data = await query(text, params);

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
