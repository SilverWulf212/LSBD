// Professional LLC ("firm") list and detail for the staff read-only screens.
// Relative imports only (vitest has no `@/`).
import type { RoQueryFn } from "./db/lsbd-ro";
import { escapeLike } from "./sql-like";
import { parseLicenseeKey } from "./staff-licensee-detail";
import {
  cleanText, parsePage, rowIso, rowNum, rowStr, runPaged, type Paged, type RawSearchParams,
} from "./staff-query";

export type FirmFilters = { name: string; number: string; city: string; status: string; page: number };

export function parseFirmFilters(sp: RawSearchParams): FirmFilters {
  return {
    name: cleanText(sp.name),
    number: cleanText(sp.number, 20),
    city: cleanText(sp.city),
    status: cleanText(sp.status, 20),
    page: parsePage(sp.page),
  };
}

export type FirmListRow = {
  id: number;
  number: string | null;
  name: string | null;
  status: string | null;
  type: string | null;
  city: string | null;
  state: string | null;
  dateUntil: string | null;
};

export type FirmDetail = FirmListRow & {
  dateSince: string | null;
  dateRenew: string | null;
  dateUpdated: string | null;
  regYear: string | null;
  addrName1: string | null;
  addrName2: string | null;
  address1: string | null;
  address2: string | null;
  address3: string | null;
  zip: string | null;
  county: string | null;
  phone1: string | null;
  ext1: string | null;
  phone2: string | null;
  ext2: string | null;
  fax: string | null;
  email: string | null;
  url: string | null;
  location: string | null;
  officeId: number | null;
};

/** Same rule as parseLicenseeKey: a positive 32-bit integer, no leading zeros. */
export function parseFirmId(raw: string): number | null {
  return parseLicenseeKey(raw);
}

function mapFirmRow(r: Record<string, unknown>): FirmListRow {
  return {
    id: rowNum(r.id) as number,
    number: rowStr(r.license_id),
    name: rowStr(r.est_name),
    status: rowStr(r.status),
    type: rowStr(r.type),
    city: rowStr(r.city),
    state: rowStr(r.state),
    dateUntil: rowIso(r.date_until),
  };
}

const LIST_COLUMNS = "id, license_id, est_name, status, type, city, state, date_until";

// The detail query names its columns; free-text columns are deliberately not among them (D8).
const DETAIL_COLUMNS = `${LIST_COLUMNS},
       date_since, date_renew, date_updated, reg_year,
       addr_name1, addr_name2, address1, address2, address3, zip, county,
       phone1, ext1, phone2, ext2, fax, email, url, location, office_id`;

export function listFirms(q: RoQueryFn, f: FirmFilters): Promise<Paged<FirmListRow>> {
  const where: string[] = [];
  const params: unknown[] = [];
  const bind = (v: unknown) => `$${params.push(v)}`;

  if (f.name) where.push(`est_name ILIKE ${bind(`%${escapeLike(f.name)}%`)}`);
  if (f.number) where.push(`license_id = ${bind(f.number)}`);
  if (f.city) where.push(`city ILIKE ${bind(`${escapeLike(f.city)}%`)}`);
  if (f.status) where.push(`status = ${bind(f.status)}`);

  const sql = `SELECT ${LIST_COLUMNS}, count(*) OVER() AS total
FROM lsbd.professional_llc${where.length ? `\nWHERE ${where.join(" AND ")}` : ""}
ORDER BY est_name NULLS LAST, id`;
  return runPaged(q, sql, params, f.page, mapFirmRow);
}

export async function firmStatusOptions(q: RoQueryFn): Promise<string[]> {
  const rows = await q("SELECT DISTINCT status FROM lsbd.professional_llc WHERE status IS NOT NULL ORDER BY 1");
  return rows.map((r) => String(r.status));
}

export async function getFirm(q: RoQueryFn, id: number): Promise<FirmDetail | null> {
  const rows = await q(`SELECT ${DETAIL_COLUMNS}\nFROM lsbd.professional_llc\nWHERE id = $1`, [id]);
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    ...mapFirmRow(r),
    dateSince: rowIso(r.date_since),
    dateRenew: rowIso(r.date_renew),
    dateUpdated: rowIso(r.date_updated),
    regYear: rowStr(r.reg_year),
    addrName1: rowStr(r.addr_name1),
    addrName2: rowStr(r.addr_name2),
    address1: rowStr(r.address1),
    address2: rowStr(r.address2),
    address3: rowStr(r.address3),
    zip: rowStr(r.zip),
    county: rowStr(r.county),
    phone1: rowStr(r.phone1),
    ext1: rowStr(r.ext1),
    phone2: rowStr(r.phone2),
    ext2: rowStr(r.ext2),
    fax: rowStr(r.fax),
    email: rowStr(r.email),
    url: rowStr(r.url),
    location: rowStr(r.location),
    officeId: rowNum(r.office_id),
  };
}

export async function countProfessionalAssociations(q: RoQueryFn): Promise<number> {
  const rows = await q("SELECT count(*) AS n FROM lsbd.professional_association");
  return rowNum(rows[0]?.n) ?? 0;
}
