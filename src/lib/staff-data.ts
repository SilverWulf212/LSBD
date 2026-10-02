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
import {
  listPermits, parsePermitFilters, permitFilterOptions, permitsForFirm, type PermitFilters, type PermitList, type PermitRow,
} from "@/lib/staff-permits";
import {
  countProfessionalAssociations, firmStatusOptions, getFirm, listFirms, parseFirmFilters, parseFirmId,
  type FirmDetail, type FirmFilters, type FirmListRow,
} from "@/lib/staff-firms";
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

export async function getPermitList(sp: RawSearchParams): Promise<{
  filters: PermitFilters;
  options: { types: string[]; levels: string[] };
  result: Paged<PermitRow>;
}> {
  await requireCapability("permits.read");
  const filters = parsePermitFilters(sp);
  const { options, result } = await withStaffRo(async (q) => ({
    options: await permitFilterOptions(q),
    result: await listPermits(q, filters),
  }));
  return { filters, options, result };
}

export async function getFirmList(sp: RawSearchParams): Promise<{
  filters: FirmFilters;
  statuses: string[];
  associationCount: number;
  result: Paged<FirmListRow>;
}> {
  await requireCapability("permits.read");
  const filters = parseFirmFilters(sp);
  const { statuses, associationCount, result } = await withStaffRo(async (q) => ({
    statuses: await firmStatusOptions(q),
    associationCount: await countProfessionalAssociations(q),
    result: await listFirms(q, filters),
  }));
  return { filters, statuses, associationCount, result };
}

/** null for a malformed id or an id with no firm row. CR3: no licensee-by-number section. */
export async function getFirmDetail(
  rawId: string,
): Promise<{ firm: FirmDetail; permits: PermitList } | null> {
  await requireCapability("permits.read");
  const id = parseFirmId(rawId);
  if (id === null) return null;
  return withStaffRo(async (q) => {
    const firm = await getFirm(q, id);
    if (!firm) return null;
    return { firm, permits: await permitsForFirm(q, id) };
  });
}
