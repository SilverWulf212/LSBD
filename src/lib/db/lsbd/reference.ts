// drizzle_reference.ts â€” Geography, Address, Office, Lookups, Audit, Misc
// LSBD MSSQL -> Postgres (Supabase) translation. Drizzle 0.45.x.
//
// Translation rules applied here:
//   - snake_case for table + column names (originals noted in comments where ambiguous)
//   - All *_ID / Key PKs become serial().primaryKey()
//   - Source uniqueidentifier "*ID" columns are preserved as legacy_uid uuid
//     (data import will keep them so we can re-link cross-table references that
//     used to be uniqueidentifier-keyed; later we drop them once int FKs land)
//   - Cross-slice FKs use a bare integer() with a "// FK to X (Y slice)" comment
//   - Small stable lookups become pgEnum; volatile/short ones stay as tables
//   - 1-row "settings" tables are normalized to (id, key, value)
//
// DROPPED tables (do NOT migrate):
//   - dtproperties      MSSQL diagram metadata, 0 rows, useless in Postgres
//
// HUMAN REVIEW flagged inline with "// REVIEW:" comments.

import {
  serial,
  integer,
  smallint,
  text,
  boolean,
  timestamp,
  uuid,
  numeric,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// All legacy LSBD tables share the `lsbd` Postgres schema (declared in ./core).
// licenseStatusEnum / licenseClassEnum are also canonical in ./core; re-import
// them here so we don't double-declare and shadow each other.
import { lsbdSchema, licenseStatusEnum, licenseClassEnum } from "./core";
export { licenseStatusEnum, licenseClassEnum };

// =============================================================================
// ENUMS â€” for stable, code-based lookups
// =============================================================================
// tblTypes (D/H/E/O) â€” stable: appears all over the schema as a discriminator.
export const personTypeEnum = lsbdSchema.enum("person_type", [
  "D", // Dentist
  "H", // Hygienist
  "E", // EDDA
  "O", // Office
]);

// tblSpecialties (11 values) â€” clinical specialties. Stable.
export const specialtyEnum = lsbdSchema.enum("specialty_code", [
  "GENERAL",
  "ENDO",
  "Oral Pathology",
  "Oral Surgery",
  "ORTHO",
  "PEDO",
  "PERIO",
  "PROSTHO",
  "DPH",
  "OMFS",
  "NA",
]);

// tblnactiveStatus â€” 7 stable reasons for inactive licensee.
export const inactiveReasonEnum = lsbdSchema.enum("inactive_reason", [
  "Working In Other Field",
  "Retired",
  "Homemaker",
  "Deceased",
  "In Training in Occupation",
  "Other",
  "Semi-Retired",
]);

// tblReportType â€” 2 label printer formats.
export const reportTypeEnum = lsbdSchema.enum("report_type", ["Cheshire", "Avery 5160"]);

// =============================================================================
// GEOGRAPHY
// =============================================================================
export const countries = lsbdSchema.table("countries", {
  id: serial("id").primaryKey(), // was Country_ID (int) in source
  legacyUid: uuid("legacy_uid"), // was CountryID (uniqueidentifier)
  country: text("country").notNull(),
});

export const states = lsbdSchema.table("states", {
  id: serial("id").primaryKey(), // was State_ID
  legacyUid: uuid("legacy_uid"), // was StateID
  state: text("state").notNull(),
});

// Louisiana parishes (LA's "counties"). 66 rows.
export const parishes = lsbdSchema.table("parishes", {
  id: serial("id").primaryKey(), // was Parish_ID
  legacyUid: uuid("legacy_uid"), // was ParishID
  parish: text("parish").notNull(),
});

// REVIEW: tblCounties has identical row count (66) and is presumably a parallel
// LA parishes table left over from the original schema's churn. parishes
// (uniqueidentifier-keyed) is what ADDRESS.ParishID and ElectionDistricts
// reference, so tblCounties looks dead. Confirm with staff before dropping;
// in the meantime we translate it for completeness.
export const tblCounties = lsbdSchema.table("tbl_counties", {
  id: serial("id").primaryKey(),
  county: text("county"),       // short code (was nvarchar(10))
  countyName: text("county_name"),
});

export const cities = lsbdSchema.table("cities", {
  id: serial("id").primaryKey(), // was City_ID
  legacyUid: uuid("legacy_uid"), // was CityID
  city: text("city").notNull(),
});

export const zipcodes = lsbdSchema.table(
  "zipcodes",
  {
    id: serial("id").primaryKey(),
    city: text("city"),
    state: text("state"),
    zip: text("zip"),
    areaCode: text("area_code"),     // "Area Code" in source
    county: text("county"),
    stateCode: text("state_code"),
    timeZone: text("time_zone"),
    longitude: text("longitude"),    // stored as text in source â€” keep as text
    latitude: text("latitude"),      // for fidelity; cast to numeric later
  },
  (t) => ({
    zipIdx: index("zipcodes_zip_idx").on(t.zip),
    cityIdx: index("zipcodes_city_idx").on(t.city),
  })
);

export const electionDistricts = lsbdSchema.table("election_districts", {
  id: serial("id").primaryKey(), // was ElectionDistrict_ID
  legacyUid: uuid("legacy_uid"), // was ElectionDistrictID
  zipCode: text("zip_code"),
  parishId: integer("parish_id"), // FK to parishes (this slice)
  district: smallint("district"),
  parishName: text("parish_name"), // denormalized "PARISH" in source
});

// =============================================================================
// ADDRESS / OFFICE
// =============================================================================
// AddressType â€” small (4 rows) but values are long human strings, not codes.
// Keep as a real table rather than an enum.
export const addressType = lsbdSchema.table("address_type_lookup", {
  id: serial("id").primaryKey(), // was AddressType_ID
  legacyUid: uuid("legacy_uid"), // was AddressTypeID
  addressType: text("address_type").notNull(),
});

// Generalized address. Person/Office FKs land in here as {individualId, officeId}.
export const address = lsbdSchema.table(
  "address",
  {
    id: serial("id").primaryKey(), // was Address_ID
    legacyUid: uuid("legacy_uid"), // was AddressID
    linkUid: uuid("link_uid"),     // legacy LinkID (uniqueidentifier polymorphic ref)
    address1: text("address_1"),
    address2: text("address_2"),
    address3: text("address_3"),
    cityId: integer("city_id"),         // FK to cities (this slice)
    stateId: integer("state_id"),       // FK to states (this slice)
    postalCode: text("postal_code"),
    countryId: integer("country_id"),   // FK to countries (this slice)
    addressTypeId: integer("address_type_id"), // FK to address_type (this slice)
    parishId: integer("parish_id"),     // FK to parishes (this slice)
    isCurrent: boolean("is_current"),
    mailing: boolean("mailing"),
    updated: timestamp("updated", { withTimezone: true }),
    home: boolean("home"),
    flgDup: boolean("flg_dup"),
    cityText: text("city_text"),    // denormalized CITY (nvarchar) in source
    stateText: text("state_text"),  // denormalized STATE
    countryText: text("country_text"), // denormalized COUNTRY
    individualId: integer("individual_id"), // FK to individual (core slice)
    officeId: integer("office_id"),         // FK to office (this slice)
  },
  (t) => ({
    individualIdx: index("address_individual_idx").on(t.individualId),
    officeIdx: index("address_office_idx").on(t.officeId),
  })
);

// Pre-normalization address snapshot table â€” a flat per-person/office snapshot
// captured before the ADDRESS normalization. Migrated as-is for archival.
export const addressHistory = lsbdSchema.table("address_history", {
  id: serial("id").primaryKey(),
  licenseId: text("license_id"),       // FK-by-string to licensee (core slice)
  type: text("type"),
  firstName: text("first_name"),
  middle: text("middle"),
  lastName: text("last_name"),
  address1: text("address_1"),
  address2: text("address_2"),
  city: text("city"),
  state: text("state"),
  zip: text("zip"),
  county: text("county"),
  email: text("email"),
  // Office address shadow columns (suffix O):
  addressO1: text("address_o_1"),
  addressO2: text("address_o_2"),
  cityO: text("city_o"),
  stateO: text("state_o"),
  zipO: text("zip_o"),
  countyO: text("county_o"),
  updated: timestamp("updated", { withTimezone: true }),
  updatedBy: text("updated_by"),
  optIn: text("opt_in"),               // nchar(2) Y/N flag
  deano: text("deano"),                // DEA number
});

export const office = lsbdSchema.table("office", {
  id: serial("id").primaryKey(), // was OFFICE_ID
  legacyUid: uuid("legacy_uid"), // was OfficeID
  officeName: text("office_name"),
  updated: timestamp("updated", { withTimezone: true }),
  oldOfficeId: integer("old_office_id"), // legacy int from a prior migration
  phone: text("phone"),
});

export const officeAffiliation = lsbdSchema.table(
  "office_affiliation",
  {
    id: serial("id").primaryKey(), // was OfficeAffiliation_ID
    legacyUid: uuid("legacy_uid"), // was OfficeAffiliationID
    dentistUid: uuid("dentist_uid"),
    officeUid: uuid("office_uid"),
    officePermit: boolean("office_permit"),
    dentistId: integer("dentist_id"), // FK to professional/individual (core slice)
    officeId: integer("office_id"),   // FK to office (this slice)
  },
  (t) => ({
    dentistIdx: index("office_affiliation_dentist_idx").on(t.dentistId),
    officeIdx: index("office_affiliation_office_idx").on(t.officeId),
  })
);

export const officeAffHistory = lsbdSchema.table("office_aff_history", {
  id: serial("id").primaryKey(),
  licenseId: text("license_id"),     // FK-by-string to licensee (core slice)
  licenseType: text("license_type"),
  officeId: integer("office_id"),    // FK to office (this slice)
  operationType: text("operation_type"), // INSERT/UPDATE/DELETE-style audit verb
  updated: timestamp("updated", { withTimezone: true }),
  updatedBy: text("updated_by"),
});

// =============================================================================
// REFERENCE / LOOKUPS â€” kept as tables (have meaningful side data,
// or values aren't pure codes, or future expansion is likely)
// =============================================================================
// tblTypes is duplicated by personTypeEnum above; keep this table only because
// it carries a TypeDesc the UI may want to render by FK. REVIEW: drop once UI
// stops looking up labels from it.
export const tblTypes = lsbdSchema.table("tbl_types", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),       // 1-char code (D/H/E/O)
  typeDesc: text("type_desc"),
});

