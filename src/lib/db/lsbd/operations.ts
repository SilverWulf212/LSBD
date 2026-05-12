// drizzle_operations.ts â€” Permits, Renewals, Transactions, Inspections, Education, Random Sampling
// Translated from LSBDDB MSSQL by ops-slice agent.
//
// Conventions (per migration plan):
//   - Postgres snake_case for column names.
//   - MSSQL `Key`/`*ID`/`*_ID` PKs become `serial().primaryKey()` named `id`.
//   - `uniqueidentifier` PKs that exist alongside an int PK are dropped â€” the int
//     was the actual app-side PK (per `04_indexes.txt`).
//   - `nvarchar`/`varchar`/`ntext` -> `text()`, lengths intentionally not enforced.
//   - `datetime`/`smalldatetime` -> `timestamp({withTimezone:true})`.
//   - `bit` -> `boolean()`, `money` -> `numeric(19,4)`, `float` -> `doublePrecision()`.
//   - Cross-slice FKs (to `individual`, `license`, `office`, `professional`,
//     lookup tables owned elsewhere) are placeholder `integer()` columns with
//     a `// FK to <target> (<slice>)` comment â€” wire up after slices merge.
//
// Source DB has ZERO declared foreign keys; all relationships inferred from
// column names. See `relations()` block at the bottom for in-slice joins.

import {
  pgSchema, serial, integer, smallint, text, boolean,
  timestamp, numeric, doublePrecision,
} from "drizzle-orm/pg-core";

// All legacy LSBD tables live in the "lsbd" Postgres schema,
// separate from the website CMS tables in public.
export const lsbdSchema = pgSchema("lsbd");
import { relations } from "drizzle-orm";

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// PERMITS
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// Permits: an issued permit (anesthesia, sedation, etc.) tied to a dentist + office.
// Source had both a uniqueidentifier `PermitsID` and an int `Permits_ID`; we keep
// the int as the PK and drop the GUID. Same for DentistID/OfficeID/PermitTypeID.
export const permits = lsbdSchema.table("permits", {
  id: serial("id").primaryKey(),                                        // was Permits_ID (int)
  permitTypeId: integer("permit_type_id"),                              // FK -> permit_type.id (this slice)
  dentistId: integer("dentist_id"),                                     // FK to license/individual (core slice)
  officeId: integer("office_id"),                                       // FK to office (reference slice)
  permitTypeName: text("permit_type_name"),                             // denormalized PermitType nvarchar copy
  permitLevel: text("permit_level"),
  description: text("description"),
  issueDate: timestamp("issue_date", { withTimezone: true }),
  updated: timestamp("updated", { withTimezone: true }),
  updatedOnline: timestamp("updated_online", { withTimezone: true }),
});

// PermitType: lookup for kinds of permits (Anesthesia I/II/III, Sedation, etc.).
export const permitType = lsbdSchema.table("permit_type", {
  id: serial("id").primaryKey(),                                        // was PermitType_ID (int)
  permitType: text("permit_type"),
  description: text("description"),
  personalFee: numeric("personal_fee", { precision: 19, scale: 4 }),
  officeFee: numeric("office_fee", { precision: 19, scale: 4 }),
  personalPriority: integer("personal_priority"),
});

// PermitHistory: audit log for permit changes (defined but 0 rows in source).
// Kept for completeness; all columns nullable in case of legacy import quirks.
export const permitHistory = lsbdSchema.table("permit_history", {
  id: serial("id").primaryKey(),
  licenseId: integer("license_id"),                                     // FK to license (core slice)
  permitTypeName: text("permit_type_name"),
  officeId: integer("office_id"),                                       // FK to office (reference slice)
  operationType: text("operation_type"),                                // INSERT/UPDATE/DELETE
  updated: timestamp("updated", { withTimezone: true }),
  updatedBy: text("updated_by"),
});

// tblASPermits: Anesthesia/Sedation Permits â€” schema present, 0 rows. Functionally
// superseded by Permits + PermitType. Keeping as `as_permit` in case of latent data.
export const asPermit = lsbdSchema.table("as_permit", {
  id: serial("id").primaryKey(),                                        // was Key (int)
  licenseId: text("license_id"),                                        // string license # in source
  type: text("type"),
  status: text("status"),
  dateSince: timestamp("date_since", { withTimezone: true }),
  dateUntil: timestamp("date_until", { withTimezone: true }),
  dateInactive: timestamp("date_inactive", { withTimezone: true }),
  dateReinstate: timestamp("date_reinstate", { withTimezone: true }),
  dateUpdated: timestamp("date_updated", { withTimezone: true }),
  dateRenew: timestamp("date_renew", { withTimezone: true }),
  dLicenseId: text("d_license_id"),                                     // dentist's license id
  otherDentists: text("other_dentists"),                                // ntext
  training: text("training"),
  trainYear: text("train_year"),
  regYear: text("reg_year"),
  inspectedO: text("inspected_o"),
  inspected: text("inspected"),
  inspectedS1: text("inspected_s1"),
  inspectedS2: text("inspected_s2"),
  renewMonth: text("renew_month"),
  notes: text("notes"),
  audit: text("audit"),
  sLevel: text("s_level"),                                              // FK semantically to sed_level.s_level
});

