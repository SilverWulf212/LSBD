// scripts/lib/staff-ro-tables.ts
//
// What drizzle/0006_db_roles.sql is expected to grant lsbd_staff_ro in schema lsbd.
// Shared by tests/it/grants.test.ts and scripts/verify-rls.ts, which compare it with
// the catalog. Change it together with the list in 0006.

/** Tables with a table-level SELECT grant. lsbd.individual is not here: it is granted by column. */
export const STAFF_RO_TABLES: readonly string[] = [
  "person",
  "license",
  "person_address",
  "person_education",
  "person_meta",
  "individual_status",
  "professional",
  "individual_affiliation",
  "office",
  "office_affiliation",
  "permits",
  "permit_type",
  "sed_level",
  "professional_llc",
  "professional_association",
  "disciplinary",
  "education",
  "education_type",
  "countries",
  "states",
  "parishes",
  "tbl_counties",
  "cities",
  "zipcodes",
  "election_districts",
  "address_type_lookup",
  "tbl_types",
  "tbl_status",
  "tbl_class",
  "tbl_inactive_status",
  "tbl_specialties",
  "professional_type",
  "practice_type",
];

/** Columns of lsbd.individual that lsbd_staff_ro must not be able to select. */
export const STAFF_RO_INDIVIDUAL_DENIED_COLUMNS: readonly string[] = ["ssn", "dob", "sex", "race"];

/** Relations in lsbd on which role $1 has a table-level SELECT grant. */
export const TABLE_SELECTABLE_SQL = `
  SELECT c.relname AS t
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'lsbd' AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
     AND has_table_privilege($1::name, c.oid, 'SELECT')
   ORDER BY 1`;

/** Relations in lsbd on which role $1 can select the table or any column of it. */
export const ANY_COLUMN_SELECTABLE_SQL = `
  SELECT c.relname AS t
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'lsbd' AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
     AND has_any_column_privilege($1::name, c.oid, 'SELECT')
   ORDER BY 1`;

/** Of the columns $2 of lsbd.individual, those role $1 can select. */
export const INDIVIDUAL_SELECTABLE_COLUMNS_SQL = `
  SELECT col AS t
    FROM unnest($2::text[]) AS col
   WHERE has_column_privilege($1::name, 'lsbd.individual', col, 'SELECT')
   ORDER BY 1`;

export function diffSets(actual: readonly string[], expected: readonly string[]): { extra: string[]; missing: string[] } {
  return {
    extra: actual.filter((t) => !expected.includes(t)).sort(),
    missing: expected.filter((t) => !actual.includes(t)).sort(),
  };
}