// tblStatus has LoginOk/RenewOk flags that the original Access app uses to
// gate behavior. Real table, not enum-only.
export const tblStatus = lsbdSchema.table("tbl_status", {
  id: serial("id").primaryKey(),
  statusId: text("status_id").notNull(), // 3-char code (ACT, SUS, ...)
  status: text("status"),                // human label
  loginOk: boolean("login_ok").notNull().default(false),
  renewOk: boolean("renew_ok").notNull().default(false),
});

// tblClass also has LoginOk/RenewOk side data â€” keep as table.
export const tblClass = lsbdSchema.table("tbl_class", {
  id: serial("id").primaryKey(),
  class: text("class").notNull(),     // L, A, I, P, T, O, C, V, NL
  classDesc: text("class_desc"),
  loginOk: boolean("login_ok").notNull().default(false),
  renewOk: boolean("renew_ok").notNull().default(false),
});

// tblnactiveStatus (sic) â€” covered by inactiveReasonEnum, but keep table for
// backward-compat row IDs referenced elsewhere.
export const tblInactiveStatus = lsbdSchema.table("tbl_inactive_status", {
  id: serial("id").primaryKey(),
  status: text("status").notNull(),
});

// tblSpecialties â€” mirrors specialtyEnum but exposes integer IDs other tables
// already reference. Keep as a table; the enum is for new code.
export const tblSpecialties = lsbdSchema.table("tbl_specialties", {
  id: serial("id").primaryKey(),
  specialty: text("specialty").notNull(),
});

