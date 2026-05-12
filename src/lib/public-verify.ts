import { supabaseAnon } from "@/lib/supabase-anon";

export type PublicLicensee = {
  license_id: string;
  type: "D" | "H" | "E";
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

export interface SearchParams {
  licenseId?: string;
  lastName?: string;
  firstName?: string;
  type?: "D" | "H" | "E" | "all";
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
    .select(
      "license_id,type,status,action,date_since,date_until,first_name,middle_name,last_name,license_name,suffix,prefix",
      { count: "exact" }
    );

  const lic = (p.licenseId ?? "").trim();
  if (lic) q = q.eq("license_id", lic);

  const last = (p.lastName ?? "").trim();
  if (last) q = q.ilike("last_name", `${last}%`);

  const first = (p.firstName ?? "").trim();
  if (first) q = q.ilike("first_name", `${first}%`);

  if (p.type && p.type !== "all") q = q.eq("type", p.type);

  const offset = (page - 1) * PAGE_SIZE;
  q = q
    .order("last_name", { ascending: true, nullsFirst: false })
    .order("first_name", { ascending: true, nullsFirst: false })
    .range(offset, offset + PAGE_SIZE - 1);

  const { data, count, error } = await q;
  if (error) {
    throw new Error(`Search failed: ${error.message}`);
  }

  const total = count ?? 0;
  const capped = Math.min(total, MAX_RESULTS);
  const lastPage = Math.max(1, Math.ceil(capped / PAGE_SIZE));
  const safePage = Math.min(page, lastPage);

  return {
    rows: (data ?? []) as PublicLicensee[],
    total: capped,
    page: safePage,
    pageSize: PAGE_SIZE,
    hasMore: total > MAX_RESULTS,
  };
}

export async function getPublicLicensee(licenseId: string): Promise<PublicLicensee | null> {
  const { data, error } = await supabaseAnon
    .from("public_licensee")
    .select(
      "license_id,type,status,action,date_since,date_until,first_name,middle_name,last_name,license_name,suffix,prefix"
    )
    .eq("license_id", licenseId)
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return data as PublicLicensee | null;
}

export const TYPE_LABEL: Record<"D" | "H" | "E", string> = {
  D: "Dentist",
  H: "Hygienist",
  E: "EDDA",
};

export const STATUS_LABEL: Record<"ACT" | "PRB", string> = {
  ACT: "Active",
  PRB: "Probation",
};
