// Thin server-side wrapper for the public /verify pages: binds the queries in
// public-verify-query.ts to the shared POSTGRES_URL pool. No anon key involved.

import { db } from "@/lib/db";
import {
  getPublicLicensees as getPublicLicenseesWith,
  searchPublicLicensees as searchPublicLicenseesWith,
  type PgQueryFn,
  type SearchParams,
  type SearchResult,
} from "@/lib/public-verify-query";
import type { LicenseType, PublicLicensee } from "@/lib/public-verify-helpers";

export {
  TYPE_LABEL,
  STATUS_LABEL,
  TYPE_ORDER,
  MAX_RESULTS,
  groupByType,
  isExpired,
  isValidLicenseId,
  licenseDetailHref,
  parseLicenseType,
  resolveSearchInput,
  sortByTypeOrder,
} from "@/lib/public-verify-helpers";
export type { LicenseType, PublicLicensee } from "@/lib/public-verify-helpers";
export { validateSearch } from "@/lib/public-verify-query";
export type { SearchParams, SearchResult } from "@/lib/public-verify-query";

const pgQuery: PgQueryFn = async (text, params) =>
  (await db.$client.query(text, [...params])).rows;

export function searchPublicLicensees(p: SearchParams): Promise<SearchResult> {
  return searchPublicLicenseesWith(pgQuery, p);
}

export function getPublicLicensees(
  licenseId: string,
  type?: LicenseType | null
): Promise<PublicLicensee[]> {
  return getPublicLicenseesWith(pgQuery, licenseId, type);
}