// tblPrinSet â€” 10 rows, "principal setting" lookup (practice settings).
export const tblPrinSet = lsbdSchema.table("tbl_prin_set", {
  id: serial("id").primaryKey(),
  prinSet: text("prin_set"),
});

// tblFormEmpl â€” 7 rows, "form of employment" lookup. Source PK is nchar(4) ID.
export const tblFormEmpl = lsbdSchema.table("tbl_form_empl", {
  id: text("id").primaryKey(),  // preserved as text â€” original PK is a code
  formEmploy: text("form_employ"),
});

// tblReportType â€” 2 rows. Covered by reportTypeEnum; keep table for ID lookups.
export const tblReportType = lsbdSchema.table("tbl_report_type", {
  id: serial("id").primaryKey(),
  reportType: text("report_type").notNull(),
});

export const professionalType = lsbdSchema.table("professional_type", {
  id: serial("id").primaryKey(), // was ProfessionalType_ID
  legacyUid: uuid("legacy_uid"),
  professionalType: text("professional_type"),
  licsCode: text("lics_code"),
  renewalFee: numeric("renewal_fee", { precision: 19, scale: 4 }),
  lateFee: numeric("late_fee", { precision: 19, scale: 4 }),
  firstTimeFee: numeric("first_time_fee", { precision: 19, scale: 4 }),
});

