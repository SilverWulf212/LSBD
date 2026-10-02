// The only non-pure staff module: binds the pure loaders to the read-only transaction.
// D3: the capability check comes first; the withStaffRo callback holds the pool's only
// connection, so nothing inside it may wait for another one.
import { withStaffRo } from "@/lib/db/lsbd-ro";
import { requireCapability } from "@/lib/auth-utils";
import { can } from "@/lib/auth-capabilities";
import { parseLicenseeFilters, searchLicensees, type LicenseeFilters, type LicenseeListRow } from "@/lib/staff-licensees";
import {
  loadLicenseeDetail, parseLicenseeKey, type DetailCaps, type LicenseeDetail,
} from "@/lib/staff-licensee-detail";
import type { Paged, RawSearchParams } from "@/lib/staff-query";

export async function getLicenseeList(
  sp: RawSearchParams,
): Promise<{ filters: LicenseeFilters; result: Paged<LicenseeListRow> }> {
  await requireCapability("licensees.read");
  const filters = parseLicenseeFilters(sp);
  const result = await withStaffRo((q) => searchLicensees(q, filters));
  return { filters, result };
}

/** null for a malformed key or a key with no person row. */
export async function getLicenseeDetail(
  rawKey: string,
): Promise<{ detail: LicenseeDetail; caps: DetailCaps } | null> {
  const session = await requireCapability("licensees.read");
  const key = parseLicenseeKey(rawKey);
  if (key === null) return null;
  const caps: DetailCaps = {
    contact: can(session.user.role, "pii.read"),
    discipline: can(session.user.role, "discipline.read"),
  };
  const detail = await withStaffRo((q) => loadLicenseeDetail(q, key, caps));
  return detail ? { detail, caps } : null;
}
