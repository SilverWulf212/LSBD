// Licensee detail: part 1 (person, licence, other licences, addresses, education) and part 2 (permits, affiliations, offices, discipline).
// Relative imports only (vitest has no `@/`). Every SQL string is one statement, no semicolon.
import type { RoQueryFn } from "./db/lsbd-ro";
import { formatPersonName } from "./staff-labels";
import { permitsForHolder, type PermitRow } from "./staff-permits";
import { rowBool, rowIso, rowNum, rowStr } from "./staff-query";

export type DetailCaps = { contact: boolean; discipline: boolean }; // contact = pii.read, discipline = discipline.read
export type Linked<T> = { linked: true; rows: T[] } | { linked: false; reason: string };

export type LicenseePerson = {
  key: number;
  personId: number;
  individualId: string | null;
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  licenseName: string | null;
  marriedName: string | null;
  prefix: string | null;
  suffix: string | null;
  useLicenseName: boolean;
};
export type LicenseeContact = {
  email: string | null;
  url: string | null;
  phone1: string | null;
  ext1: string | null;
  phone2: string | null;
  ext2: string | null;
  fax: string | null;
};
// CR3: no paNumber / pllcNumber (a licence has no reliable firm link).
export type LicenceRecord = {
  licenseNumber: string;
  type: string | null;
  class: string | null;
  status: string | null;
  dateSince: string | null;
  dateInactive: string | null;
  dateReinstate: string | null;
  dateRenew: string | null;
  dateUntil: string | null;
  regYear: string | null;
  renewMonth: string | null;
  permitNumber: string | null;
  isCurrent: boolean | null;
  action: string | null;
  credentialExam: string | null;
  duplicateCount: number;
};
export type OtherLicence = {
  key: number;
  licenseNumber: string;
  type: string | null;
  status: string | null;
  dateUntil: string | null;
};
export type AddressRow = {
  type: "home" | "office" | "permanent";
  line1: string | null;
  line2: string | null;
  line3: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  county: string | null;
  country: string | null;
};
// CR4: only the licence-record school; the detailed education table is not linked to licensees.
export type EducationRow = {
  source: "licence-record";
  school: string | null;
  state: string | null;
  year: number | null;
  degree: string | null;
};
export type EducationSection = { rows: EducationRow[]; detailNotLinked: true; message: string };
export type LicenseeCore = {
  person: LicenseePerson;
  contact: LicenseeContact | null;
  licence: LicenceRecord | null;
  otherLicences: Linked<OtherLicence>;
  addresses: AddressRow[];
  education: EducationSection;
};

export const NO_INDIVIDUAL_REASON =
  "This record has no link to an individual record, so this cannot be looked up here. Check Access.";
export const EDUCATION_NOT_LINKED_MESSAGE = "Detailed education history is not linked to licensees yet.";

/** Positive 32-bit integer only; anything else (including leading zeros) is null. */
export function parseLicenseeKey(raw: string): number | null {
  if (!/^[1-9]\d{0,9}$/.test(raw)) return null;
  const n = Number(raw);
  return n <= 2147483647 ? n : null;
}

const CONTACT_COLUMNS = "p.email, p.url, p.phone1, p.ext1, p.phone2, p.ext2, p.fax";

function personSql(withContact: boolean): string {
  return `SELECT p.id AS person_id, p.legacy_key, p.individual_id::text AS individual_id,
       p.first_name, p.middle_name, p.last_name, p.license_name, p.married_name, p.prefix, p.suffix, p.use_license_name,${withContact ? `\n       ${CONTACT_COLUMNS},` : ""}
       l.id AS license_row_id, l.license_id, l.type::text AS type, l.class::text AS class, l.status::text AS status,
       l.date_since, l.date_inactive, l.date_reinstate, l.date_renew, l.date_until,
       l.reg_year, l.renew_month, l.permit_number, l.is_current, l.action, l.credential_exam,
       (SELECT count(*) FROM lsbd.license d WHERE d.type = l.type AND d.license_id = l.license_id) AS duplicate_count
FROM lsbd.person p
LEFT JOIN lsbd.license l ON l.legacy_key = p.legacy_key
WHERE p.legacy_key = $1`;
}

const OTHER_LICENCES_SQL = `SELECT p2.legacy_key, l2.license_id, l2.type::text AS type, l2.status::text AS status, l2.date_until
FROM lsbd.person p2
JOIN lsbd.license l2 ON l2.legacy_key = p2.legacy_key
WHERE p2.individual_id = $1 AND p2.legacy_key <> $2
ORDER BY l2.type, l2.date_since NULLS LAST
LIMIT 50`;

function addressSql(withContact: boolean): string {
  return `SELECT address_type::text AS address_type, line1, line2, line3, city, state, zip, county, country
FROM lsbd.person_address
WHERE person_id = $1${withContact ? "" : " AND address_type = 'office'"}
ORDER BY address_type`;
}

const EDUCATION_SQL = `SELECT school_name, school_state, grad_year, degree
FROM lsbd.person_education
WHERE person_id = $1`;

