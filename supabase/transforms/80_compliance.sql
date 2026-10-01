-- supabase/transforms/80_compliance.sql
--
-- Domain "compliance" (Task 14): complaint, disciplinary, activity, statute_violations,
-- logins, dent_exam, hyg_exam, and the CE-audit random samples random_sample_dentists /
-- _hygienists / _anesthesia / _sedation. Ported from scripts/etl-b4.ts; the random samples
-- (deferred by the May ETL) map 1:1 from their sources, column for column, and activity /
-- statute_violations (0 rows today) from the reference.ts comments.
--
-- Value rules (as in Task 11): strOrNull -> lsbd._s(x); boolOr(x, false) -> COALESCE(x,
-- false) (exam checklists); numbers pass through; every timestamptz target is
-- (<col> AT TIME ZONE 'America/Chicago').
-- Keys (0003 KEY MAP):
--   complaint.legacy_key = tblComplaints.Key (id generated)
--   disciplinary.legacy_id = Disciplinary_ID (int); PK disciplinary_id: see below
--   activity.legacy_id = lower(ActivityID::text), statute_violations.legacy_id =
--     lower(StatuteViolationID::text): the sources have no PK, so duplicates are tolerated
--     with DISTINCT ON (key) ORDER BY key, _rowid (first raw row wins; later ones skipped +
--     counted) (controller carry 5)
--   logins.id = ID; dent_exam.legacy_id / hyg_exam.legacy_id = ID::text (NOT Key1, which
--     is legacy_key); random_sample_*.id = Key (legacy_id int = the source ID column).
--
-- DISCIPLINARY UUID (controller carry 4). lsbd.disciplinary's PK disciplinary_id is uuid
-- NOT NULL, but 285 of 644 live source rows have DisciplinaryID NULL. Such a row gets
--     extensions.uuid_generate_v5(extensions.uuid_ns_url(),
--                                 'lsbd:Disciplinary:Disciplinary_ID:' || Disciplinary_ID)
-- i.e. an RFC 4122 version-5 (SHA-1, name-based) uuid in the standard URL namespace over
-- the declared key Disciplinary_ID (the source int PK, which never changes). The same row
-- therefore gets the same uuid on every run, on every machine, after any reload; nothing
-- random (never gen_random_uuid() / randomUUID(), which the May ETL used). A row with a
-- real DisciplinaryID keeps it. A duplicated DisciplinaryID (0 today) keeps the lowest
-- Disciplinary_ID; later rows are skipped + counted.
--
-- References: "lookup, not gate" (controller carry 1); an unresolved reference is NULL and
-- counted 'unlinked' in lsbd._transform_quality.
--   disciplinary.individual_id -> individual (uuid, DB FK, nullable): IndividualID uuid
--     through lsbd._src_individual, else the Individual_ID int -> INDVID (the two never
--     disagree in the source; 239 rows have only the int). _unlink() NULLs it before
--     entities deletes the Individual. (The May ETL used the uuid only.)
--   random_sample_dentists / _hygienists.individual_id (integer, "was uniqueidentifier"):
--     the source IndividualID uuid matches no Individual (as on tblDenHyg), so the working
--     link IndividualID_ -> INDVID is used, as 40_denhyg_pii does: the INDVID of a live
--     Individual, else NULL. individual_legacy_id keeps IndividualID_ verbatim.
--   statute_violations.disciplinary_id (int, no DB FK) = the legacy_id of the disciplinary
--     row with that DisciplinaryID; statute_id (no DB FK, statutes.id GENERATED) via
--     _src_statutes legacy_uid -> legacy_id -> JOIN statutes.legacy_id (controller carry 2).
-- logins: license_id, lic_type and login_date are NOT NULL in lsbd; a row with any of them
--   NULL or '' is skipped + counted (the May ETL skipped the same rows); values verbatim.
-- random_sample_dentists / _hygienists.ssn is always NULL (ruling R29): the SSN HMAC lives
--   only in lsbd.licensee_pii, as individual.ssn is NULL (Task 11); a sample reaches it by
--   joining person / license. The column stays only because the DDL has it. dob / sex /
--   race are PII (RLS).
-- activity.attachment_url is not written: the source Attachment is a blob, not a URL.

