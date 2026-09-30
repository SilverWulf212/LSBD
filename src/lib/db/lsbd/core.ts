// drizzle_core.ts -- People, License, Discipline
// Translated from LSBDDB MSSQL by Claude (core slice).
//
// Scope of this file:
//   * People & License: license, person, licensee_pii, person_address,
//     person_education, person_practice_stats, person_meta
//     (all derived from the 103-column source `tblDenHyg`)
//   * Legacy/parallel canonical tables: individual, individual_status,
//     individual_affiliation, professional, association_history
//   * Discipline & Complaints: disciplinary, complaint, and the
//     six small lookup tables (compl_action, compl_closure,
//     compl_decision, compl_hearing, compl_probation, compl_status,
//     disposition)
//
// Cross-slice references are placeholder integer FKs (commented
// `// xref:`) until the merge step wires them to the real tables
// owned by other agents (office, address, tblTypes, tblStatus,
// tblClass, tblSpecialties, etc.).

import {
  pgSchema, serial,
  integer,
  smallint,
  text,
  boolean,
  timestamp,
  uuid,
  numeric,
  doublePrecision,
  index,
  uniqueIndex,
  unique,
} from "drizzle-orm/pg-core";

// All legacy LSBD tables live in the "lsbd" Postgres schema,
// separate from the website CMS tables in public.
export const lsbdSchema = pgSchema("lsbd");
import { relations } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

// tblTypes (D=Dentist, H=Hygienist, E=EDDA, O=Office)
export const licenseTypeEnum = lsbdSchema.enum("license_type", ["D", "H", "E", "O"]);

// tblStatus codes from the source (see 07_lookup_tables.txt)
export const licenseStatusEnum = lsbdSchema.enum("license_status", [
  "ACT", "SUS", "REV", "REP", "ARC", "PRB",
  "DEC", "EXP", "OTH", "TMP", "INA", "RET", "VOL",
]);

// tblClass codes
export const licenseClassEnum = lsbdSchema.enum("license_class", [
  "L", "A", "I", "P", "T", "O", "C", "V", "NL",
]);

// Address bucket inside tblDenHyg: home (Address1/2/3,CITY,...),
// office (AddressO*,CITYO,...), permanent (AddressP*,CITYP,...).
export const addressTypeEnum = lsbdSchema.enum("address_type", [
  "home", "office", "permanent",
]);

// ---------------------------------------------------------------------------
// People & License -- normalized split of tblDenHyg (103 cols, 19,065 rows)
// ---------------------------------------------------------------------------

// person: name + non-PII identity fields from tblDenHyg
//  src cols: FIRSTName, MIDDLE, LASTName, LicenseName, MarriedName,
//            Prefix, Suffix, UseLicenseName, Email, URL, Phone1, Ext1,
//            Phone2, Ext2, Fax, Fax2, OPT_IN
//  Plus FK to canonical Individual (uniqueidentifier in source).
export const person = lsbdSchema.table("person", {
  id: serial("id").primaryKey(),
  // Legacy upsert key: source tblDenHyg.Key. ONE person per tblDenHyg row
  // (one source row = one license = one person; never dedupe on license_id).
  legacyKey: integer("legacy_key").notNull().unique(),
  individualId: uuid("individual_id"), // FK -> individual.individual_id
  firstName: text("first_name"),
  middleName: text("middle_name"),
  lastName: text("last_name"),
  licenseName: text("license_name"),
  marriedName: text("married_name"),
  prefix: text("prefix"),
  suffix: text("suffix"),
  useLicenseName: boolean("use_license_name").default(false),
  email: text("email"),
  url: text("url"),
  phone1: text("phone1"),
  ext1: text("ext1"),
  phone2: text("phone2"),
  ext2: text("ext2"),
  fax: text("fax"),
  fax2: text("fax2"),
  optIn: text("opt_in"), // source nchar(2) Y/N flag; kept as text for now
}, (t) => ({
  lastNameIdx: index("person_last_name_idx").on(t.lastName),
  individualIdx: index("person_individual_idx").on(t.individualId),
  emailIdx: index("person_email_idx").on(t.email),
}));

