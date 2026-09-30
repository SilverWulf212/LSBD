-- 0003_legacy_keys.sql
--
-- Task 10: legacy upsert keys on every lsbd.* table. Fixes the license collapse.
--
-- Named 0003, not 0001, per Ruling R19: 0001_user_roles and 0002_rls already
-- exist. 0002_rls is hand-written and not in drizzle's _journal.json, so this
-- migration is journal idx 2 with tag 0003_legacy_keys.
--
-- WHY
--   The May ETL did ON CONFLICT (license_id) DO NOTHING against a UNIQUE
--   index on license(license_id). LICENSEID is only unique per Type, and 17
--   (Type, LICENSEID) groups are duplicates, so tblDenHyg rows were silently
--   dropped. License identity is tblDenHyg.Key: one source row = one person =
--   one license. This migration:
--     * drops the unique index license_license_id_idx (license_id is NOT unique)
--     * adds the NON-unique index license_type_license_id_idx (type, license_id)
--     * makes license.legacy_key (tblDenHyg.Key) UNIQUE NOT NULL
--     * adds person.legacy_key integer UNIQUE NOT NULL (tblDenHyg.Key)
--     * gives every other lsbd table a PK/UNIQUE constraint on its legacy key,
--       adding legacy_id text UNIQUE NOT NULL where no column held the key
--     * turns the old unique INDEXES that serve as keys (complaint.legacy_key,
--       individual.indv_id, licensee_pii.person_id, person_address
--       (person_id, address_type)) into UNIQUE CONSTRAINTS
--   All lsbd tables are empty (Task 1 truncated them), so NOT NULL is safe.
--
-- CONTRACT FOR TASK 11 (transforms)
--   Each transform does
--     INSERT INTO lsbd.<t> (...) SELECT ... FROM lsbd_raw."<Source>" r
--       WHERE r._deleted_at IS NULL
--     ON CONFLICT (<key cols>) DO UPDATE SET ...
--   and deletes lsbd rows whose key has no live raw row, using NOT EXISTS.
--   Key value encodings (must be identical on every run):
--     id          serial PK that HOLDS the source integer PK. Insert it
--                 explicitly (r."<PK>"), then setval() the id sequence to
--                 max(id) so app-created rows cannot collide.
--                 (tbl_form_empl.id is text: the source code verbatim.)
--     legacy_id   text. Integer source key -> r."<col>"::text (plain decimal,
--                 no padding). uuid source key -> lower(r."<col>"::text).
--                 nvarchar source key -> the value exactly as in lsbd_raw.
--                 The serial id stays generated; never overwrite it on conflict.
--     legacy_key / legacy_id integer / indv_id: the source int key, verbatim.
--     person_id   (tblDenHyg children) = (SELECT p.id FROM lsbd.person p
--                 WHERE p.legacy_key = r."Key"). Upsert person first, so
--                 person.id is stable across runs.
--   Rows whose source key is NULL cannot be keyed: skip and count them as
--   orphans (only possible for the sources marked "(none)" below).
--
-- KEY MAP (86 tables). Parsed by scripts/verify-legacy-keys.ts. Keep the row
-- format: "--  <lsbd table> | <source dbo table> | <source PK> | <key cols> | <notes>".
-- "key cols" is the exact column set of a PK or UNIQUE constraint.
-- BEGIN KEY MAP
--  activity                 | Activity              | (none) ActivityID uuid         | legacy_id              | lower(ActivityID); 0 rows today
--  address                  | ADDRESS               | Address_ID                     | id                     |
--  address_history          | AddressHistory        | ID                             | id                     |
--  address_type_lookup      | AddressType           | AddressType_ID                 | legacy_id              |
--  announcements            | Announcements         | ANNOUNCID                      | id                     |
--  app_settings             | tblNumbers, tblDates, Control | one row per source column | key            | counter.<col> (tblNumbers), date.<col> (tblDates), control.<col> (Control); ID columns skipped
--  as_permit                | tblASPermits          | Key                            | id                     |
--  association_history      | AssociationHistory    | ID                             | id                     |
--  board_members            | BoardMembers          | BoardMember_ID                 | id                     |
--  category                 | Catagory              | CATID                          | id                     |
--  charge_category          | tblChargeCategory     | ID                             | legacy_id              |
--  charge_int               | tblChargeInt          | ID                             | legacy_id              |
--  cities                   | Cities                | City_ID                        | legacy_id              |
--  compl_action             | tblComplActions       | ID                             | legacy_id              | action code stays UNIQUE too
--  compl_closure            | tblComplClosure       | ID                             | legacy_id              | closure code stays UNIQUE too
--  compl_decision           | tblComplDecisions     | ID                             | legacy_id              | decision code stays UNIQUE too
--  compl_hearing            | tblComplHearings      | ID                             | legacy_id              | hearing code stays UNIQUE too
--  compl_probation          | tblComplProbation     | ID                             | legacy_id              | probation code stays UNIQUE too
--  compl_status             | tblComplStatus        | ID                             | legacy_id              | code stays UNIQUE too
--  complaint                | tblComplaints         | Key                            | legacy_key             | int; id is generated
--  countries                | Countries             | Country_ID                     | legacy_id              |
--  dent_exam                | tblExamsDent          | ID                             | legacy_id              | NOT legacy_key (= Key1, nullable, not the PK)
--  disciplinary             | Disciplinary          | Disciplinary_ID                | legacy_id              | int; PK disciplinary_id (uuid) is NULL in 285 source rows: derive it deterministically, never randomUUID()
--  disposition              | tblDisposition        | ID                             | legacy_id              | code stays UNIQUE too
--  education                | Education             | Education_ID                   | id                     |
--  education_type           | EducationType         | EducationType_ID               | legacy_id              |
--  election_districts       | ElectionDistricts     | ElectionDistrict_ID            | legacy_id              |
--  faqs                     | FAQS                  | FAQSID                         | id                     |
--  fee                      | tblFees               | one row per money column       | fee_code               | fee_code = source column name (DenRegFee ...); single-row source, ID skipped
--  hyg_exam                 | tblExamsHyg           | ID                             | legacy_id              | NOT legacy_key (= Key1, nullable, not the PK)
--  individual               | Individual            | INDVID                         | indv_id                | int; PK individual_id = source IndividualID uuid
--  individual_affiliation   | IndividualAffiliation | IndividualAffiliation_ID       | id                     |
--  individual_status        | IndividualStatus      | IndividualStatus_ID            | id                     |
--  inspection_details       | InspectionDetails     | InspectionDetail_ID            | id                     |
--  inspection_status        | InspectionStatus      | InspectionStatus_ID            | id                     |
--  inspections              | Inspections           | INSPECTID                      | id                     |
--  license                  | tblDenHyg             | Key                            | legacy_key             | int; THE license identity. license_id is NOT unique
--  licensee_pii             | tblDenHyg             | Key (via person)               | person_id              | one PII row per person
--  logins                   | Logins                | ID                             | id                     |
--  office                   | Office                | OFFICE_ID                      | id                     |
--  office_aff_history       | OfficeAffHistory      | ID                             | id                     |
--  office_affiliation       | OfficeAffiliation     | OfficeAffiliation_ID           | id                     |
--  parishes                 | Parishes              | Parish_ID                      | legacy_id              |
--  permit_history           | PermitHistory         | ID                             | id                     |
--  permit_type              | PermitType            | PermitType_ID                  | legacy_id              |
--  permits                  | Permits               | Permits_ID                     | id                     |
--  person                   | tblDenHyg             | Key                            | legacy_key             | int; one person per tblDenHyg row
--  person_address           | tblDenHyg             | Key (via person) x bucket      | person_id,address_type | bucket = home / office / permanent
--  person_education         | tblDenHyg             | Key (via person)               | person_id              |
--  person_meta              | tblDenHyg             | Key (via person)               | person_id              | person_meta.legacy_id = tblDenHyg.ID (not the PK)
--  person_practice_stats    | tblDenHyg             | Key (via person)               | person_id              |
--  practice_type            | PracticeType          | PracticeType_ID                | legacy_id              |
--  professional             | Professional          | Professional_ID                | legacy_id              | int; PK professional_id = source ProfessionalID uuid
--  professional_association | tblPAs                | Key                            | id                     |
--  professional_llc         | tblPLLCs              | Key                            | id                     |
--  professional_type        | ProfessionalType      | ProfessionalType_ID            | legacy_id              |
--  random_sample_anesthesia | tblRndAnesthesia      | Key                            | id                     |
--  random_sample_dentists   | tblRndDentists        | Key                            | id                     | legacy_id int = source ID column (not the PK)
--  random_sample_hygienists | tblRndHygienists      | Key                            | id                     | legacy_id int = source ID column (not the PK)
--  random_sample_sedation   | tblRndSedation        | Key                            | id                     |
--  renewal_certification    | RenewalCertification  | ID                             | id                     |
--  renewal_details          | RenewalDetails        | RenewalDetail_ID               | id                     |
--  renewal_settings         | RenewalSettings       | ID                             | legacy_id              |
--  renewals                 | Renewals              | Renewal_ID                     | id                     |
--  schools                  | tblSchools            | ID                             | id                     |
--  sed_level                | tblSedLevels          | (none) ID int NOT NULL         | legacy_id              | raw PK is _rowid; key on the source ID column
--  specialty                | Specialty             | (none) SpecialtyID uuid        | legacy_id              | lower(SpecialtyID); 0 rows today
--  states                   | States                | State_ID                       | legacy_id              |
--  statute_violations       | StatuteViolations     | (none) StatuteViolationID uuid | legacy_id              | lower(StatuteViolationID); 0 rows today
--  statutes                 | Statutes              | (none) StatuteID uuid          | legacy_id              | lower(StatuteID); 0 rows today
--  tbl_class                | tblClass              | ID                             | legacy_id              |
--  tbl_counties             | tblCounties           | ID                             | legacy_id              |
--  tbl_form_empl            | tblFormEmpl           | ID nchar(4)                    | id                     | id is text = source code verbatim ('03' ...)
--  tbl_inactive_status      | tblnactiveStatus      | ID                             | legacy_id              |
--  tbl_prin_set             | tblPrinSet            | ID                             | legacy_id              |
--  tbl_report_type          | tblReportType         | ID                             | legacy_id              |
--  tbl_specialties          | tblSpecialties        | ID                             | legacy_id              |
--  tbl_status               | tblStatus             | ID                             | legacy_id              |
--  tbl_types                | tblTypes              | ID                             | legacy_id              |
--  trans_type               | tblTransTypes         | ID                             | legacy_id              |
--  transaction_splits       | tblTransSplits        | ID                             | id                     | legacy_key = tblTransSplits.Key (not the PK)
--  transactions             | tblTransactions       | ID                             | id                     | legacy_key = Key, trans_ref = TransId (neither is the PK)
--  users                    | Users                 | User_ID                        | id                     |
--  vs_auth                  | VSAuth                | (none) PNREF NOT NULL          | legacy_id              | source EXCLUDED from sync; stays empty
--  vs_capture               | VsCapture             | (none) PNREF NOT NULL          | legacy_id              | source EXCLUDED from sync; stays empty
--  zipcodes                 | Zipcodes              | ID                             | legacy_id              |
-- END KEY MAP
--
-- Tally: 34 tables keyed on id, 39 on a new legacy_id text column, 13 on
-- another column (person / license / complaint legacy_key; individual indv_id;
-- professional / disciplinary integer legacy_id; licensee_pii and the four
-- person_* children person_id; fee fee_code; app_settings key).
--
-- The statements below are drizzle-kit generated
-- (npx drizzle-kit generate --name legacy_keys) and reconciled against the
-- map above. Apply: npx tsx scripts/apply-migration.ts drizzle/0003_legacy_keys.sql