DROP VIEW IF EXISTS lsbd._src_complaint, lsbd._src_disciplinary, lsbd._src_activity,
  lsbd._src_statute_violations, lsbd._src_logins, lsbd._src_dent_exam, lsbd._src_hyg_exam,
  lsbd._src_random_sample_dentists, lsbd._src_random_sample_hygienists,
  lsbd._src_random_sample_anesthesia, lsbd._src_random_sample_sedation CASCADE;

CREATE VIEW lsbd._src_complaint WITH (security_invoker = true) AS
SELECT r."Key"                  AS legacy_key,
       lsbd._s(r."LICENSEID")   AS license_id,
       lsbd._s(r."LOG_NO")      AS log_no,
       (r."LOG_DT"     AT TIME ZONE 'America/Chicago') AS log_date,
       (r."CLOSE_DT"   AT TIME ZONE 'America/Chicago') AS close_date,
       (r."DECIS_DT"   AT TIME ZONE 'America/Chicago') AS decision_date,
       (r."LAST_VISIT" AT TIME ZONE 'America/Chicago') AS last_visit,
       lsbd._s(r."OPEN")        AS open,
       lsbd._s(r."STATUS")      AS status,
       lsbd._s(r."INT_CHRG1")   AS int_charge1,
       lsbd._s(r."INT_CHRG2")   AS int_charge2,
       lsbd._s(r."INT_CHRG3")   AS int_charge3,
       lsbd._s(r."CHRGE_CAT1")  AS charge_cat1,
       lsbd._s(r."CHRGE_CAT2")  AS charge_cat2,
       lsbd._s(r."CHRGE_CAT3")  AS charge_cat3,
       lsbd._s(r."CHARGE1")     AS charge1,
       lsbd._s(r."CHARGE2")     AS charge2,
       lsbd._s(r."CHARGE3")     AS charge3,
       lsbd._s(r."BOARDMEMBR")  AS board_member,
       lsbd._s(r."INVESTIGTR")  AS investigator,
       lsbd._s(r."COMPLNANT")   AS complainant,
       lsbd._s(r."HEARING")     AS hearing,
       lsbd._s(r."DEC_TYPE")    AS decision_type,
       lsbd._s(r."ACTION")      AS action,
       lsbd._s(r."SUSP_PRD")    AS susp_period,
       (r."SUSP_BEGIN" AT TIME ZONE 'America/Chicago') AS susp_begin,
       (r."SUSP_END"   AT TIME ZONE 'America/Chicago') AS susp_end,
       lsbd._s(r."PROB_PRD")    AS prob_period,
       (r."PROB_BEGIN" AT TIME ZONE 'America/Chicago') AS prob_begin,
       (r."PROB_END"   AT TIME ZONE 'America/Chicago') AS prob_end,
       lsbd._s(r."CE_COURSES")  AS ce_courses,
       lsbd._s(r."CE_AREA1")    AS ce_area1,
       r."CE_HOURS1"            AS ce_hours1,
       lsbd._s(r."CE_AREA2")    AS ce_area2,
       r."CE_HOURS2"            AS ce_hours2,
       lsbd._s(r."COUNSELING")  AS counseling,
       lsbd._s(r."COMMENTS")    AS comments,
       lsbd._s(r."ATT_NAME")    AS attorney_name,
       lsbd._s(r."ATT_FIRM")    AS attorney_firm,
       lsbd._s(r."ATT_STR1")    AS attorney_street1,
       lsbd._s(r."ATT_STR2")    AS attorney_street2,
       lsbd._s(r."ATT_CITY")    AS attorney_city,
       lsbd._s(r."ATT_STATE")   AS attorney_state,
       lsbd._s(r."ATT_ZIP")     AS attorney_zip,
       lsbd._s(r."ATT_PHONE")   AS attorney_phone,
       lsbd._s(r."att_ext")     AS attorney_ext,
       lsbd._s(r."ClosureTerms") AS closure_terms,
       lsbd._s(r."ProbTerms")   AS probation_terms,
       lsbd._s(r."Address1C")   AS complainant_address1,
       lsbd._s(r."Address2C")   AS complainant_address2,
       lsbd._s(r."CITYC")       AS complainant_city,
       lsbd._s(r."STATEC")      AS complainant_state,
       lsbd._s(r."ZIPC")        AS complainant_zip,
       lsbd._s(r."COUNTYC")     AS complainant_county,
       lsbd._s(r."PhoneC")      AS complainant_phone,
       lsbd._s(r."ExtC")        AS complainant_ext,
       lsbd._s(r."FaxC")        AS complainant_fax,
       lsbd._s(r."LICTYPE")     AS license_type
  FROM lsbd_raw."tblComplaints" r
 WHERE r._deleted_at IS NULL AND r."Key" IS NOT NULL;