// license: license-record fields from tblDenHyg
//  src cols: LICENSEID, Type, Class, STATUS, DateSince, DateInactive,
//            DateReinstate, DateRenew, DateUntil, RegYear, RenewMnth,
//            PANO, PLLCNO, PERMITNO, ProcessingGroup, IsCurrent,
//            Audit, Action, AuditYear, Credential_Exam
//  Original PK was tblDenHyg.Key (int). We keep that as legacy_key
//  for cutover joins, then surrogate `id` is the new PK.
//  ACTIVE (Y/N) was redundant with STATUS=ACT -- dropped.
export const license = lsbdSchema.table("license", {
  id: serial("id").primaryKey(),
  legacyKey: integer("legacy_key").notNull().unique(), // source tblDenHyg.Key -- THE license identity
  // source LICENSEID, the public number. NOT unique: only unique per Type, and
  // even (Type, LICENSEID) has duplicate groups in source. Never upsert on it.
  licenseId: text("license_id").notNull(),
  personId: integer("person_id").references(() => person.id),
  type: licenseTypeEnum("type"),
  class: licenseClassEnum("class").default("L"),
  status: licenseStatusEnum("status"),
  dateSince: timestamp("date_since", { withTimezone: true }),
  dateInactive: timestamp("date_inactive", { withTimezone: true }),
  dateReinstate: timestamp("date_reinstate", { withTimezone: true }),
  dateRenew: timestamp("date_renew", { withTimezone: true }),
  dateUntil: timestamp("date_until", { withTimezone: true }),
  regYear: text("reg_year"),
  renewMonth: text("renew_month"),
  panNumber: text("pa_number"),       // PANO  -- xref: pa.id (operations slice)
  pllcNumber: text("pllc_number"),    // PLLCNO -- xref: pllc.id
  permitNumber: text("permit_number"),// PERMITNO -- xref: permit.id
  processingGroup: text("processing_group"),
  isCurrent: boolean("is_current").default(true),
  audit: text("audit"),               // Y/N flag
  action: text("action"),             // free-text disciplinary action code
  auditYear: text("audit_year"),
  credentialExam: text("credential_exam"),
}, (t) => ({
  typeLicenseIdIdx: index("license_type_license_id_idx").on(t.type, t.licenseId), // non-unique
  statusIdx: index("license_status_idx").on(t.status),
  typeIdx: index("license_type_idx").on(t.type),
  personIdx: index("license_person_idx").on(t.personId),
}));

// licensee_pii: RESTRICTED. Hash SSN with pgcrypto (Migration #9).
//  Plaintext password (Migration #10) becomes a bcrypt hash AND every
//  user must reset on first login to the new system -- do NOT carry
//  legacy passwords forward.
//  src cols: SSN, DOB, SEX, RACE, BACKGROUND, password
//  Access controlled via Supabase RLS to the `staff_pii` role only.
export const licenseePii = lsbdSchema.table("licensee_pii", {
  id: serial("id").primaryKey(),
  // Upsert key: one PII row per person (= per tblDenHyg row).
  personId: integer("person_id").notNull().unique().references(() => person.id, { onDelete: "cascade" }),
  ssnHash: text("ssn_hash"),             // pgcrypto digest of normalized SSN
  dob: timestamp("dob", { withTimezone: true }),
  sex: text("sex"),
  race: text("race"),
  background: boolean("background").default(false),
  passwordHash: text("password_hash"),   // bcrypt; MUST be force-reset on first login
});

