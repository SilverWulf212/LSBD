// Permit listing for the staff read-only screens. Relative imports only (vitest has no `@/`).
import type { RoQueryFn } from "./db/lsbd-ro";
import { formatPersonName } from "./staff-labels";
import {
  cleanText, parsePage, rowIso, rowNum, rowStr, runPaged, type Paged, type RawSearchParams,
} from "./staff-query";

export type PermitKind = "personal" | "office";

/** The Access rule: a permit with a positive office id belongs to an office. */
export function permitKind(officeId: number | null): PermitKind {
  return officeId !== null && officeId > 0 ? "office" : "personal";
}

export type PermitFilters = { kind: PermitKind | ""; type: string; level: string; page: number };

export function parsePermitFilters(sp: RawSearchParams): PermitFilters {
  const kind = cleanText(sp.kind, 10).toLowerCase();
  return {
    kind: kind === "personal" || kind === "office" ? kind : "",
    type: cleanText(sp.type),
    level: cleanText(sp.level, 20),
    page: parsePage(sp.page),
  };
}

export type PermitRow = {
  id: number;
  kind: PermitKind;
  typeName: string | null;
  /** Only says whether permit_type_id matched the lookup row. Do not show "not linked" for the type when typeName is present. */
  typeLinked: boolean;
  level: string | null;
  description: string | null;
  issueDate: string | null;
  dentistId: number | null;
  holderKey: number | null;
  holderName: string | null;
  holderLicenseNumber: string | null;
  holderType: string | null;
  officeId: number | null;
  firmId: number | null;
  firmName: string | null;
};

/** CR1: the firm of an office permit is professional_llc.id = permits.office_id (504 of 552 match). */
export const PERMIT_FIRM_JOIN = "LEFT JOIN lsbd.professional_llc f ON pm.office_id > 0 AND f.id = pm.office_id";

// R5: the permit's own name wins; the permit_type lookup labels are stale. Defined once.
const TYPE_EXPR = "COALESCE(nullif(btrim(pm.permit_type_name), ''), pt.permit_type)";
const LEVEL_EXPR = "nullif(upper(btrim(pm.permit_level)), '')";

const SELECT = `SELECT pm.id, pm.permit_type_id, ${TYPE_EXPR} AS type_name,
       pt.id AS linked_type_id, ${LEVEL_EXPR} AS permit_level, pm.description, pm.issue_date, pm.dentist_id, pm.office_id,
       p.legacy_key AS holder_key, p.last_name, p.first_name, p.middle_name, p.suffix,
       l.license_id AS holder_license_id, l.type AS holder_type,
       f.id AS firm_id, f.est_name AS firm_name`;
const FROM = `FROM lsbd.permits pm
LEFT JOIN lsbd.permit_type pt ON pt.id = pm.permit_type_id
LEFT JOIN lsbd.person p ON p.legacy_key = pm.dentist_id
LEFT JOIN lsbd.license l ON l.legacy_key = p.legacy_key
${PERMIT_FIRM_JOIN}`;
const LIST_ORDER = "ORDER BY p.last_name NULLS LAST, p.first_name NULLS LAST, pm.id";

function mapPermit(r: Record<string, unknown>): PermitRow {
  const holderKey = rowNum(r.holder_key);
  const officeId = rowNum(r.office_id);
  return {
    id: rowNum(r.id) as number,
    kind: permitKind(officeId),
    typeName: rowStr(r.type_name),
    typeLinked: rowNum(r.permit_type_id) !== null && r.linked_type_id !== null,
    level: rowStr(r.permit_level),
    description: rowStr(r.description),
    issueDate: rowIso(r.issue_date),
    dentistId: rowNum(r.dentist_id),
    holderKey,
    holderName:
      holderKey === null
        ? null
        : formatPersonName({
            lastName: rowStr(r.last_name),
            firstName: rowStr(r.first_name),
            middleName: rowStr(r.middle_name),
            suffix: rowStr(r.suffix),
          }),
    holderLicenseNumber: rowStr(r.holder_license_id),
    holderType: rowStr(r.holder_type),
    officeId,
    firmId: rowNum(r.firm_id),
    firmName: rowStr(r.firm_name),
  };
}

export function listPermits(q: RoQueryFn, f: PermitFilters): Promise<Paged<PermitRow>> {
  const where: string[] = [];
  const params: unknown[] = [];
  const bind = (v: unknown) => `$${params.push(v)}`;

  if (f.kind === "office") where.push("pm.office_id > 0");
  else if (f.kind === "personal") where.push("(pm.office_id IS NULL OR pm.office_id <= 0)");
  if (f.type) where.push(`lower(${TYPE_EXPR}) = lower(${bind(f.type)})`);
  if (f.level) where.push(`upper(btrim(pm.permit_level)) = upper(${bind(f.level)})`);

  const sql = `${SELECT},\n       count(*) OVER() AS total\n${FROM}${where.length ? `\nWHERE ${where.join(" AND ")}` : ""}\n${LIST_ORDER}`;
  return runPaged(q, sql, params, f.page, mapPermit);
}

export async function permitFilterOptions(q: RoQueryFn): Promise<{ types: string[]; levels: string[] }> {
  // One option per lower-cased name, shown with its most common spelling.
  const types = await q(
    `SELECT name FROM (SELECT DISTINCT ON (lower(t.name)) t.name, t.n FROM (SELECT ${TYPE_EXPR} AS name, count(*) AS n FROM lsbd.permits pm LEFT JOIN lsbd.permit_type pt ON pt.id = pm.permit_type_id WHERE ${TYPE_EXPR} IS NOT NULL GROUP BY 1) t ORDER BY lower(t.name), t.n DESC, t.name) s ORDER BY lower(name), name LIMIT 200`,
  );
  const levels = await q(
    "SELECT DISTINCT upper(btrim(permit_level)) AS permit_level FROM lsbd.permits WHERE nullif(btrim(permit_level), '') IS NOT NULL ORDER BY 1 LIMIT 200",
  );
  return {
    types: types.map((r) => String(r.name)),
    levels: levels.map((r) => String(r.permit_level)),
  };
}

export async function permitsForHolder(q: RoQueryFn, legacyKey: number): Promise<PermitRow[]> {
  const rows = await q(
    `${SELECT}\n${FROM}\nWHERE pm.dentist_id = $1\nORDER BY pm.issue_date DESC NULLS LAST, pm.id\nLIMIT 200`,
    [legacyKey],
  );
  return rows.map(mapPermit);
}

export async function permitsForFirm(q: RoQueryFn, firmId: number): Promise<PermitRow[]> {
  const rows = await q(
    `${SELECT}\n${FROM}\nWHERE pm.office_id = $1 AND pm.office_id > 0\n${LIST_ORDER}\nLIMIT 500`,
    [firmId],
  );
  return rows.map(mapPermit);
}