CREATE VIEW lsbd._src_disciplinary WITH (security_invoker = true) AS
SELECT disciplinary_id, individual_id, start_date, end_date, notes, updated_at, good_standing,
       updated_by, individual_legacy_id, legacy_id
  FROM (
  SELECT d.disciplinary_id, d.individual_id, d.start_date, d.end_date, d.notes, d.updated_at,
         d.good_standing, d.updated_by, d.individual_legacy_id, d.legacy_id,
         row_number() OVER (PARTITION BY d.disciplinary_id ORDER BY d.legacy_id) AS rn
    FROM (
    SELECT COALESCE(r."DisciplinaryID",
                    extensions.uuid_generate_v5(extensions.uuid_ns_url(),
                                                'lsbd:Disciplinary:Disciplinary_ID:' || r."Disciplinary_ID"::text))
                                AS disciplinary_id,
           COALESCE(iu.individual_id, ii.individual_id) AS individual_id,
           (r."StartDate" AT TIME ZONE 'America/Chicago') AS start_date,
           (r."EndDate"   AT TIME ZONE 'America/Chicago') AS end_date,
           lsbd._s(r."Notes")   AS notes,
           (r."Updated"   AT TIME ZONE 'America/Chicago') AS updated_at,
           r."GoodStanding"     AS good_standing,
           r."UpdatedBy"        AS updated_by,
           r."Individual_ID"    AS individual_legacy_id,
           r."Disciplinary_ID"  AS legacy_id
      FROM lsbd_raw."Disciplinary" r
      LEFT JOIN lsbd._src_individual iu ON iu.individual_id = r."IndividualID"
      LEFT JOIN lsbd._src_individual ii ON ii.indv_id = r."Individual_ID"
     WHERE r._deleted_at IS NULL AND r."Disciplinary_ID" IS NOT NULL) d) x
 WHERE rn = 1;

CREATE VIEW lsbd._src_activity WITH (security_invoker = true) AS
SELECT DISTINCT ON (lower(r."ActivityID"::text))
       lower(r."ActivityID"::text) AS legacy_id,
       r."ActivityID"              AS legacy_uid,
       lsbd._s(r."Subject")        AS subject,
       lsbd._s(r."Details")        AS details,
       (r."Updated" AT TIME ZONE 'America/Chicago') AS updated,
       r."UpdatedBy"               AS updated_by_uid,
       r."DisciplinaryID"          AS disciplinary_uid,
       r."RequiresReview"          AS requires_review
  FROM lsbd_raw."Activity" r
 WHERE r._deleted_at IS NULL AND r."ActivityID" IS NOT NULL
 ORDER BY lower(r."ActivityID"::text), r._rowid;