// person_address: three address sets in tblDenHyg become rows here.
//  type='home'      <- Address1, Address2, Address3, CITY, STATE, ZIP, COUNTY, Country, AddrType
//  type='office'    <- AddressO1, AddressO2, CITYO, STATEO, ZIPO, COUNTYO, OAddrType
//  type='permanent' <- AddressP1, AddressP2, CITYP, STATEP, ZIPP, COUNTYP
//  Note: source had no separate Address3 for office/permanent --
//  only the home address has it (tblDenHyg col 92).
export const personAddress = lsbdSchema.table("person_address", {
  id: serial("id").primaryKey(),
  personId: integer("person_id").notNull().references(() => person.id, { onDelete: "cascade" }),
  addressType: addressTypeEnum("address_type").notNull(),
  line1: text("line1"),
  line2: text("line2"),
  line3: text("line3"),
  city: text("city"),
  state: text("state"),
  zip: text("zip"),
  county: text("county"),
  country: text("country"),
  // raw 'AddrType'/'OAddrType' free-text bucket from source kept for audit
  legacyAddrType: text("legacy_addr_type"),
  // xref: address.id (canonical ADDRESS table, geography slice)
  addressId: integer("address_id"),
}, (t) => ({
  // Upsert key: (person_id, address_type) = (tblDenHyg.Key via person, bucket).
  personTypeUnique: unique("person_address_person_id_address_type_unique")
    .on(t.personId, t.addressType),
  cityIdx: index("person_address_city_idx").on(t.city),
  zipIdx: index("person_address_zip_idx").on(t.zip),
}));

// person_education: school + degree info pulled out of tblDenHyg.
//  src cols: SCHNAME, SCHSTATE, GRADYEAR, DEGREE
//  Note: there is also a richer dbo.Education table (16,759 rows) owned
//  by the education slice; this row stays for tblDenHyg cutover parity.
export const personEducation = lsbdSchema.table("person_education", {
  id: serial("id").primaryKey(),
  // Upsert key: one row per person (= per tblDenHyg row).
  personId: integer("person_id").notNull().unique().references(() => person.id, { onDelete: "cascade" }),
  schoolName: text("school_name"),    // xref: school.id (education slice)
  schoolState: text("school_state"),
  gradYear: smallint("grad_year"),
  degree: smallint("degree"),         // xref: education_type.id (education slice)
});

// person_practice_stats: practice + CE + controlled-substance + notes.
//  src cols: HRSWK, PATIENTCR, NUMDENT, NUMHYGEN, NUMDA1, NUMDA2,
//            SATCITY1, SATCITY2, CEHrs, USEANES, USESEDAT,
//            CSNone, CSDispense, CSAdminister, CPR, CENOTREQ,
//            COMPLAINT, LimitedSupDH, FORMEMPL, PRINSET, DEANO,
//            Notes, SPECIALTY, Location
//  ntext Notes -> text. Float counts -> doublePrecision (source is float).
export const personPracticeStats = lsbdSchema.table("person_practice_stats", {
  id: serial("id").primaryKey(),
  // Upsert key: one row per person (= per tblDenHyg row).
  personId: integer("person_id").notNull().unique().references(() => person.id, { onDelete: "cascade" }),
  hoursWorked: doublePrecision("hours_worked"),       // HRSWK
  patientsPerWeek: doublePrecision("patients_per_week"), // PATIENTCR
  numDentists: doublePrecision("num_dentists"),       // NUMDENT
  numHygienists: doublePrecision("num_hygienists"),   // NUMHYGEN
  numDa1: doublePrecision("num_da1"),
  numDa2: doublePrecision("num_da2"),
  satelliteCity1: text("satellite_city1"),
  satelliteCity2: text("satellite_city2"),
  ceHours: doublePrecision("ce_hours"),
  useAnesthesia: text("use_anesthesia"),              // Y/N
  useSedation: text("use_sedation"),                  // Y/N
  csNone: boolean("cs_none").default(false),
  csDispense: boolean("cs_dispense").default(false),
  csAdminister: boolean("cs_administer").default(false),
  cpr: text("cpr"),
  ceNotRequired: text("ce_not_required"),
  complaintFlag: text("complaint_flag"),              // Y/N marker
  limitedSupDh: text("limited_sup_dh"),               // Y/N
  formerlyEmployed: text("formerly_employed"),        // FORMEMPL -- xref: form_empl.id
  principalSetting: text("principal_setting"),        // PRINSET  -- xref: prin_set.id
  deaNumber: text("dea_number"),
  notes: text("notes"),
  specialty: text("specialty"),                       // xref: specialty.id (lookup slice)
  location: text("location"),
});