// tblPAs: Professional Associations â€” defined but 0 rows. Superseded by
// `Office`/`OfficeAffiliation` workflow.
export const professionalAssociation = lsbdSchema.table("professional_association", {
  id: serial("id").primaryKey(),                                        // was Key (int)
  licenseId: text("license_id"),
  estName: text("est_name"),
  status: text("status"),
  dateSince: timestamp("date_since", { withTimezone: true }),
  dateUpdated: timestamp("date_updated", { withTimezone: true }),
  dateRenew: timestamp("date_renew", { withTimezone: true }),
  dateUntil: timestamp("date_until", { withTimezone: true }),
  renewMonth: text("renew_month"),
  regYear: text("reg_year"),
  addrName1: text("addr_name1"),
  addrName2: text("addr_name2"),
  sort1: text("sort1"),
  sort2: text("sort2"),
  comment1: text("comment1"),
  comment2: text("comment2"),
  comment3: text("comment3"),
  address1: text("address1"),
  address2: text("address2"),
  city: text("city"),
  state: text("state"),
  zip: text("zip"),
  county: text("county"),
  phone1: text("phone1"),
  ext1: text("ext1"),
  phone2: text("phone2"),
  ext2: text("ext2"),
  fax: text("fax"),
  notes: text("notes"),
  location: text("location"),
  email: text("email"),
  url: text("url"),
  type: text("type"),
});

// tblPLLCs: Professional LLCs (4,724 rows â€” actively used).
export const professionalLlc = lsbdSchema.table("professional_llc", {
  id: serial("id").primaryKey(),                                        // was Key (int)
  licenseId: text("license_id"),                                        // PLLC license # (string)
  estName: text("est_name"),
  status: text("status"),
  dateSince: timestamp("date_since", { withTimezone: true }),
  dateUpdated: timestamp("date_updated", { withTimezone: true }),
  dateRenew: timestamp("date_renew", { withTimezone: true }),
  dateUntil: timestamp("date_until", { withTimezone: true }),
  renewMonth: text("renew_month"),
  regYear: text("reg_year"),
  addrName1: text("addr_name1"),
  addrName2: text("addr_name2"),
  sort1: text("sort1"),
  sort2: text("sort2"),
  comment1: text("comment1"),
  comment2: text("comment2"),
  comment3: text("comment3"),
  address1: text("address1"),
  address2: text("address2"),
  address3: text("address3"),
  city: text("city"),
  state: text("state"),
  zip: text("zip"),
  county: text("county"),
  phone1: text("phone1"),
  ext1: text("ext1"),
  phone2: text("phone2"),
  ext2: text("ext2"),
  fax: text("fax"),
  notes: text("notes"),
  location: text("location"),
  email: text("email"),
  url: text("url"),
  type: text("type"),
  officeId: integer("office_id"),                                       // FK to office (reference slice)
  oldOfficeId: integer("old_office_id"),                                // legacy mapping; review if used
});