CREATE VIEW lsbd._src_statute_violations WITH (security_invoker = true) AS
SELECT DISTINCT ON (lower(r."StatuteViolationID"::text))
       lower(r."StatuteViolationID"::text) AS legacy_id,
       r."StatuteViolationID"      AS legacy_uid,
       r."DisciplinaryID"          AS disciplinary_uid,
       d.legacy_id                 AS disciplinary_id,
       st.id                       AS statute_id,
       (r."ViolationDate" AT TIME ZONE 'America/Chicago') AS violation_date
  FROM lsbd_raw."StatuteViolations" r
  LEFT JOIN lsbd._src_disciplinary d ON d.disciplinary_id = r."DisciplinaryID"
  LEFT JOIN (SELECT DISTINCT ON (legacy_uid) legacy_uid, legacy_id FROM lsbd._src_statutes
              WHERE legacy_uid IS NOT NULL ORDER BY legacy_uid, legacy_id) sst ON sst.legacy_uid = r."StatuteID"
  LEFT JOIN lsbd.statutes st ON st.legacy_id = sst.legacy_id
 WHERE r._deleted_at IS NULL AND r."StatuteViolationID" IS NOT NULL
 ORDER BY lower(r."StatuteViolationID"::text), r._rowid;

CREATE VIEW lsbd._src_logins WITH (security_invoker = true) AS
SELECT r."ID"                        AS id,
       NULLIF(r."LicenseID", '')     AS license_id,
       NULLIF(r."LicType", '')       AS lic_type,
       (r."LoginDate" AT TIME ZONE 'America/Chicago') AS login_date
  FROM lsbd_raw."Logins" r
 WHERE r._deleted_at IS NULL AND r."ID" IS NOT NULL
   AND NULLIF(r."LicenseID", '') IS NOT NULL AND NULLIF(r."LicType", '') IS NOT NULL
   AND r."LoginDate" IS NOT NULL;

CREATE VIEW lsbd._src_dent_exam WITH (security_invoker = true) AS
SELECT r."ID"::text                  AS legacy_id,
       r."Key1"                      AS legacy_key,
       lsbd._s(r."LicenseId")        AS license_id,
       r."PrepAmal"  AS prep_amal,  r."RestAmal" AS rest_amal,
       r."PrepComp"  AS prep_comp,  r."RestComp" AS rest_comp,
       r."Endo"      AS endo,       r."AvgLab"   AS avg_lab,
       r."Pros"      AS pros,       r."Perio"    AS perio,
       r."Written"   AS written,    r."Juris"    AS juris,
       r."Sterile"   AS sterile,    r."GRADE"    AS grade,
       lsbd._s(r."Remarks")          AS remarks,
       COALESCE(r."NatBoardScores", false)    AS nat_board_scores,
       COALESCE(r."DenHygSchoolTrans", false) AS den_hyg_school_trans,
       COALESCE(r."OtherTrans", false)        AS other_trans,
       COALESCE(r."Photos", false)            AS photos,
       COALESCE(r."ExamFee", false)           AS exam_fee,
       COALESCE(r."RecoLetters", false)       AS reco_letters,
       COALESCE(r."RegisLetter", false)       AS regis_letter,
       COALESCE(r."CompleteAppl", false)      AS complete_appl,
       COALESCE(r."LicensureCert", false)     AS licensure_cert,
       COALESCE(r."InsuranceVerify", false)   AS insurance_verify,
       COALESCE(r."DataBankRpt", false)       AS data_bank_rpt,
       (r."TIMESTAMP" AT TIME ZONE 'America/Chicago') AS recorded_at
  FROM lsbd_raw."tblExamsDent" r
 WHERE r._deleted_at IS NULL AND r."ID" IS NOT NULL;