// person_meta: bookkeeping that didn't fit anywhere cleanly.
//  src cols: UpdatedBy, Updated, DateUpdated, INACTIVE, INACTIVE2,
//            IndividualID (uuid), IndividualID_ (legacy int), ID (legacy int)
//  ACTIVE column was redundant with license.status -- dropped.
//  source col `Location` already lives on practice_stats; not duplicated here.
export const personMeta = lsbdSchema.table("person_meta", {
  id: serial("id").primaryKey(),
  // Upsert key: one row per person (= per tblDenHyg row).
  personId: integer("person_id").notNull().unique().references(() => person.id, { onDelete: "cascade" }),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  dateUpdated: timestamp("date_updated", { withTimezone: true }),
  inactiveReason: text("inactive_reason"),  // INACTIVE, free-text reason
  inactive2: boolean("inactive2").default(false),
  individualUuid: uuid("individual_uuid"),  // source IndividualID
  individualLegacyId: integer("individual_legacy_id"), // source IndividualID_
  legacyId: integer("legacy_id"),           // source tblDenHyg.ID
});

// ---------------------------------------------------------------------------
// Canonical person/professional tables (parallel to the tblDenHyg split)
// ---------------------------------------------------------------------------

// individual_status (10 rows) -- small lookup
export const individualStatus = lsbdSchema.table("individual_status", {
  id: serial("id").primaryKey(),
  individualStatusUuid: uuid("individual_status_uuid").unique(),
  status: text("status"),
  processRenewal: boolean("process_renewal"),
  legacyId: integer("legacy_id"), // IndividualStatus_ID
});

// individual: the canonical person record (8,500 rows). license.individualId
// FKs into this via UUID. The legacy int ID and INDVID columns are kept for
// cutover joins.
export const individual = lsbdSchema.table("individual", {
  individualId: uuid("individual_id").primaryKey(),
  lastName: text("last_name"),
  firstName: text("first_name"),
  middleName: text("middle_name"),
  marriedName: text("married_name"),
  licenseName: text("license_name"),
  suffix: text("suffix"),
  prefix: text("prefix"),
  useLicenseName: boolean("use_license_name"),
  ssn: text("ssn"),         // duplicate of licensee_pii.ssn_hash; carry as-is
                            // for cutover, then null out before opening RLS.
  dob: timestamp("dob", { withTimezone: true }),
  sex: text("sex"),
  race: text("race"),
  email: text("email"),
  website: text("web_site"),
  processingGroup: text("processing_group"),
  notes: text("notes"),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  individualStatusUuid: uuid("individual_status_uuid")
    .references(() => individualStatus.individualStatusUuid),
  legacyId: integer("legacy_id"),       // ID
  status: text("status"),
  indvId: integer("indv_id").notNull().unique(), // INDVID, source PK -- upsert key
}, (t) => ({
  lastNameIdx: index("individual_last_name_idx").on(t.lastName),
}));

// professional (8,506 rows) -- license/professional record per individual
export const professional = lsbdSchema.table("professional", {
  professionalId: uuid("professional_id").primaryKey(),
  professionalTypeUuid: uuid("professional_type_uuid"), // xref: professional_type.uuid
  practiceTypeUuid: uuid("practice_type_uuid"),         // xref: practice_type.uuid
  individualId: uuid("individual_id").references(() => individual.individualId),
  licenseNumber: text("license_number"),
  originalLicIssueDate: timestamp("original_lic_issue_date", { withTimezone: true }),
  credentialExam: text("credential_exam"),
  auditYear: text("audit_year"),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  inactive: boolean("inactive"),
  csNone: boolean("cs_none"),
  csDispense: boolean("cs_dispense"),
  csAdminister: boolean("cs_administer"),
  legacyId: integer("legacy_id").notNull().unique(), // Professional_ID, source PK -- upsert key
  professionalType: text("professional_type"),   // denormalized text
  practiceType: text("practice_type"),           // denormalized text
  individualLegacyId: text("individual_legacy_id"), // source nvarchar(100), oddly typed
}, (t) => ({
  licenseNumberIdx: index("professional_license_number_idx").on(t.licenseNumber),
  individualIdx: index("professional_individual_idx").on(t.individualId),
}));