export const practiceType = lsbdSchema.table("practice_type", {
  id: serial("id").primaryKey(), // was PracticeType_ID
  legacyUid: uuid("legacy_uid"),
  practiceType: text("practice_type"),
  specialty: boolean("specialty"),
});

// Specialty â€” 0 rows in source but defined; included for completeness so the
// ETL doesn't silently drop a planned feature.
export const specialty = lsbdSchema.table("specialty", {
  id: serial("id").primaryKey(),
  legacyUid: uuid("legacy_uid"),       // SpecialtyID
  professionalUid: uuid("professional_uid"), // ProfessionalD (sic) in source
  professionalId: integer("professional_id"), // FK to professional (core slice)
  institution: text("institution"),
  specialtyDate: timestamp("specialty_date", { withTimezone: true }),
  boardCertified: boolean("board_certified"),
  certifiedBy: text("certified_by"),
  certifiedDate: timestamp("certified_date", { withTimezone: true }),
  updated: timestamp("updated", { withTimezone: true }),
});

// =============================================================================
// SINGLE-ROW "SETTINGS" TABLES â€” normalized to key/value
// =============================================================================
// tblNumbers: 16 columns, 1 row. Stores "next ID" counters used by the legacy
// Access front-end (DID, DAPPID, HID, ...). Each becomes a key in app_counters.
// Original column names: DID, DAPPID, HID, HAPPID, ASID, INTID, PAID, PLLCID,
// TRANSID, CMPID, VOLDENID, VOLHYGID, INSDENID, INSHYGID, NLID.
//
// tblDates: 3 columns, 1 row. Stores IndRegExp / IndRnwExp dates. Same pattern.
//
// Control: 1 column, 1 row (ExportTempUpdt datetime). Same pattern.
//
// All three collapse into appSettings (string values) below. ETL serializes
// dates/numbers as ISO/decimal strings; app code parses on read.
// REVIEW: confirm whether the app ever increments tblNumbers concurrently â€”
// if so, replace with a real sequence per counter rather than text values.
export const appSettings = lsbdSchema.table("app_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value"),
  notes: text("notes"),
});

// =============================================================================
// AUDIT / USERS / MISC
// =============================================================================
// Logins â€” 96k row audit trail. Preserve for compliance; consider partitioning
// or archival in a separate schema once row count grows further.
// REVIEW: define an archival policy (e.g. move rows >2yr old to logins_archive).
export const logins = lsbdSchema.table(
  "logins",
  {
    id: serial("id").primaryKey(),
    licenseId: text("license_id").notNull(), // FK-by-string to licensee (core slice)
    licType: text("lic_type").notNull(),
    loginDate: timestamp("login_date", { withTimezone: true }).notNull(),
  },
  (t) => ({
    licenseIdx: index("logins_license_idx").on(t.licenseId),
    dateIdx: index("logins_date_idx").on(t.loginDate),
  })
);

// Users â€” staff users for the original Access app. Auth moves to next-auth;
// we migrate names + roles for historical reference and audit trail joins.
// Password column is intentionally NOT carried over.
export const users = lsbdSchema.table("users", {
  id: serial("id").primaryKey(), // was User_ID
  legacyUid: uuid("legacy_uid"), // was UserID
  userName: text("user_name"),
  // password: NOT MIGRATED (was nvarchar(100) plaintext; see migration issue #1/#10)
  accessLevel: smallint("access_level"),
  emailAddress: text("email_address"),
  fullName: text("full_name"),
  srCol1Width: integer("sr_col_1_width"), // legacy UI column-width prefs
  srCol2Width: integer("sr_col_2_width"),
  inspector: boolean("inspector"),
  title: text("title"),
  phone: text("phone"),
});