CREATE VIEW lsbd._src_hyg_exam WITH (security_invoker = true) AS
SELECT r."ID"::text                  AS legacy_id,
       r."Key1"                      AS legacy_key,
       lsbd._s(r."Licenseid")        AS license_id,
       lsbd._s(r."Clinical")         AS clinical,
       lsbd._s(r."Juris")            AS juris,
       lsbd._s(r."Sterile")          AS sterile,
       lsbd._s(r."JURIS2")           AS juris2,
       lsbd._s(r."STERILE2")         AS sterile2,
       lsbd._s(r."PassFail")         AS pass_fail,
       lsbd._s(r."Remarks")          AS remarks,
       COALESCE(r."NatBoardScores", false)    AS nat_board_scores,
       COALESCE(r."DenHygSchoolTrans", false) AS den_hyg_school_trans,
       COALESCE(r."OtherTrans", false)        AS other_trans,
       COALESCE(r."Photos", false)            AS photos,
       COALESCE(r."ExamFee", false)           AS exam_fee,
       COALESCE(r."RecoLetters", false)       AS reco_letters,
       COALESCE(r."RegisLetter", false)       AS regis_letter,
       COALESCE(r."CompleteAppl", false)      AS complete_appl,
       COALESCE(r."LicensureCert", false)     AS licensure_cert,
       COALESCE(r."InsuranceVerify", false)   AS insurance_verify,
       (r."TIMESTAMP" AT TIME ZONE 'America/Chicago') AS recorded_at
  FROM lsbd_raw."tblExamsHyg" r
 WHERE r._deleted_at IS NULL AND r."ID" IS NOT NULL;

-- tblRndDentists and tblRndHygienists share one 100-column shape: one view per source,
-- generated from the same column list.
DO $do$
DECLARE
  t text[];