// individual_affiliation (15,017 rows) -- many-to-many: dentist <-> individual
// (employee/associate). Both sides reference Individual.
export const individualAffiliation = lsbdSchema.table("individual_affiliation", {
  id: serial("id").primaryKey(),
  individualAffiliationUuid: uuid("individual_affiliation_uuid"),
  dentistId: uuid("dentist_id").references(() => individual.individualId),
  individualId: uuid("individual_id").references(() => individual.individualId),
  dentistLegacyId: integer("dentist_legacy_id"),  // DENTID
  individualLegacyId: integer("individual_legacy_id"), // INDVID
  legacyId: integer("legacy_id"),                 // IndividualAffiliation_ID
}, (t) => ({
  dentistIdx: index("indaff_dentist_idx").on(t.dentistId),
  individualIdx: index("indaff_individual_idx").on(t.individualId),
}));

// association_history (22,120 rows) -- audit trail of associations between
// licenses (LicenseID + AssociatedLicenseID, with type discriminators and op).
export const associationHistory = lsbdSchema.table("association_history", {
  id: serial("id").primaryKey(),
  licenseId: text("license_id"),
  licenseType: text("license_type"),
  associatedLicenseId: text("associated_license_id"),
  associatedLicenseType: text("associated_license_type"),
  operationType: text("operation_type"),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  updatedBy: text("updated_by"),
}, (t) => ({
  licenseIdx: index("assochist_license_idx").on(t.licenseId),
  associatedIdx: index("assochist_associated_idx").on(t.associatedLicenseId),
}));

// ---------------------------------------------------------------------------
// Discipline & Complaints
// ---------------------------------------------------------------------------

// disciplinary (643 rows). Public-safe in sanitized form; the boolean
// goodStanding governs whether the row appears on the public site.
export const disciplinary = lsbdSchema.table("disciplinary", {
  disciplinaryId: uuid("disciplinary_id").primaryKey(),
  individualId: uuid("individual_id").references(() => individual.individualId),
  startDate: timestamp("start_date", { withTimezone: true }),
  endDate: timestamp("end_date", { withTimezone: true }),
  notes: text("notes"),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  goodStanding: boolean("good_standing"),
  updatedBy: uuid("updated_by"),
  individualLegacyId: integer("individual_legacy_id"),
  legacyId: integer("legacy_id").notNull().unique(), // Disciplinary_ID (the int PK in source) -- upsert key
}, (t) => ({
  individualIdx: index("disciplinary_individual_idx").on(t.individualId),
}));

