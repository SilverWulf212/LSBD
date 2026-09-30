import { supabaseAnon } from "@/lib/supabase-anon";
import {
  PUBLIC_LICENSEE_COLUMNS,
  sortByTypeOrder,
  type LicenseType,
  type PublicLicensee,
} from "@/lib/public-verify-helpers";

export {
  TYPE_LABEL,
  STATUS_LABEL,
  TYPE_ORDER,
  groupByType,
  isExpired,
  licenseDetailHref,
  parseLicenseType,
  resolveSearchInput,
  sortByTypeOrder,
} from "@/lib/public-verify-helpers";
export type { LicenseType, PublicLicensee } from "@/lib/public-verify-helpers";

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

const PAGE_SIZE = 15;
export const MAX_RESULTS = 50;

/** Upper bound for rows sharing one license number (all types + duplicates). */
const MAX_PER_NUMBER = 25;

/**
 * Validate a search request. Must have either a license number OR
 * a last-name prefix ≥ 2 chars. Empty searches return null (the caller
 * should render an empty-state, not run the query).
 */
export function validateSearch(p: SearchParams): { ok: true } | { ok: false; reason: string } {
  const lic = (p.licenseId ?? "").trim();
  const last = (p.lastName ?? "").trim();
  if (!lic && last.length < 2) {
    return { ok: false, reason: "Enter a license number, or at least 2 characters of last name." };
  }
  return { ok: true };
}

export async function searchPublicLicensees(p: SearchParams): Promise<SearchResult> {
  const page = Math.max(1, p.page ?? 1);
  let q = supabaseAnon
    .from("public_licensee")
    .select(PUBLIC_LICENSEE_COLUMNS, { count: "exact" });

  const lic = (p.licenseId ?? "").trim();
  if (lic) q = q.eq("license_id", lic);

  const last = (p.lastName ?? "").trim();
  if (last) q = q.ilike("last_name", `${last}%`);

  const first = (p.firstName ?? "").trim();
  if (first) q = q.ilike("first_name", `${first}%`);

  if (p.type && p.type !== "all") q = q.eq("type", p.type);

  const offset = (page - 1) * PAGE_SIZE;
  // A license-number search can match several types (D/H/E share number
  // ranges); order by type first so they appear together.
  if (lic) q = q.order("type", { ascending: true });
  q = q
    .order("last_name", { ascending: true, nullsFirst: false })
    .order("first_name", { ascending: true, nullsFirst: false })
    .order("date_since", { ascending: true, nullsFirst: false })
    .range(offset, offset + PAGE_SIZE - 1);

  const { data, count, error } = await q;
  if (error) {
    throw new Error(`Search failed: ${error.message}`);
  }

  const total = count ?? 0;
  const capped = Math.min(total, MAX_RESULTS);
  const lastPage = Math.max(1, Math.ceil(capped / PAGE_SIZE));
  const safePage = Math.min(page, lastPage);

  const rows = (data ?? []) as unknown as PublicLicensee[];
  return {
    rows: lic ? sortByTypeOrder(rows) : rows,
    total: capped,
    page: safePage,
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
  licenseId: string,
  type?: LicenseType | null
): Promise<PublicLicensee[]> {
  let q = supabaseAnon
    .from("public_licensee")
    .select(PUBLIC_LICENSEE_COLUMNS)
    .eq("license_id", licenseId);
  if (type) q = q.eq("type", type);
  const { data, error } = await q
    .order("type", { ascending: true })
    .order("date_since", { ascending: true, nullsFirst: false })
    .limit(MAX_PER_NUMBER);
  if (error) throw new Error(`Lookup failed: ${error.message}`);
  return sortByTypeOrder((data ?? []) as unknown as PublicLicensee[]);
}