BEGIN
  FOREACH t SLICE 1 IN ARRAY ARRAY[['random_sample_dentists', 'tblRndDentists'],
                                    ['random_sample_hygienists', 'tblRndHygienists']] LOOP
    EXECUTE format($v$
CREATE VIEW lsbd.%I WITH (security_invoker = true) AS
SELECT r."Key" AS id,
       lsbd._s(r."LICENSEID") AS license_id, lsbd._s(r."Type") AS type, lsbd._s(r."Class") AS class,
       lsbd._s(r."STATUS") AS status,
       (r."DateSince"     AT TIME ZONE 'America/Chicago') AS date_since,
       (r."DateInactive"  AT TIME ZONE 'America/Chicago') AS date_inactive,
       (r."DateReinstate" AT TIME ZONE 'America/Chicago') AS date_reinstate,
       (r."DateUpdated"   AT TIME ZONE 'America/Chicago') AS date_updated,
       (r."DateRenew"     AT TIME ZONE 'America/Chicago') AS date_renew,
       (r."DateUntil"     AT TIME ZONE 'America/Chicago') AS date_until,
       lsbd._s(r."RegYear") AS reg_year, lsbd._s(r."PANO") AS pa_no, lsbd._s(r."PLLCNO") AS pllc_no,
       lsbd._s(r."PERMITNO") AS permit_no,
       lsbd._s(r."FIRSTName") AS first_name, lsbd._s(r."MIDDLE") AS middle, lsbd._s(r."LASTName") AS last_name,
       (r."DOB" AT TIME ZONE 'America/Chicago') AS dob,
       lsbd._s(r."SEX") AS sex, lsbd._s(r."RACE") AS race, lsbd._s(r."SPECIALTY") AS specialty,
       lsbd._s(r."ACTIVE") AS active, lsbd._s(r."INACTIVE") AS inactive,
       lsbd._s(r."PRINSET") AS prin_set, lsbd._s(r."FORMEMPL") AS form_empl,
       r."HRSWK" AS hrs_wk, r."PATIENTCR" AS patient_cr, r."NUMDENT" AS num_dent,
       r."NUMHYGEN" AS num_hygen, r."NUMDA1" AS num_da1, r."NUMDA2" AS num_da2,
       lsbd._s(r."SATCITY1") AS sat_city1, lsbd._s(r."SATCITY2") AS sat_city2,
       r."CEHrs" AS ce_hours,
       lsbd._s(r."USEANES") AS use_anes, lsbd._s(r."USESEDAT") AS use_sedat,
       lsbd._s(r."Address1") AS address1, lsbd._s(r."Address2") AS address2,
       lsbd._s(r."CITY") AS city, lsbd._s(r."STATE") AS state, lsbd._s(r."ZIP") AS zip,
       lsbd._s(r."COUNTY") AS county, lsbd._s(r."AddrType") AS addr_type,
       lsbd._s(r."COMPLAINT") AS complaint,
       NULL::text AS ssn,  -- R29: the SSN HMAC lives only in lsbd.licensee_pii
       lsbd._s(r."Email") AS email, lsbd._s(r."URL") AS url, lsbd._s(r."Location") AS location,
       lsbd._s(r."Phone1") AS phone1, lsbd._s(r."Ext1") AS ext1, lsbd._s(r."Phone2") AS phone2,
       lsbd._s(r."Ext2") AS ext2, lsbd._s(r."Fax") AS fax, lsbd._s(r."Notes") AS notes,
       lsbd._s(r."AddressO1") AS address_o1, lsbd._s(r."AddressO2") AS address_o2,
       lsbd._s(r."CITYO") AS city_o, lsbd._s(r."STATEO") AS state_o, lsbd._s(r."ZIPO") AS zip_o,
       lsbd._s(r."COUNTYO") AS county_o, lsbd._s(r."OAddrType") AS o_addr_type,
       lsbd._s(r."SCHNAME") AS sch_name, lsbd._s(r."SCHSTATE") AS sch_state,
       r."GRADYEAR" AS grad_year, r."DEGREE" AS degree,
       lsbd._s(r."RenewMnth") AS renew_month,
       lsbd._s(r."AddressP1") AS address_p1, lsbd._s(r."AddressP2") AS address_p2,
       lsbd._s(r."CITYP") AS city_p, lsbd._s(r."STATEP") AS state_p, lsbd._s(r."ZIPP") AS zip_p,
       lsbd._s(r."COUNTYP") AS county_p,
       lsbd._s(r."Audit") AS audit, lsbd._s(r."Action") AS action,
       r."BACKGROUND" AS background,
       lsbd._s(r."CPR") AS cpr, lsbd._s(r."CENOTREQ") AS ce_not_req, lsbd._s(r."Fax2") AS fax2,
       lsbd._s(r."LimitedSupDH") AS limited_sup_dh,
       lsbd._s(r."LicenseName") AS license_name, lsbd._s(r."MarriedName") AS married_name,
       lsbd._s(r."Prefix") AS prefix, lsbd._s(r."Suffix") AS suffix,
       lsbd._s(r."ProcessingGroup") AS processing_group,
       r."IndividualID_" AS individual_legacy_id,
       i.indv_id AS individual_id,
       (r."Updated" AT TIME ZONE 'America/Chicago') AS updated,
       r."ID" AS legacy_id,
       r."UseLicenseName" AS use_license_name, r."IsCurrent" AS is_current,
       lsbd._s(r."Address3") AS address3, lsbd._s(r."Country") AS country,
       r."CSNone" AS cs_none, r."CSDispense" AS cs_dispense, r."CSAdminister" AS cs_administer,
       lsbd._s(r."AuditYear") AS audit_year, lsbd._s(r."Credential_Exam") AS credential_exam,
       r."INACTIVE2" AS inactive_flag,
       lsbd._s(r."UpdatedBy") AS updated_by
  FROM lsbd_raw.%I r
  LEFT JOIN lsbd._src_individual i ON i.indv_id = r."IndividualID_"
 WHERE r._deleted_at IS NULL AND r."Key" IS NOT NULL
$v$, '_src_' || t[1], t[2]);
  END LOOP;
END
$do$;

-- tblRndAnesthesia and tblRndSedation (0 rows today) share the tblASPermits shape.
DO $do$
DECLARE
  t text[];