export async function loadLicenseeCore(
  q: RoQueryFn,
  key: number,
  caps: DetailCaps,
): Promise<LicenseeCore | null> {
  const rows = await q(personSql(caps.contact), [key]);
  if (rows.length === 0) return null;
  const r = rows[0];

  const person: LicenseePerson = {
    key: rowNum(r.legacy_key) as number,
    personId: rowNum(r.person_id) as number,
    individualId: rowStr(r.individual_id),
    firstName: rowStr(r.first_name),
    middleName: rowStr(r.middle_name),
    lastName: rowStr(r.last_name),
    licenseName: rowStr(r.license_name),
    marriedName: rowStr(r.married_name),
    prefix: rowStr(r.prefix),
    suffix: rowStr(r.suffix),
    useLicenseName: rowBool(r.use_license_name) ?? false,
  };
  const contact: LicenseeContact | null = caps.contact
    ? {
        email: rowStr(r.email),
        url: rowStr(r.url),
        phone1: rowStr(r.phone1),
        ext1: rowStr(r.ext1),
        phone2: rowStr(r.phone2),
        ext2: rowStr(r.ext2),
        fax: rowStr(r.fax),
      }
    : null;
  const hasLicence = r.license_row_id !== null && r.license_row_id !== undefined;
  const licence: LicenceRecord | null = hasLicence
    ? {
        licenseNumber: String(r.license_id ?? ""),
        type: rowStr(r.type),
        class: rowStr(r.class),
        status: rowStr(r.status),
        dateSince: rowIso(r.date_since),
        dateInactive: rowIso(r.date_inactive),
        dateReinstate: rowIso(r.date_reinstate),
        dateRenew: rowIso(r.date_renew),
        dateUntil: rowIso(r.date_until),
        regYear: rowStr(r.reg_year),
        renewMonth: rowStr(r.renew_month),
        permitNumber: rowStr(r.permit_number),
        isCurrent: rowBool(r.is_current),
        action: rowStr(r.action),
        credentialExam: rowStr(r.credential_exam),
        duplicateCount: rowNum(r.duplicate_count) ?? 0,
      }
    : null;

  // CR6: a NULL individual_id is "cannot be looked up", not "none".
  let otherLicences: Linked<OtherLicence>;
  if (person.individualId === null) {
    otherLicences = { linked: false, reason: NO_INDIVIDUAL_REASON };
  } else {
    const others = await q(OTHER_LICENCES_SQL, [person.individualId, key]);
    otherLicences = {
      linked: true,
      rows: others.map((o) => ({
        key: rowNum(o.legacy_key) as number,
        licenseNumber: String(o.license_id ?? ""),
        type: rowStr(o.type),
        status: rowStr(o.status),
        dateUntil: rowIso(o.date_until),
      })),
    };
  }

  const addrRows = await q(addressSql(caps.contact), [person.personId]);
  const addresses: AddressRow[] = addrRows.map((a) => ({
    type: String(a.address_type) as AddressRow["type"],
    line1: rowStr(a.line1),
    line2: rowStr(a.line2),
    line3: rowStr(a.line3),
    city: rowStr(a.city),
    state: rowStr(a.state),
    zip: rowStr(a.zip),
    county: rowStr(a.county),
    country: rowStr(a.country),
  }));

  const eduRows = await q(EDUCATION_SQL, [person.personId]);
  const education: EducationSection = {
    rows: eduRows.map((e) => ({
      source: "licence-record" as const,
      school: rowStr(e.school_name),
      state: rowStr(e.school_state),
      year: rowNum(e.grad_year),
      degree: rowStr(e.degree), // raw code (Q5)
    })),
    detailNotLinked: true,
    message: EDUCATION_NOT_LINKED_MESSAGE,
  };

  return { person, contact, licence, otherLicences, addresses, education };
}

// ---- Part 2: permits, affiliations, offices, discipline (CR3: no firm links) ----

// Each list query fetches limit + 1 rows so a cut list can be reported (truncated).
export const AFFILIATION_LIMIT = 500; // per direction
export const OFFICE_AFFILIATION_LIMIT = 200;
export const DISCIPLINE_LIMIT = 100;

export type Section<T> = { rows: T[]; truncated: boolean };

export type AffiliationRow = {
  direction: "dentist-of" | "affiliated-to"; // this licensee is the dentist | this licensee is the affiliated individual
  otherKey: number | null; // the raw legacy id on the affiliation row
  otherName: string | null;
  otherLicenseNumber: string | null;
  otherType: string | null; // null when no person has that key, or the person has no licence row
};
export type OfficeLinkRow = {
  id: number;
  officePermit: boolean | null;
  officeId: number | null;
  officeName: string | null;
  officePhone: string | null;
};
export type DisciplineRow = {
  startDate: string | null;
  endDate: string | null;
  goodStanding: boolean | null;
  notes: string | null;
};
export type DisciplineSection =
  | "hidden" // not available to this role (no query sent)
  | { linked: false; reason: string }
  | { linked: true; rows: DisciplineRow[]; truncated: boolean };
export type LicenseeRelations = {
  permits: Section<PermitRow>;
  affiliations: Section<AffiliationRow>;
  offices: Section<OfficeLinkRow>;
  discipline: DisciplineSection;
};
export type LicenseeDetail = LicenseeCore & LicenseeRelations;