DROP INDEX "lsbd"."complaint_legacy_key_idx";--> statement-breakpoint
DROP INDEX "lsbd"."individual_indv_id_idx";--> statement-breakpoint
DROP INDEX "lsbd"."license_license_id_idx";--> statement-breakpoint
DROP INDEX "lsbd"."license_legacy_key_idx";--> statement-breakpoint
DROP INDEX "lsbd"."licensee_pii_person_idx";--> statement-breakpoint
DROP INDEX "lsbd"."person_address_person_type_idx";--> statement-breakpoint
ALTER TABLE "lsbd"."complaint" ALTER COLUMN "legacy_key" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "lsbd"."disciplinary" ALTER COLUMN "legacy_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "lsbd"."license" ALTER COLUMN "legacy_key" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "lsbd"."professional" ALTER COLUMN "legacy_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "lsbd"."compl_action" ADD COLUMN "legacy_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "lsbd"."compl_closure" ADD COLUMN "legacy_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "lsbd"."compl_decision" ADD COLUMN "legacy_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "lsbd"."compl_hearing" ADD COLUMN "legacy_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "lsbd"."compl_probation" ADD COLUMN "legacy_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "lsbd"."compl_status" ADD COLUMN "legacy_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "lsbd"."disposition" ADD COLUMN "legacy_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "lsbd"."person" ADD COLUMN "legacy_key" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "lsbd"."charge_category" ADD COLUMN "legacy_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "lsbd"."charge_int" ADD COLUMN "legacy_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "lsbd"."dent_exam" ADD COLUMN "legacy_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "lsbd"."education_type" ADD COLUMN "legacy_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "lsbd"."hyg_exam" ADD COLUMN "legacy_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "lsbd"."permit_type" ADD COLUMN "legacy_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "lsbd"."renewal_settings" ADD COLUMN "legacy_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "lsbd"."sed_level" ADD COLUMN "legacy_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "lsbd"."trans_type" ADD COLUMN "legacy_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "lsbd"."activity" ADD COLUMN "legacy_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "lsbd"."address_type_lookup" ADD COLUMN "legacy_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "lsbd"."cities" ADD COLUMN "legacy_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "lsbd"."countries" ADD COLUMN "legacy_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "lsbd"."election_districts" ADD COLUMN "legacy_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "lsbd"."parishes" ADD COLUMN "legacy_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "lsbd"."practice_type" ADD COLUMN "legacy_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "lsbd"."professional_type" ADD COLUMN "legacy_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "lsbd"."specialty" ADD COLUMN "legacy_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "lsbd"."states" ADD COLUMN "legacy_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "lsbd"."statute_violations" ADD COLUMN "legacy_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "lsbd"."statutes" ADD COLUMN "legacy_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "lsbd"."tbl_class" ADD COLUMN "legacy_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "lsbd"."tbl_counties" ADD COLUMN "legacy_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "lsbd"."tbl_inactive_status" ADD COLUMN "legacy_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "lsbd"."tbl_prin_set" ADD COLUMN "legacy_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "lsbd"."tbl_report_type" ADD COLUMN "legacy_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "lsbd"."tbl_specialties" ADD COLUMN "legacy_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "lsbd"."tbl_status" ADD COLUMN "legacy_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "lsbd"."tbl_types" ADD COLUMN "legacy_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "lsbd"."vs_auth" ADD COLUMN "legacy_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "lsbd"."vs_capture" ADD COLUMN "legacy_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "lsbd"."zipcodes" ADD COLUMN "legacy_id" text NOT NULL;--> statement-breakpoint
CREATE INDEX "license_type_license_id_idx" ON "lsbd"."license" USING btree ("type","license_id");--> statement-breakpoint
ALTER TABLE "lsbd"."compl_action" ADD CONSTRAINT "compl_action_legacy_id_unique" UNIQUE("legacy_id");--> statement-breakpoint
ALTER TABLE "lsbd"."compl_closure" ADD CONSTRAINT "compl_closure_legacy_id_unique" UNIQUE("legacy_id");--> statement-breakpoint
ALTER TABLE "lsbd"."compl_decision" ADD CONSTRAINT "compl_decision_legacy_id_unique" UNIQUE("legacy_id");--> statement-breakpoint
ALTER TABLE "lsbd"."compl_hearing" ADD CONSTRAINT "compl_hearing_legacy_id_unique" UNIQUE("legacy_id");--> statement-breakpoint
ALTER TABLE "lsbd"."compl_probation" ADD CONSTRAINT "compl_probation_legacy_id_unique" UNIQUE("legacy_id");--> statement-breakpoint
ALTER TABLE "lsbd"."compl_status" ADD CONSTRAINT "compl_status_legacy_id_unique" UNIQUE("legacy_id");--> statement-breakpoint
ALTER TABLE "lsbd"."complaint" ADD CONSTRAINT "complaint_legacy_key_unique" UNIQUE("legacy_key");--> statement-breakpoint
ALTER TABLE "lsbd"."disciplinary" ADD CONSTRAINT "disciplinary_legacy_id_unique" UNIQUE("legacy_id");--> statement-breakpoint
ALTER TABLE "lsbd"."disposition" ADD CONSTRAINT "disposition_legacy_id_unique" UNIQUE("legacy_id");--> statement-breakpoint
ALTER TABLE "lsbd"."individual" ADD CONSTRAINT "individual_indv_id_unique" UNIQUE("indv_id");--> statement-breakpoint
ALTER TABLE "lsbd"."license" ADD CONSTRAINT "license_legacy_key_unique" UNIQUE("legacy_key");--> statement-breakpoint
ALTER TABLE "lsbd"."licensee_pii" ADD CONSTRAINT "licensee_pii_person_id_unique" UNIQUE("person_id");--> statement-breakpoint
ALTER TABLE "lsbd"."person" ADD CONSTRAINT "person_legacy_key_unique" UNIQUE("legacy_key");--> statement-breakpoint
ALTER TABLE "lsbd"."person_address" ADD CONSTRAINT "person_address_person_id_address_type_unique" UNIQUE("person_id","address_type");--> statement-breakpoint
ALTER TABLE "lsbd"."person_education" ADD CONSTRAINT "person_education_person_id_unique" UNIQUE("person_id");--> statement-breakpoint
ALTER TABLE "lsbd"."person_meta" ADD CONSTRAINT "person_meta_person_id_unique" UNIQUE("person_id");--> statement-breakpoint
ALTER TABLE "lsbd"."person_practice_stats" ADD CONSTRAINT "person_practice_stats_person_id_unique" UNIQUE("person_id");--> statement-breakpoint
ALTER TABLE "lsbd"."professional" ADD CONSTRAINT "professional_legacy_id_unique" UNIQUE("legacy_id");--> statement-breakpoint
ALTER TABLE "lsbd"."charge_category" ADD CONSTRAINT "charge_category_legacy_id_unique" UNIQUE("legacy_id");--> statement-breakpoint
ALTER TABLE "lsbd"."charge_int" ADD CONSTRAINT "charge_int_legacy_id_unique" UNIQUE("legacy_id");--> statement-breakpoint
ALTER TABLE "lsbd"."dent_exam" ADD CONSTRAINT "dent_exam_legacy_id_unique" UNIQUE("legacy_id");--> statement-breakpoint
ALTER TABLE "lsbd"."education_type" ADD CONSTRAINT "education_type_legacy_id_unique" UNIQUE("legacy_id");--> statement-breakpoint
ALTER TABLE "lsbd"."hyg_exam" ADD CONSTRAINT "hyg_exam_legacy_id_unique" UNIQUE("legacy_id");--> statement-breakpoint
ALTER TABLE "lsbd"."permit_type" ADD CONSTRAINT "permit_type_legacy_id_unique" UNIQUE("legacy_id");--> statement-breakpoint
ALTER TABLE "lsbd"."renewal_settings" ADD CONSTRAINT "renewal_settings_legacy_id_unique" UNIQUE("legacy_id");--> statement-breakpoint
ALTER TABLE "lsbd"."sed_level" ADD CONSTRAINT "sed_level_legacy_id_unique" UNIQUE("legacy_id");--> statement-breakpoint
ALTER TABLE "lsbd"."trans_type" ADD CONSTRAINT "trans_type_legacy_id_unique" UNIQUE("legacy_id");--> statement-breakpoint
ALTER TABLE "lsbd"."activity" ADD CONSTRAINT "activity_legacy_id_unique" UNIQUE("legacy_id");--> statement-breakpoint
ALTER TABLE "lsbd"."address_type_lookup" ADD CONSTRAINT "address_type_lookup_legacy_id_unique" UNIQUE("legacy_id");--> statement-breakpoint
ALTER TABLE "lsbd"."cities" ADD CONSTRAINT "cities_legacy_id_unique" UNIQUE("legacy_id");--> statement-breakpoint
ALTER TABLE "lsbd"."countries" ADD CONSTRAINT "countries_legacy_id_unique" UNIQUE("legacy_id");--> statement-breakpoint
ALTER TABLE "lsbd"."election_districts" ADD CONSTRAINT "election_districts_legacy_id_unique" UNIQUE("legacy_id");--> statement-breakpoint
ALTER TABLE "lsbd"."parishes" ADD CONSTRAINT "parishes_legacy_id_unique" UNIQUE("legacy_id");--> statement-breakpoint
ALTER TABLE "lsbd"."practice_type" ADD CONSTRAINT "practice_type_legacy_id_unique" UNIQUE("legacy_id");--> statement-breakpoint
ALTER TABLE "lsbd"."professional_type" ADD CONSTRAINT "professional_type_legacy_id_unique" UNIQUE("legacy_id");--> statement-breakpoint
ALTER TABLE "lsbd"."specialty" ADD CONSTRAINT "specialty_legacy_id_unique" UNIQUE("legacy_id");--> statement-breakpoint
ALTER TABLE "lsbd"."states" ADD CONSTRAINT "states_legacy_id_unique" UNIQUE("legacy_id");--> statement-breakpoint
ALTER TABLE "lsbd"."statute_violations" ADD CONSTRAINT "statute_violations_legacy_id_unique" UNIQUE("legacy_id");--> statement-breakpoint
ALTER TABLE "lsbd"."statutes" ADD CONSTRAINT "statutes_legacy_id_unique" UNIQUE("legacy_id");--> statement-breakpoint
ALTER TABLE "lsbd"."tbl_class" ADD CONSTRAINT "tbl_class_legacy_id_unique" UNIQUE("legacy_id");--> statement-breakpoint
ALTER TABLE "lsbd"."tbl_counties" ADD CONSTRAINT "tbl_counties_legacy_id_unique" UNIQUE("legacy_id");--> statement-breakpoint
ALTER TABLE "lsbd"."tbl_inactive_status" ADD CONSTRAINT "tbl_inactive_status_legacy_id_unique" UNIQUE("legacy_id");--> statement-breakpoint
ALTER TABLE "lsbd"."tbl_prin_set" ADD CONSTRAINT "tbl_prin_set_legacy_id_unique" UNIQUE("legacy_id");--> statement-breakpoint
ALTER TABLE "lsbd"."tbl_report_type" ADD CONSTRAINT "tbl_report_type_legacy_id_unique" UNIQUE("legacy_id");--> statement-breakpoint
ALTER TABLE "lsbd"."tbl_specialties" ADD CONSTRAINT "tbl_specialties_legacy_id_unique" UNIQUE("legacy_id");--> statement-breakpoint
ALTER TABLE "lsbd"."tbl_status" ADD CONSTRAINT "tbl_status_legacy_id_unique" UNIQUE("legacy_id");--> statement-breakpoint
ALTER TABLE "lsbd"."tbl_types" ADD CONSTRAINT "tbl_types_legacy_id_unique" UNIQUE("legacy_id");--> statement-breakpoint
ALTER TABLE "lsbd"."vs_auth" ADD CONSTRAINT "vs_auth_legacy_id_unique" UNIQUE("legacy_id");--> statement-breakpoint
ALTER TABLE "lsbd"."vs_capture" ADD CONSTRAINT "vs_capture_legacy_id_unique" UNIQUE("legacy_id");--> statement-breakpoint
ALTER TABLE "lsbd"."zipcodes" ADD CONSTRAINT "zipcodes_legacy_id_unique" UNIQUE("legacy_id");