BEGIN
  FOREACH t SLICE 1 IN ARRAY ARRAY[['random_sample_anesthesia', 'tblRndAnesthesia'],
                                    ['random_sample_sedation', 'tblRndSedation']] LOOP
    EXECUTE format($v$
CREATE VIEW lsbd.%I WITH (security_invoker = true) AS
SELECT r."Key" AS id,
       lsbd._s(r."LicenseId") AS license_id, lsbd._s(r."Type") AS type, lsbd._s(r."STATUS") AS status,
       (r."DateSince"     AT TIME ZONE 'America/Chicago') AS date_since,
       (r."DateInactive"  AT TIME ZONE 'America/Chicago') AS date_inactive,
       (r."DateReinstate" AT TIME ZONE 'America/Chicago') AS date_reinstate,
       lsbd._s(r."DLicenseId") AS d_license_id, lsbd._s(r."OtherDentists") AS other_dentists,
       lsbd._s(r."TRAINING") AS training, lsbd._s(r."TRAINYEAR") AS train_year,
       (r."DateUntil"   AT TIME ZONE 'America/Chicago') AS date_until,
       (r."DateUpdated" AT TIME ZONE 'America/Chicago') AS date_updated,
       (r."DateRenew"   AT TIME ZONE 'America/Chicago') AS date_renew,
       lsbd._s(r."RegYear") AS reg_year, lsbd._s(r."InspectedO") AS inspected_o,
       lsbd._s(r."Inspected") AS inspected, lsbd._s(r."InspectedS1") AS inspected_s1,
       lsbd._s(r."InspectedS2") AS inspected_s2, lsbd._s(r."RenewMnth") AS renew_month,
       lsbd._s(r."Notes") AS notes, lsbd._s(r."Audit") AS audit, lsbd._s(r."SLEVEL") AS s_level
  FROM lsbd_raw.%I r
 WHERE r._deleted_at IS NULL AND r."Key" IS NOT NULL
$v$, '_src_' || t[1], t[2]);
  END LOOP;
END
$do$;