// complaint (was tblComplaints, 58 cols, 5,295 rows). Kept as a single wide
// row per project requirements -- internal-only, not exposed publicly.
// Address columns (Address1C..FaxC) are the complainant address; left
// inline rather than split because they don't recur.
export const complaint = lsbdSchema.table("complaint", {
  id: serial("id").primaryKey(),
  legacyKey: integer("legacy_key").notNull().unique(), // source tblComplaints.Key (PK) -- upsert key
  licenseId: text("license_id"),    // xref: license.licenseId
  logNo: text("log_no"),
  logDate: timestamp("log_date", { withTimezone: true }),
  closeDate: timestamp("close_date", { withTimezone: true }),
  decisionDate: timestamp("decision_date", { withTimezone: true }),
  lastVisit: timestamp("last_visit", { withTimezone: true }),
  open: text("open"),               // Y/N
  status: text("status"),           // -- xref: compl_status.status
  // INT_CHRG{1,2,3} -- source charge interest codes (xref: charge_int.id)
  intCharge1: text("int_charge1"),
  intCharge2: text("int_charge2"),
  intCharge3: text("int_charge3"),
  // CHRGE_CAT{1,2,3} -- xref: charge_category.id
  chargeCat1: text("charge_cat1"),
  chargeCat2: text("charge_cat2"),
  chargeCat3: text("charge_cat3"),
  charge1: text("charge1"),
  charge2: text("charge2"),
  charge3: text("charge3"),
  boardMember: text("board_member"),
  investigator: text("investigator"),
  complainant: text("complainant"),
  hearing: text("hearing"),         // Y/N -- xref: compl_hearing.hearing
  decisionType: text("decision_type"), // -- xref: compl_decision.decision
  action: text("action"),           // -- xref: compl_action.action
  suspPeriod: text("susp_period"),
  suspBegin: timestamp("susp_begin", { withTimezone: true }),
  suspEnd: timestamp("susp_end", { withTimezone: true }),
  probPeriod: text("prob_period"),  // -- xref: compl_probation.probation
  probBegin: timestamp("prob_begin", { withTimezone: true }),
  probEnd: timestamp("prob_end", { withTimezone: true }),
  ceCourses: text("ce_courses"),    // Y/N
  ceArea1: text("ce_area1"),
  ceHours1: doublePrecision("ce_hours1"),
  ceArea2: text("ce_area2"),
  ceHours2: doublePrecision("ce_hours2"),
  counseling: text("counseling"),   // Y/N
  comments: text("comments"),       // ntext -> text
  attorneyName: text("attorney_name"),
  attorneyFirm: text("attorney_firm"),
  attorneyStreet1: text("attorney_street1"),
  attorneyStreet2: text("attorney_street2"),
  attorneyCity: text("attorney_city"),
  attorneyState: text("attorney_state"),
  attorneyZip: text("attorney_zip"),
  attorneyPhone: text("attorney_phone"),
  attorneyExt: text("attorney_ext"),
  closureTerms: text("closure_terms"), // -- xref: compl_closure.closure
  probationTerms: text("probation_terms"),
  // Complainant address (Address1C..FaxC)
  complainantAddress1: text("complainant_address1"),
  complainantAddress2: text("complainant_address2"),
  complainantCity: text("complainant_city"),
  complainantState: text("complainant_state"),
  complainantZip: text("complainant_zip"),
  complainantCounty: text("complainant_county"),
  complainantPhone: text("complainant_phone"),
  complainantExt: text("complainant_ext"),
  complainantFax: text("complainant_fax"),
  licenseType: text("license_type"),
}, (t) => ({
  licenseIdx: index("complaint_license_idx").on(t.licenseId),
  statusIdx: index("complaint_status_idx").on(t.status),
  logNoIdx: index("complaint_log_no_idx").on(t.logNo),
}));

// --- Complaint lookups (small, code -> description) -------------------------
// Code values are too uneven (mix of mnemonic and numeric) for pgEnum, so
// keep them as ordinary lookup tables.

export const complAction = lsbdSchema.table("compl_action", {
  id: serial("id").primaryKey(),
  legacyId: text("legacy_id").notNull().unique(), // upsert key: tblComplActions.ID, as text
  action: text("action").notNull(),       // e.g. DIS, SUS, REV, REP, PRB
  description: text("description"),
}, (t) => ({
  actionIdx: uniqueIndex("compl_action_action_idx").on(t.action),
}));

export const complClosure = lsbdSchema.table("compl_closure", {
  id: serial("id").primaryKey(),
  legacyId: text("legacy_id").notNull().unique(), // upsert key: tblComplClosure.ID, as text
  closure: text("closure").notNull(),     // e.g. NV, IE, SR, LC
  description: text("description"),
}, (t) => ({
  closureIdx: uniqueIndex("compl_closure_closure_idx").on(t.closure),
}));

export const complDecision = lsbdSchema.table("compl_decision", {
  id: serial("id").primaryKey(),
  legacyId: text("legacy_id").notNull().unique(), // upsert key: tblComplDecisions.ID, as text
  decision: text("decision").notNull(),   // e.g. C, F, R, LC, SS
  description: text("description"),
}, (t) => ({
  decisionIdx: uniqueIndex("compl_decision_decision_idx").on(t.decision),
}));

export const complHearing = lsbdSchema.table("compl_hearing", {
  id: serial("id").primaryKey(),
  legacyId: text("legacy_id").notNull().unique(), // upsert key: tblComplHearings.ID, as text
  hearing: text("hearing").notNull(),
  description: text("description"),
}, (t) => ({
  hearingIdx: uniqueIndex("compl_hearing_hearing_idx").on(t.hearing),
}));