// tblSedLevels: sedation level lookup (4 rows).
export const sedLevel = lsbdSchema.table("sed_level", {
  id: serial("id").primaryKey(),
  sLevel: text("s_level"),                                              // short code (e.g. "I","II","III","DS")
  description: text("description"),
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// RENEWALS
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// Renewals: one row per licensee per renewal cycle (19,615 rows).
export const renewals = lsbdSchema.table("renewals", {
  id: serial("id").primaryKey(),                                        // was Renewal_ID (int)
  individualId: integer("individual_id"),                               // FK to individual (core slice)
  appPrinted: timestamp("app_printed", { withTimezone: true }),
  licensePrinted: timestamp("license_printed", { withTimezone: true }),
  renewalAmount: numeric("renewal_amount", { precision: 19, scale: 4 }),
  renewalYear: text("renewal_year"),
  transactionDate: timestamp("transaction_date", { withTimezone: true }),
  lastUpdate: timestamp("last_update", { withTimezone: true }),
  amountPaid: numeric("amount_paid", { precision: 19, scale: 4 }),
  pPermitPrinted: timestamp("p_permit_printed", { withTimezone: true }), // personal permit
  oPermitPrinted: timestamp("o_permit_printed", { withTimezone: true }), // office permit
});

// RenewalCertification: per-year per-licensee yes/no answers (37,658 rows).
// Source `nvarchar(4)` columns store "Y"/"N" â€” kept as text for fidelity, but
// human reviewer should consider booleans on import.
export const renewalCertification = lsbdSchema.table("renewal_certification", {
  id: serial("id").primaryKey(),
  denHygId: integer("den_hyg_id").notNull(),                            // FK to license/tblDenHyg row (core slice)
  year: integer("year").notNull(),
  anesIncident: text("anes_incident"),
  convicted: text("convicted"),
  discipline: text("discipline"),
  ce: text("ce"),
});

// RenewalDetails: bridges Renewals to Permits (1,083 rows).
export const renewalDetails = lsbdSchema.table("renewal_details", {
  id: serial("id").primaryKey(),                                        // was RenewalDetail_ID
  renewalId: integer("renewal_id").references(() => renewals.id),
  permitId: integer("permit_id").references(() => permits.id),
  printed: timestamp("printed", { withTimezone: true }),
});

// RenewalSettings: per-cycle policy table (4 rows â€” one per LicenseType).
export const renewalSettings = lsbdSchema.table("renewal_settings", {
  id: serial("id").primaryKey(),
  licenseType: text("license_type").notNull(),                          // 1-char code (D/H/...)
  expirationDate: timestamp("expiration_date", { withTimezone: true }).notNull(),
  renewalDate: timestamp("renewal_date", { withTimezone: true }).notNull(),
  fee: numeric("fee", { precision: 19, scale: 4 }).notNull(),
  wellBeingFee: numeric("well_being_fee", { precision: 19, scale: 4 }).notNull(),
  lateFee: numeric("late_fee", { precision: 19, scale: 4 }).notNull(),
  startDate: timestamp("start_date", { withTimezone: true }).notNull(),
  lateDate: timestamp("late_date", { withTimezone: true }).notNull(),
  endDate: timestamp("end_date", { withTimezone: true }).notNull(),
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// FINANCIAL / TRANSACTIONS
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// tblTransactions: cash/check/CC events (72,117 rows).
export const transactions = lsbdSchema.table("transactions", {
  id: serial("id").primaryKey(),
  transRef: integer("trans_ref"),                                       // was TransId (legacy app reference)
  legacyKey: integer("legacy_key"),                                     // was Key (legacy app reference)
  licenseId: text("license_id"),                                        // string license # as in source
  name: text("name"),
  description: text("description"),
  dateDeposit: timestamp("date_deposit", { withTimezone: true }),
  renewMonth: text("renew_month"),
  expYear: text("exp_year"),
  refNum: text("ref_num"),
  depositNo: text("deposit_no"),
  fee: doublePrecision("fee"),
  penalty: doublePrecision("penalty"),
  total: doublePrecision("total"),
  type: text("type"),                                                   // textual type (matches trans_type.trans_type)
  ceHours: doublePrecision("ce_hours"),
  printed: boolean("printed"),
  assFee: doublePrecision("ass_fee"),                                   // association fee
  dateRenew: timestamp("date_renew", { withTimezone: true }),
  dateTrans: timestamp("date_trans", { withTimezone: true }),
  issued: text("issued"),
  dateStamp: timestamp("date_stamp", { withTimezone: true }),
  timeStamp: text("time_stamp"),
  printDate: timestamp("print_date", { withTimezone: true }),
  mailDate: timestamp("mail_date", { withTimezone: true }),
  appPrinted: timestamp("app_printed", { withTimezone: true }),
  lastUpdated: timestamp("last_updated", { withTimezone: true }),
  oPermitPrinted: timestamp("o_permit_printed", { withTimezone: true }),
  pPermitPrinted: timestamp("p_permit_printed", { withTimezone: true }),
  renewalId: integer("renewal_id").references(() => renewals.id),       // resolved from RenewalID guid
  individualId: integer("individual_id"),                               // FK to individual (core slice) â€” was uniqueidentifier
  wellBeingFee: doublePrecision("well_being_fee"),
});

// tblTransSplits: per-line breakout of a transaction (125,682 rows).
export const transactionSplits = lsbdSchema.table("transaction_splits", {
  id: serial("id").primaryKey(),
  transactionId: integer("transaction_id").references(() => transactions.id),
  // NOTE: source has `TransId` (int) AND `Key` (int) AND no FK declared. Best
  // guess is TransId -> tblTransactions.TransId. Verify on data load and either
  // keep `transaction_id` as above (mapped during ETL) or fall back to legacy_key.
  legacyKey: integer("legacy_key"),
  licenseId: text("license_id"),
  name: text("name"),
  description: text("description"),
  refNum: text("ref_num"),
  fee: doublePrecision("fee"),
  type: text("type"),                                                   // matches trans_type.trans_type
  dateTrans: timestamp("date_trans", { withTimezone: true }),
});

// tblTransTypes: 7-row lookup. Renewal=1, Registration=2, CDP=3, Penalty=4,
// Duplicate=5, Misc.=6, WellBeing=7.
export const transType = lsbdSchema.table("trans_type", {
  id: serial("id").primaryKey(),
  transType: text("trans_type").notNull(),
});

// tblFees: SOURCE WAS A SINGLE-ROW 43-COLUMN "SETTINGS BAG". Normalized into
// `(id, fee_code, amount)`. Original column ordering (pos 2..43):
//   2 DenRegFee, 3 HygRegFee, 4 PARegFee, 5 PLLCRegFee, 6 ASRegFee,
//   7 IntRegFee, 8 PrvRegFee, 9 DenRnwFee, 10 HygRnwFee, 11 PARnwFee,
//   12 PLLCRnwFee, 13 ASRnwFee, 14 IntRnwFee, 15 PrvRnwFee,
//   16 DenLateFee, 17 HygLateFee, 18 PALateFee, 19 PLLCLateFee, 20 ASLateFee,
//   21 IntLateFee, 22 PrvLateFee,
//   23 DenAssFee, 24 HygAssFee, 25 IntAssFee, 26 PrvAssFee,
//   27 DenReinFee, 28 HygReinFee, 29 PAReinFee, 30 PLLCReinFee, 31 ASReinFee,
//   32 IntReinFee, 33 PrvReinFee,
//   34 VolDenRnwFee, 35 VolDenRegFee, 36 VolHygRnwFee, 37 VolHygRegFee,
//   38 CreDenRegFee, 39 CreHygRegFee, 40 InsDenRnwFee, 41 InsDenRegFee,
//   42 WellBeingFeeDen, 43 WellBeingFeeHyg
// ETL: explode the single source row into 42 inserts where fee_code is the
// original column name (e.g. "DenRegFee") and amount is its money value.
export const fee = lsbdSchema.table("fee", {
  id: serial("id").primaryKey(),
  feeCode: text("fee_code").notNull().unique(),                         // "DenRegFee", etc.
  amount: numeric("amount", { precision: 19, scale: 4 }),
  description: text("description"),                                     // optional human label, blank on import
});

// tblChargeCategory: 37 rows. CHARGE_CAT short code + description.
export const chargeCategory = lsbdSchema.table("charge_category", {
  id: serial("id").primaryKey(),
  chargeCat: text("charge_cat"),
  description: text("description"),                                     // was DESCRIPT
});

// tblChargeInt: 20 rows. INT_CHRG short code + description.
export const chargeInt = lsbdSchema.table("charge_int", {
  id: serial("id").primaryKey(),
  intCharge: text("int_charge"),                                        // was INT_CHRG
  description: text("description"),                                     // was DESCRIPT
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// INSPECTIONS
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// Inspections: office inspection events (7,353 rows). Lots of D_*/E_*/C_*
// free-text + ntext columns â€” the "rubric" is encoded in column names. Keeping
// all of them flat for fidelity; CMS form rebuilds will model these properly.
export const inspections = lsbdSchema.table("inspections", {
  id: serial("id").primaryKey(),                                        // was INSPECTID (int)
  officeId: integer("office_id"),                                       // FK to office (reference slice)
  inspectionDate: timestamp("inspection_date", { withTimezone: true }),
  inspectionNote: text("inspection_note"),                              // ntext
  score: integer("score"),
  d1: text("d1"),
  d1List: text("d1_list"),                                              // ntext
  d1Notes: text("d1_notes"),                                            // ntext
  d2: text("d2"),
  e1: text("e1"),
  e1Notes: text("e1_notes"),                                            // ntext
  inspectorId: integer("inspector_id"),                                 // FK to user/staff (core slice)
  inspectionStatusId: integer("inspection_status_id").references(() => inspectionStatus.id),
  address1: text("address1"),
  address2: text("address2"),
  address3: text("address3"),
  city: text("city"),
  state: text("state"),
  postalCode: text("postal_code"),
  c1List: text("c1_list"),                                              // ntext
  c1Notes: text("c1_notes"),                                            // ntext
  c2: text("c2"),
  c3: text("c3"),
  c4: text("c4"),
  e2: text("e2"),
  e2List: text("e2_list"),                                              // ntext
  e2Notes: text("e2_notes"),                                            // ntext
  phone: text("phone"),
  violations: text("violations"),                                       // ntext
  status: text("status"),                                               // legacy denormalized status string
  inspector: text("inspector"),                                         // legacy denormalized inspector name
});

// InspectionDetails: per-staff-member checklist entries (61 rows). A_1..A_9 are
// Yes/No checkboxes â€” kept flat (only 9). If the checklist meaning gets
// formalized later, normalize into (inspection_detail_id, question_code, answer).
export const inspectionDetails = lsbdSchema.table("inspection_details", {
  id: serial("id").primaryKey(),                                        // was InspectionDetail_ID
  inspectionId: integer("inspection_id").references(() => inspections.id),
  individualId: integer("individual_id"),                               // FK to individual (core slice)
  lastName: text("last_name"),
  firstName: text("first_name"),
  middleName: text("middle_name"),
  marriedName: text("married_name"),
  licenseName: text("license_name"),
  suffix: text("suffix"),
  prefix: text("prefix"),
  role: text("role"),
  a1: boolean("a1"),
  a2: boolean("a2"),
  a3: boolean("a3"),
  a4: boolean("a4"),
  a5: boolean("a5"),
  a6: boolean("a6"),
  a7: boolean("a7"),
  a8: boolean("a8"),
  a9: boolean("a9"),
});

// InspectionStatus: 2-row lookup (Pass / Fail or similar).
export const inspectionStatus = lsbdSchema.table("inspection_status", {
  id: serial("id").primaryKey(),
  inspectionStatus: text("inspection_status"),
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// EDUCATION + EXAMS
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// Education: per-licensee education record (16,759 rows).
export const education = lsbdSchema.table("education", {
  id: serial("id").primaryKey(),                                        // was Education_ID
  professionalId: integer("professional_id"),                           // FK to professional (core slice)
  individualId: integer("individual_id"),                               // FK to individual (core slice)
  denHygId: integer("den_hyg_id"),                                      // FK to license (core slice)
  educationTypeId: integer("education_type_id").references(() => educationType.id),
  school: text("school"),
  graduationDate: timestamp("graduation_date", { withTimezone: true }),
  updated: timestamp("updated", { withTimezone: true }),
  schoolStateId: integer("school_state_id"),                            // FK to states (reference slice)
  boardCertified: boolean("board_certified"),
  certifiedBy: text("certified_by"),
  certificationDate: timestamp("certification_date", { withTimezone: true }),
  state: text("state"),                                                 // denormalized state name
  eduType: text("edu_type"),                                            // denormalized education-type name
});

// EducationType: 6-row lookup (DDS/DMD/RDH/etc.).
export const educationType = lsbdSchema.table("education_type", {
  id: serial("id").primaryKey(),
  educationType: text("education_type"),
});

// tblExamsDent: dental licensure exam scores + applicant document checklist (347 rows).
export const dentExam = lsbdSchema.table("dent_exam", {
  id: serial("id").primaryKey(),
  legacyKey: integer("legacy_key"),                                     // was Key1
  licenseId: text("license_id"),
  prepAmal: numeric("prep_amal", { precision: 6, scale: 2 }),
  restAmal: numeric("rest_amal", { precision: 6, scale: 2 }),
  prepComp: numeric("prep_comp", { precision: 6, scale: 2 }),
  restComp: numeric("rest_comp", { precision: 6, scale: 2 }),
  endo: numeric("endo", { precision: 6, scale: 2 }),
  avgLab: numeric("avg_lab", { precision: 6, scale: 2 }),
  pros: numeric("pros", { precision: 6, scale: 2 }),
  perio: numeric("perio", { precision: 6, scale: 2 }),
  written: numeric("written", { precision: 6, scale: 2 }),
  juris: numeric("juris", { precision: 6, scale: 2 }),
  sterile: numeric("sterile", { precision: 6, scale: 2 }),
  grade: numeric("grade", { precision: 6, scale: 2 }),
  remarks: text("remarks"),                                             // ntext
  natBoardScores: boolean("nat_board_scores").default(false),
  denHygSchoolTrans: boolean("den_hyg_school_trans").default(false),
  otherTrans: boolean("other_trans").default(false),
  photos: boolean("photos").default(false),
  examFee: boolean("exam_fee").default(false),
  recoLetters: boolean("reco_letters").default(false),
  regisLetter: boolean("regis_letter").default(false),
  completeAppl: boolean("complete_appl").default(false),
  licensureCert: boolean("licensure_cert").default(false),
  insuranceVerify: boolean("insurance_verify").default(false),
  dataBankRpt: boolean("data_bank_rpt").default(false),
  recordedAt: timestamp("recorded_at", { withTimezone: true }),         // was TIMESTAMP (default getdate())
});

// tblExamsHyg: hygiene licensure exam record + checklist (360 rows).
// Source had numeric scores as nvarchar(26) (sloppy schema); kept as text.
export const hygExam = lsbdSchema.table("hyg_exam", {
  id: serial("id").primaryKey(),
  legacyKey: integer("legacy_key"),                                     // was Key1
  licenseId: text("license_id"),
  clinical: text("clinical"),
  juris: text("juris"),
  sterile: text("sterile"),
  juris2: text("juris2"),
  sterile2: text("sterile2"),
  passFail: text("pass_fail"),
  remarks: text("remarks"),                                             // ntext
  natBoardScores: boolean("nat_board_scores").default(false),
  denHygSchoolTrans: boolean("den_hyg_school_trans").default(false),
  otherTrans: boolean("other_trans").default(false),
  photos: boolean("photos").default(false),
  examFee: boolean("exam_fee").default(false),
  recoLetters: boolean("reco_letters").default(false),
  regisLetter: boolean("regis_letter").default(false),
  completeAppl: boolean("complete_appl").default(false),
  licensureCert: boolean("licensure_cert").default(false),
  insuranceVerify: boolean("insurance_verify").default(false),
  recordedAt: timestamp("recorded_at", { withTimezone: true }),         // was TIMESTAMP (default getdate())
});

// tblSchools: 351 rows. Reference list of dental/hygiene schools.
export const schools = lsbdSchema.table("schools", {
  id: serial("id").primaryKey(),
  schState: text("sch_state"),                                          // 2-letter state
  schName: text("sch_name"),
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// RANDOM SAMPLING (CE audits)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//
// DECISION: source is NOT 100 boolean checkboxes. The 100 columns are an audit
// snapshot of every relevant licensee field at the time of selection: license
// info, name parts, addresses (3 sets â€” primary, office, public), demographics,
// practice statistics, CE hours, controlled-substance permissions, etc. So we
// keep them flat (one row = one audit-year snapshot for one licensee). HUMAN
// REVIEW: confirm this is desired vs. just storing (sample_id, individual_id,
// audit_year, snapshot_jsonb). The flat schema below preserves source fidelity
// and lets the CMS render snapshots directly without joining historic data.
//
// `INACTIVE2` (bit) at column 99 is preserved as `inactive_flag` to disambiguate
// from the text `INACTIVE` column.

export const randomSampleDentists = lsbdSchema.table("random_sample_dentists", {
  id: serial("id").primaryKey(),                                        // was Key (int)
  licenseId: text("license_id"),
  type: text("type"),
  class: text("class"),
  status: text("status"),
  dateSince: timestamp("date_since", { withTimezone: true }),
  dateInactive: timestamp("date_inactive", { withTimezone: true }),
  dateReinstate: timestamp("date_reinstate", { withTimezone: true }),
  dateUpdated: timestamp("date_updated", { withTimezone: true }),
  dateRenew: timestamp("date_renew", { withTimezone: true }),
  dateUntil: timestamp("date_until", { withTimezone: true }),
  regYear: text("reg_year"),
  paNo: text("pa_no"),
  pllcNo: text("pllc_no"),
  permitNo: text("permit_no"),
  firstName: text("first_name"),
  middle: text("middle"),
  lastName: text("last_name"),
  dob: timestamp("dob", { withTimezone: true }),                        // PII â€” restrict in RLS
  sex: text("sex"),                                                     // PII â€” restrict in RLS
  race: text("race"),                                                   // PII â€” restrict in RLS
  specialty: text("specialty"),
  active: text("active"),
  inactive: text("inactive"),
  prinSet: text("prin_set"),
  formEmpl: text("form_empl"),
  hrsWk: doublePrecision("hrs_wk"),
  patientCr: doublePrecision("patient_cr"),
  numDent: doublePrecision("num_dent"),
  numHygen: doublePrecision("num_hygen"),
  numDa1: doublePrecision("num_da1"),
  numDa2: doublePrecision("num_da2"),
  satCity1: text("sat_city1"),
  satCity2: text("sat_city2"),
  ceHours: doublePrecision("ce_hours"),
  useAnes: text("use_anes"),
  useSedat: text("use_sedat"),
  address1: text("address1"),
  address2: text("address2"),
  city: text("city"),
  state: text("state"),
  zip: text("zip"),
  county: text("county"),
  addrType: text("addr_type"),
  complaint: text("complaint"),
  ssn: text("ssn"),                                                     // PII â€” restrict in RLS, hash before exposing
  email: text("email"),
  url: text("url"),
  location: text("location"),
  phone1: text("phone1"),
  ext1: text("ext1"),
  phone2: text("phone2"),
  ext2: text("ext2"),
  fax: text("fax"),
  notes: text("notes"),                                                 // ntext
  addressO1: text("address_o1"),                                        // office addr
  addressO2: text("address_o2"),
  cityO: text("city_o"),
  stateO: text("state_o"),
  zipO: text("zip_o"),
  countyO: text("county_o"),
  oAddrType: text("o_addr_type"),
  schName: text("sch_name"),
  schState: text("sch_state"),
  gradYear: smallint("grad_year"),
  degree: smallint("degree"),
  renewMonth: text("renew_month"),
  addressP1: text("address_p1"),                                        // public addr
  addressP2: text("address_p2"),
  cityP: text("city_p"),
  stateP: text("state_p"),
  zipP: text("zip_p"),
  countyP: text("county_p"),
  audit: text("audit"),
  action: text("action"),
  background: boolean("background"),
  cpr: text("cpr"),
  ceNotReq: text("ce_not_req"),
  fax2: text("fax2"),
  limitedSupDh: text("limited_sup_dh"),
  licenseName: text("license_name"),
  marriedName: text("married_name"),
  prefix: text("prefix"),
  suffix: text("suffix"),
  processingGroup: text("processing_group"),
  individualLegacyId: integer("individual_legacy_id"),                  // was IndividualID_ (int)
  individualId: integer("individual_id"),                               // FK to individual (core slice) â€” was uniqueidentifier
  updated: timestamp("updated", { withTimezone: true }),
  legacyId: integer("legacy_id"),                                       // was ID (int, unused as PK)
  useLicenseName: boolean("use_license_name"),
  isCurrent: boolean("is_current"),
  address3: text("address3"),
  country: text("country"),
  csNone: boolean("cs_none"),
  csDispense: boolean("cs_dispense"),
  csAdminister: boolean("cs_administer"),
  auditYear: text("audit_year"),
  credentialExam: text("credential_exam"),
  inactiveFlag: boolean("inactive_flag"),                               // was INACTIVE2 (bit)
  updatedBy: text("updated_by"),
});

// Same shape as random_sample_dentists; consider unifying via a `discriminator`
// column ("dentist"/"hygienist") if the columns truly never diverge. For now
// keeping them split to mirror source. HUMAN REVIEW.
export const randomSampleHygienists = lsbdSchema.table("random_sample_hygienists", {
  id: serial("id").primaryKey(),                                        // was Key (int)
  licenseId: text("license_id"),
  type: text("type"),
  class: text("class"),
  status: text("status"),
  dateSince: timestamp("date_since", { withTimezone: true }),
  dateInactive: timestamp("date_inactive", { withTimezone: true }),
  dateReinstate: timestamp("date_reinstate", { withTimezone: true }),
  dateUpdated: timestamp("date_updated", { withTimezone: true }),
  dateRenew: timestamp("date_renew", { withTimezone: true }),
  dateUntil: timestamp("date_until", { withTimezone: true }),
  regYear: text("reg_year"),
  paNo: text("pa_no"),
  pllcNo: text("pllc_no"),
  permitNo: text("permit_no"),
  firstName: text("first_name"),
  middle: text("middle"),
  lastName: text("last_name"),
  dob: timestamp("dob", { withTimezone: true }),                        // PII
  sex: text("sex"),                                                     // PII
  race: text("race"),                                                   // PII
  specialty: text("specialty"),
  active: text("active"),
  inactive: text("inactive"),
  prinSet: text("prin_set"),
  formEmpl: text("form_empl"),
  hrsWk: doublePrecision("hrs_wk"),
  patientCr: doublePrecision("patient_cr"),
  numDent: doublePrecision("num_dent"),
  numHygen: doublePrecision("num_hygen"),
  numDa1: doublePrecision("num_da1"),
  numDa2: doublePrecision("num_da2"),
  satCity1: text("sat_city1"),
  satCity2: text("sat_city2"),
  ceHours: doublePrecision("ce_hours"),
  useAnes: text("use_anes"),
  useSedat: text("use_sedat"),
  address1: text("address1"),
  address2: text("address2"),
  city: text("city"),
  state: text("state"),
  zip: text("zip"),
  county: text("county"),
  addrType: text("addr_type"),
  complaint: text("complaint"),
  ssn: text("ssn"),                                                     // PII
  email: text("email"),
  url: text("url"),
  location: text("location"),
  phone1: text("phone1"),
  ext1: text("ext1"),
  phone2: text("phone2"),
  ext2: text("ext2"),
  fax: text("fax"),
  notes: text("notes"),
  addressO1: text("address_o1"),
  addressO2: text("address_o2"),
  cityO: text("city_o"),
  stateO: text("state_o"),
  zipO: text("zip_o"),
  countyO: text("county_o"),
  oAddrType: text("o_addr_type"),
  schName: text("sch_name"),
  schState: text("sch_state"),
  gradYear: smallint("grad_year"),
  degree: smallint("degree"),
  renewMonth: text("renew_month"),
  addressP1: text("address_p1"),
  addressP2: text("address_p2"),
  cityP: text("city_p"),
  stateP: text("state_p"),
  zipP: text("zip_p"),
  countyP: text("county_p"),
  audit: text("audit"),
  action: text("action"),
  background: boolean("background"),
  cpr: text("cpr"),
  ceNotReq: text("ce_not_req"),
  fax2: text("fax2"),
  limitedSupDh: text("limited_sup_dh"),
  licenseName: text("license_name"),
  marriedName: text("married_name"),
  prefix: text("prefix"),
  suffix: text("suffix"),
  processingGroup: text("processing_group"),
  individualLegacyId: integer("individual_legacy_id"),
  individualId: integer("individual_id"),                               // FK to individual (core slice)
  updated: timestamp("updated", { withTimezone: true }),
  legacyId: integer("legacy_id"),
  useLicenseName: boolean("use_license_name"),
  isCurrent: boolean("is_current"),
  address3: text("address3"),
  country: text("country"),
  csNone: boolean("cs_none"),
  csDispense: boolean("cs_dispense"),
  csAdminister: boolean("cs_administer"),
  auditYear: text("audit_year"),
  credentialExam: text("credential_exam"),
  inactiveFlag: boolean("inactive_flag"),
  updatedBy: text("updated_by"),
});

// tblRndAnesthesia: 0 rows; mirrors as_permit shape. Kept thin in case used later.
export const randomSampleAnesthesia = lsbdSchema.table("random_sample_anesthesia", {
  id: serial("id").primaryKey(),                                        // was Key (int)
  licenseId: text("license_id"),
  type: text("type"),
  status: text("status"),
  dateSince: timestamp("date_since", { withTimezone: true }),
  dateInactive: timestamp("date_inactive", { withTimezone: true }),
  dateReinstate: timestamp("date_reinstate", { withTimezone: true }),
  dLicenseId: text("d_license_id"),
  otherDentists: text("other_dentists"),                                // ntext
  training: text("training"),
  trainYear: text("train_year"),
  dateUntil: timestamp("date_until", { withTimezone: true }),
  dateUpdated: timestamp("date_updated", { withTimezone: true }),
  dateRenew: timestamp("date_renew", { withTimezone: true }),
  regYear: text("reg_year"),
  inspectedO: text("inspected_o"),
  inspected: text("inspected"),
  inspectedS1: text("inspected_s1"),
  inspectedS2: text("inspected_s2"),
  renewMonth: text("renew_month"),
  notes: text("notes"),
  audit: text("audit"),
  sLevel: text("s_level"),
});

// tblRndSedation: 0 rows; identical structure to randomSampleAnesthesia.
export const randomSampleSedation = lsbdSchema.table("random_sample_sedation", {
  id: serial("id").primaryKey(),                                        // was Key (int)
  licenseId: text("license_id"),
  type: text("type"),
  status: text("status"),
  dateSince: timestamp("date_since", { withTimezone: true }),
  dateInactive: timestamp("date_inactive", { withTimezone: true }),
  dateReinstate: timestamp("date_reinstate", { withTimezone: true }),
  dLicenseId: text("d_license_id"),
  otherDentists: text("other_dentists"),
  training: text("training"),
  trainYear: text("train_year"),
  dateUntil: timestamp("date_until", { withTimezone: true }),
  dateUpdated: timestamp("date_updated", { withTimezone: true }),
  dateRenew: timestamp("date_renew", { withTimezone: true }),
  regYear: text("reg_year"),
  inspectedO: text("inspected_o"),
  inspected: text("inspected"),
  inspectedS1: text("inspected_s1"),
  inspectedS2: text("inspected_s2"),
  renewMonth: text("renew_month"),
  notes: text("notes"),
  audit: text("audit"),
  sLevel: text("s_level"),
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// RELATIONS (in-slice only; cross-slice relations defined where the target lives)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const permitsRelations = relations(permits, ({ one, many }) => ({
  permitType: one(permitType, {
    fields: [permits.permitTypeId],
    references: [permitType.id],
  }),
  renewalLinks: many(renewalDetails),
}));

export const permitTypeRelations = relations(permitType, ({ many }) => ({
  permits: many(permits),
}));

export const renewalsRelations = relations(renewals, ({ many }) => ({
  details: many(renewalDetails),
  transactions: many(transactions),
}));

export const renewalDetailsRelations = relations(renewalDetails, ({ one }) => ({
  renewal: one(renewals, {
    fields: [renewalDetails.renewalId],
    references: [renewals.id],
  }),
  permit: one(permits, {
    fields: [renewalDetails.permitId],
    references: [permits.id],
  }),
}));

export const transactionsRelations = relations(transactions, ({ one, many }) => ({
  renewal: one(renewals, {
    fields: [transactions.renewalId],
    references: [renewals.id],
  }),
  splits: many(transactionSplits),
}));

export const transactionSplitsRelations = relations(transactionSplits, ({ one }) => ({
  transaction: one(transactions, {
    fields: [transactionSplits.transactionId],
    references: [transactions.id],
  }),
}));

export const inspectionsRelations = relations(inspections, ({ one, many }) => ({
  status: one(inspectionStatus, {
    fields: [inspections.inspectionStatusId],
    references: [inspectionStatus.id],
  }),
  details: many(inspectionDetails),
}));

export const inspectionDetailsRelations = relations(inspectionDetails, ({ one }) => ({
  inspection: one(inspections, {
    fields: [inspectionDetails.inspectionId],
    references: [inspections.id],
  }),
}));

export const educationRelations = relations(education, ({ one }) => ({
  type: one(educationType, {
    fields: [education.educationTypeId],
    references: [educationType.id],
  }),
}));