CREATE OR REPLACE FUNCTION lsbd.transform_compliance(phase text DEFAULT 'all')
RETURNS integer
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  o integer := 0;
BEGIN
  IF phase NOT IN ('all', 'delete', 'upsert') THEN
    RAISE EXCEPTION 'transform_compliance: unknown phase %', phase;
  END IF;

  IF phase IN ('all', 'delete') THEN
    PERFORM lsbd._delete('lsbd.statute_violations',       'lsbd._src_statute_violations',       '{legacy_id}');
    PERFORM lsbd._delete('lsbd.activity',                 'lsbd._src_activity',                 '{legacy_id}');
    PERFORM lsbd._delete('lsbd.disciplinary',             'lsbd._src_disciplinary',             '{legacy_id}');
    -- NO ACTION FK to individual: unlink before entities deletes the Individual.
    PERFORM lsbd._unlink('lsbd.disciplinary', 'individual_id',
      'SELECT 1 FROM lsbd._src_individual s WHERE s.individual_id = t.individual_id');
    PERFORM lsbd._delete('lsbd.complaint',                'lsbd._src_complaint',                '{legacy_key}');
    PERFORM lsbd._delete('lsbd.logins',                   'lsbd._src_logins',                   '{id}');
    PERFORM lsbd._delete('lsbd.dent_exam',                'lsbd._src_dent_exam',                '{legacy_id}');
    PERFORM lsbd._delete('lsbd.hyg_exam',                 'lsbd._src_hyg_exam',                 '{legacy_id}');
    PERFORM lsbd._delete('lsbd.random_sample_dentists',   'lsbd._src_random_sample_dentists',   '{id}');
    PERFORM lsbd._delete('lsbd.random_sample_hygienists', 'lsbd._src_random_sample_hygienists', '{id}');
    PERFORM lsbd._delete('lsbd.random_sample_anesthesia', 'lsbd._src_random_sample_anesthesia', '{id}');
    PERFORM lsbd._delete('lsbd.random_sample_sedation',   'lsbd._src_random_sample_sedation',   '{id}');
  END IF;

  IF phase IN ('all', 'upsert') THEN
    o := o + lsbd._upsert('lsbd.complaint',                'lsbd._src_complaint',                '{legacy_key}', 'tblComplaints');
    o := o + lsbd._upsert('lsbd.disciplinary',             'lsbd._src_disciplinary',             '{legacy_id}',  'Disciplinary');
    o := o + lsbd._upsert('lsbd.activity',                 'lsbd._src_activity',                 '{legacy_id}',  'Activity');
    o := o + lsbd._upsert('lsbd.statute_violations',       'lsbd._src_statute_violations',       '{legacy_id}',  'StatuteViolations');
    o := o + lsbd._upsert('lsbd.logins',                   'lsbd._src_logins',                   '{id}',         'Logins');
    o := o + lsbd._upsert('lsbd.dent_exam',                'lsbd._src_dent_exam',                '{legacy_id}',  'tblExamsDent');
    o := o + lsbd._upsert('lsbd.hyg_exam',                 'lsbd._src_hyg_exam',                 '{legacy_id}',  'tblExamsHyg');
    o := o + lsbd._upsert('lsbd.random_sample_dentists',   'lsbd._src_random_sample_dentists',   '{id}',         'tblRndDentists');
    o := o + lsbd._upsert('lsbd.random_sample_hygienists', 'lsbd._src_random_sample_hygienists', '{id}',         'tblRndHygienists');
    o := o + lsbd._upsert('lsbd.random_sample_anesthesia', 'lsbd._src_random_sample_anesthesia', '{id}',         'tblRndAnesthesia');
    o := o + lsbd._upsert('lsbd.random_sample_sedation',   'lsbd._src_random_sample_sedation',   '{id}',         'tblRndSedation');

    PERFORM lsbd._count_unlinked('lsbd.disciplinary', 'individual_id -> individual', 'Disciplinary',
      'r."Disciplinary_ID" = t.legacy_id', 'COALESCE(r."IndividualID"::text, r."Individual_ID"::text)', 'individual_id');
    PERFORM lsbd._count_unlinked('lsbd.random_sample_dentists', 'individual_id -> individual (IndividualID_)', 'tblRndDentists',
      'r."Key" = t.id', 'r."IndividualID_"', 'individual_id');
    PERFORM lsbd._count_unlinked('lsbd.random_sample_hygienists', 'individual_id -> individual (IndividualID_)', 'tblRndHygienists',
      'r."Key" = t.id', 'r."IndividualID_"', 'individual_id');
    PERFORM lsbd._count_unlinked('lsbd.statute_violations', 'disciplinary_id -> disciplinary', 'StatuteViolations',
      'lower(r."StatuteViolationID"::text) = t.legacy_id', 'r."DisciplinaryID"', 'disciplinary_id');
    PERFORM lsbd._count_unlinked('lsbd.statute_violations', 'statute_id -> statutes', 'StatuteViolations',
      'lower(r."StatuteViolationID"::text) = t.legacy_id', 'r."StatuteID"', 'statute_id');
  END IF;
  RETURN o;
END;
$$;

INSERT INTO lsbd._transform_registry (domain, fn, sort_order, source_tables)
VALUES ('compliance', 'lsbd.transform_compliance'::regproc, 80, ARRAY[
  -- own sources
  'tblComplaints', 'Disciplinary', 'Activity', 'StatuteViolations', 'Logins', 'tblExamsDent',
  'tblExamsHyg', 'tblRndDentists', 'tblRndHygienists', 'tblRndAnesthesia', 'tblRndSedation',
  -- parents
  'Individual', 'Statutes'])
ON CONFLICT (domain) DO UPDATE
  SET fn = EXCLUDED.fn, sort_order = EXCLUDED.sort_order, source_tables = EXCLUDED.source_tables;

SELECT lsbd._lockdown();