export const complProbation = lsbdSchema.table("compl_probation", {
  id: serial("id").primaryKey(),
  legacyId: text("legacy_id").notNull().unique(), // upsert key: tblComplProbation.ID, as text
  probation: text("probation").notNull(),
  description: text("description"),
}, (t) => ({
  probationIdx: uniqueIndex("compl_probation_probation_idx").on(t.probation),
}));

// compl_status: source had numeric `Status` (not unique) plus int PK; keep
// `code` as the surfaced lookup value.
export const complStatus = lsbdSchema.table("compl_status", {
  id: serial("id").primaryKey(),
  legacyId: text("legacy_id").notNull().unique(), // upsert key: tblComplStatus.ID, as text
  code: text("code").notNull(),           // source `Status` (e.g. '1','100')
  description: text("description"),       // e.g. "Decision Pending"
}, (t) => ({
  codeIdx: uniqueIndex("compl_status_code_idx").on(t.code),
}));

export const disposition = lsbdSchema.table("disposition", {
  id: serial("id").primaryKey(),
  legacyId: text("legacy_id").notNull().unique(), // upsert key: tblDisposition.ID, as text
  code: text("code").notNull(),           // 1..14 in source
  description: text("description"),
}, (t) => ({
  codeIdx: uniqueIndex("disposition_code_idx").on(t.code),
}));

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const personRelations = relations(person, ({ one, many }) => ({
  individual: one(individual, {
    fields: [person.individualId],
    references: [individual.individualId],
  }),
  pii: one(licenseePii, {
    fields: [person.id],
    references: [licenseePii.personId],
  }),
  meta: one(personMeta, {
    fields: [person.id],
    references: [personMeta.personId],
  }),
  practiceStats: one(personPracticeStats, {
    fields: [person.id],
    references: [personPracticeStats.personId],
  }),
  addresses: many(personAddress),
  educations: many(personEducation),
  licenses: many(license),
}));

export const licenseRelations = relations(license, ({ one }) => ({
  person: one(person, {
    fields: [license.personId],
    references: [person.id],
  }),
}));

export const licenseePiiRelations = relations(licenseePii, ({ one }) => ({
  person: one(person, {
    fields: [licenseePii.personId],
    references: [person.id],
  }),
}));

export const personAddressRelations = relations(personAddress, ({ one }) => ({
  person: one(person, {
    fields: [personAddress.personId],
    references: [person.id],
  }),
}));

export const personEducationRelations = relations(personEducation, ({ one }) => ({
  person: one(person, {
    fields: [personEducation.personId],
    references: [person.id],
  }),
}));

export const personPracticeStatsRelations = relations(personPracticeStats, ({ one }) => ({
  person: one(person, {
    fields: [personPracticeStats.personId],
    references: [person.id],
  }),
}));

export const personMetaRelations = relations(personMeta, ({ one }) => ({
  person: one(person, {
    fields: [personMeta.personId],
    references: [person.id],
  }),
}));

export const individualRelations = relations(individual, ({ one, many }) => ({
  status: one(individualStatus, {
    fields: [individual.individualStatusUuid],
    references: [individualStatus.individualStatusUuid],
  }),
  professionals: many(professional),
  affiliationsAsDentist: many(individualAffiliation, { relationName: "dentist" }),
  disciplinaries: many(disciplinary),
}));

export const professionalRelations = relations(professional, ({ one }) => ({
  individual: one(individual, {
    fields: [professional.individualId],
    references: [individual.individualId],
  }),
}));

export const individualAffiliationRelations = relations(individualAffiliation, ({ one }) => ({
  dentist: one(individual, {
    fields: [individualAffiliation.dentistId],
    references: [individual.individualId],
    relationName: "dentist",
  }),
  individual: one(individual, {
    fields: [individualAffiliation.individualId],
    references: [individual.individualId],
  }),
}));

export const disciplinaryRelations = relations(disciplinary, ({ one }) => ({
  individual: one(individual, {
    fields: [disciplinary.individualId],
    references: [individual.individualId],
  }),
}));