// Activity â€” 0 rows in source, defined. Includes an `image` blob (Attachment).
// We map image -> bytea-equivalent text for now; switch to bytea or @vercel/blob
// reference if the table actually starts being used.
// REVIEW: confirm whether Activity is dead weight; if so, drop.
export const activity = lsbdSchema.table("activity", {
  id: serial("id").primaryKey(),
  legacyUid: uuid("legacy_uid"), // ActivityID
  subject: text("subject"),
  details: text("details"),
  updated: timestamp("updated", { withTimezone: true }),
  updatedByUid: uuid("updated_by_uid"), // legacy uniqueidentifier
  // attachment: source has image blob; defer â€” store in @vercel/blob if needed
  attachmentUrl: text("attachment_url"),
  disciplinaryUid: uuid("disciplinary_uid"), // FK-by-uuid to disciplinary (discipline slice)
  requiresReview: boolean("requires_review"),
});

// Announcements â€” front-page bulletins.
export const announcements = lsbdSchema.table("announcements", {
  id: serial("id").primaryKey(), // was ANNOUNCID
  legacyUid: uuid("legacy_uid"), // ANNOUNC_ID
  subject: text("subject"),                // ANNOUNC_SUBJECT
  body: text("body"),                      // ANNOUNC_ANNOUNCEMENTS (ntext)
  expirationDate: timestamp("expiration_date", { withTimezone: true }), // ANNOUNC_EXP_DATE
  active: boolean("active"),               // ANNOUNC_ACTIVE
  categoryUid: uuid("category_uid"),       // CAT_ID
  categoryId: integer("category_id"),      // FK to category (this slice)
  categoryText: text("category_text"),     // denormalized CATEGORY name
});

export const boardMembers = lsbdSchema.table("board_members", {
  id: serial("id").primaryKey(), // was BoardMember_ID
  legacyUid: uuid("legacy_uid"), // BoardMemberID
  fullName: text("full_name"),
  title: text("title"),
  address1: text("address_1"),
  address2: text("address_2"),
  displayOrderOverride: integer("display_order_override"),
});

// Catagory (sic in source) â€” kept misspelled internally for traceability;
// surfaced as `category` (correct spelling) in code.
export const category = lsbdSchema.table("category", {
  id: serial("id").primaryKey(),  // was CATID
  legacyUid: uuid("legacy_uid"),  // CAT_ID
  description: text("description"), // CAT_DESC
  active: boolean("active"),        // CAT_ACTIVE
  catType: smallint("cat_type"),    // CAT_TYPE (tinyint -> smallint)
});

export const faqs = lsbdSchema.table("faqs", {
  id: serial("id").primaryKey(), // was FAQSID
  legacyUid: uuid("legacy_uid"), // FAQS_ID
  question: text("question"),    // FAQS_QUESTIONS
  answer: text("answer"),        // FAQS_ANSWERS
  active: boolean("active"),     // FAQS_ACTIVE
  categoryUid: uuid("category_uid"), // CAT_ID
  categoryId: integer("category_id"), // FK to category (this slice)
  categoryText: text("category_text"),
});

// Statutes / StatuteViolations â€” both 0 rows; keep schema for the
// disciplinary slice to FK against once populated.
export const statutes = lsbdSchema.table("statutes", {
  id: serial("id").primaryKey(),
  legacyUid: uuid("legacy_uid"),
  statute: text("statute"),
  statuteTitle: text("statute_title"),
  notes: text("notes"),
});

export const statuteViolations = lsbdSchema.table("statute_violations", {
  id: serial("id").primaryKey(),
  legacyUid: uuid("legacy_uid"),
  disciplinaryUid: uuid("disciplinary_uid"), // FK to disciplinary (discipline slice)
  disciplinaryId: integer("disciplinary_id"), // FK to disciplinary (discipline slice)
  statuteId: integer("statute_id"),           // FK to statutes (this slice)
  violationDate: timestamp("violation_date", { withTimezone: true }),
});