// Only the other licensee's name and licence identifiers are selected, never their contact columns.
function affiliationSql(own: "dentist_legacy_id" | "individual_legacy_id", other: "dentist_legacy_id" | "individual_legacy_id"): string {
  return `SELECT ia.${other} AS other_key, o.legacy_key AS found_key, o.last_name, o.first_name, o.middle_name, o.suffix, ol.license_id, ol.type::text AS type
FROM lsbd.individual_affiliation ia
LEFT JOIN lsbd.person o ON o.legacy_key = ia.${other}
LEFT JOIN lsbd.license ol ON ol.legacy_key = o.legacy_key
WHERE ia.${own} = $1
ORDER BY o.last_name NULLS LAST, ia.id
LIMIT ${AFFILIATION_LIMIT + 1}`;
}
const DENTIST_OF_SQL = affiliationSql("dentist_legacy_id", "individual_legacy_id");
const AFFILIATED_TO_SQL = affiliationSql("individual_legacy_id", "dentist_legacy_id");

const OFFICES_SQL = `SELECT oa.id, oa.office_permit, oa.office_id, o.office_name, o.phone
FROM lsbd.office_affiliation oa
LEFT JOIN lsbd.office o ON o.id = oa.office_id
WHERE oa.dentist_id = $1
ORDER BY oa.id
LIMIT ${OFFICE_AFFILIATION_LIMIT + 1}`;

// disciplinary.notes is free text: this statement is only ever sent with discipline.read.
const DISCIPLINE_SQL = `SELECT start_date, end_date, good_standing, notes
FROM lsbd.disciplinary
WHERE individual_id = $1
ORDER BY start_date DESC NULLS LAST, legacy_id DESC
LIMIT ${DISCIPLINE_LIMIT + 1}`;

function cut<T>(rows: T[], limit: number): Section<T> {
  return { rows: rows.slice(0, limit), truncated: rows.length > limit };
}

function mapAffiliation(direction: AffiliationRow["direction"], r: Record<string, unknown>): AffiliationRow {
  const found = rowNum(r.found_key) !== null;
  return {
    direction,
    otherKey: rowNum(r.other_key),
    otherName: found
      ? formatPersonName({
          lastName: rowStr(r.last_name),
          firstName: rowStr(r.first_name),
          middleName: rowStr(r.middle_name),
          suffix: rowStr(r.suffix),
        })
      : null,
    otherLicenseNumber: found ? rowStr(r.license_id) : null,
    otherType: found ? rowStr(r.type) : null,
  };
}

export async function loadLicenseeRelations(
  q: RoQueryFn,
  core: LicenseeCore,
  caps: DetailCaps,
): Promise<LicenseeRelations> {
  const key = core.person.key;
  const permits: Section<PermitRow> = await permitsForHolder(q, key);

  const dentistOf = cut((await q(DENTIST_OF_SQL, [key])).map((r) => mapAffiliation("dentist-of", r)), AFFILIATION_LIMIT);
  const affiliatedTo = cut((await q(AFFILIATED_TO_SQL, [key])).map((r) => mapAffiliation("affiliated-to", r)), AFFILIATION_LIMIT);
  const affiliations: Section<AffiliationRow> = {
    rows: [...dentistOf.rows, ...affiliatedTo.rows],
    truncated: dentistOf.truncated || affiliatedTo.truncated,
  };

  // CR2: a NULL office_id is common and renders as not linked.
  const officeRows = await q(OFFICES_SQL, [key]);
  const offices = cut(
    officeRows.map(
      (r): OfficeLinkRow => ({
        id: rowNum(r.id) as number,
        officePermit: rowBool(r.office_permit),
        officeId: rowNum(r.office_id),
        officeName: rowStr(r.office_name),
        officePhone: rowStr(r.phone),
      }),
    ),
    OFFICE_AFFILIATION_LIMIT,
  );

  let discipline: DisciplineSection;
  if (!caps.discipline) {
    discipline = "hidden";
  } else if (core.person.individualId === null) {
    // CR6: never compare NULL to NULL; say it cannot be looked up.
    discipline = { linked: false, reason: NO_INDIVIDUAL_REASON };
  } else {
    const rows = await q(DISCIPLINE_SQL, [core.person.individualId]);
    const section = cut(
      rows.map(
        (d): DisciplineRow => ({
          startDate: rowIso(d.start_date),
          endDate: rowIso(d.end_date),
          goodStanding: rowBool(d.good_standing),
          notes: rowStr(d.notes),
        }),
      ),
      DISCIPLINE_LIMIT,
    );
    discipline = { linked: true, ...section };
  }

  return { permits, affiliations, offices, discipline };
}

export async function loadLicenseeDetail(
  q: RoQueryFn,
  key: number,
  caps: DetailCaps,
): Promise<LicenseeDetail | null> {
  const core = await loadLicenseeCore(q, key, caps);
  if (core === null) return null;
  return { ...core, ...(await loadLicenseeRelations(q, core, caps)) };
}
