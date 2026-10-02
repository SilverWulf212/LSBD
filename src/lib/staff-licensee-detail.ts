// Licensee detail, part 1: person, licence, other licences, addresses, education.
// Relative imports only (vitest has no `@/`). Every SQL string is one statement, no semicolon.
import type { RoQueryFn } from "./db/lsbd-ro";
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