// VSAuth / VsCapture â€” payment gateway (looks like Verisign/PayPal Payflow Pro
// based on column names PNREF, AUTHCODE, AVSADDR, RESPMSG). Cardholder PAN is
// NOT stored (only ACCT masked + EXPDATE). Migrated for transaction history.
// REVIEW: confirm with staff that gateway is no longer used; if so, archive
// these in a `legacy_payments` schema rather than `public`.
export const vsAuth = lsbdSchema.table(
  "vs_auth",
  {
    id: serial("id").primaryKey(),
    dateCreated: timestamp("date_created", { withTimezone: true }),
    amt: text("amt"),                 // amount (kept as text â€” source nvarchar)
    acct: text("acct"),               // masked card number
    expDate: text("exp_date"),        // MMYY string
    cardHolder: text("card_holder"),
    street: text("street"),
    city: text("city"),
    state: text("state"),
    zip: text("zip"),
    pnref: text("pnref").notNull(),   // gateway transaction reference (PK in source)
    result: text("result"),
    respMsg: text("resp_msg"),
    authCode: text("auth_code"),
    avsAddr: text("avs_addr"),
    avsZip: text("avs_zip"),
    licId: text("lic_id"),            // FK-by-string to licensee (core slice)
    licType: text("lic_type"),
    type: text("type"),
  },
  (t) => ({
    pnrefIdx: index("vs_auth_pnref_idx").on(t.pnref),
    licIdx: index("vs_auth_lic_idx").on(t.licId),
  })
);

export const vsCapture = lsbdSchema.table(
  "vs_capture",
  {
    id: serial("id").primaryKey(),
    dateCreated: timestamp("date_created", { withTimezone: true }),
    origId: text("orig_id"),
    pnref: text("pnref").notNull(),
    result: text("result"),
    respMsg: text("resp_msg"),
    authCode: text("auth_code"),
    avsAddr: text("avs_addr"),
    avsZip: text("avs_zip"),
  },
  (t) => ({
    pnrefIdx: index("vs_capture_pnref_idx").on(t.pnref),
    origIdIdx: index("vs_capture_orig_id_idx").on(t.origId),
  })
);

// =============================================================================
// RELATIONS
// =============================================================================
export const countriesRelations = relations(countries, ({ many }) => ({
  addresses: many(address),
}));

export const statesRelations = relations(states, ({ many }) => ({
  addresses: many(address),
}));

export const parishesRelations = relations(parishes, ({ many }) => ({
  addresses: many(address),
  electionDistricts: many(electionDistricts),
}));

export const citiesRelations = relations(cities, ({ many }) => ({
  addresses: many(address),
}));

export const addressTypeRelations = relations(addressType, ({ many }) => ({
  addresses: many(address),
}));

export const addressRelations = relations(address, ({ one }) => ({
  city: one(cities, { fields: [address.cityId], references: [cities.id] }),
  state: one(states, { fields: [address.stateId], references: [states.id] }),
  country: one(countries, { fields: [address.countryId], references: [countries.id] }),
  parish: one(parishes, { fields: [address.parishId], references: [parishes.id] }),
  addressType: one(addressType, {
    fields: [address.addressTypeId],
    references: [addressType.id],
  }),
  office: one(office, { fields: [address.officeId], references: [office.id] }),
  // individual relation lives in core slice
}));

export const officeRelations = relations(office, ({ many }) => ({
  addresses: many(address),
  affiliations: many(officeAffiliation),
  affiliationHistory: many(officeAffHistory),
}));

export const officeAffiliationRelations = relations(officeAffiliation, ({ one }) => ({
  office: one(office, { fields: [officeAffiliation.officeId], references: [office.id] }),
  // dentist relation lives in core slice
}));

export const officeAffHistoryRelations = relations(officeAffHistory, ({ one }) => ({
  office: one(office, { fields: [officeAffHistory.officeId], references: [office.id] }),
}));

export const electionDistrictsRelations = relations(electionDistricts, ({ one }) => ({
  parish: one(parishes, {
    fields: [electionDistricts.parishId],
    references: [parishes.id],
  }),
}));

export const categoryRelations = relations(category, ({ many }) => ({
  announcements: many(announcements),
  faqs: many(faqs),
}));

export const announcementsRelations = relations(announcements, ({ one }) => ({
  category: one(category, {
    fields: [announcements.categoryId],
    references: [category.id],
  }),
}));

export const faqsRelations = relations(faqs, ({ one }) => ({
  category: one(category, { fields: [faqs.categoryId], references: [category.id] }),
}));

export const statutesRelations = relations(statutes, ({ many }) => ({
  violations: many(statuteViolations),
}));

export const statuteViolationsRelations = relations(statuteViolations, ({ one }) => ({
  statute: one(statutes, {
    fields: [statuteViolations.statuteId],
    references: [statutes.id],
  }),
  // disciplinary relation lives in discipline slice
}));


