-- supabase/transforms/10_lookups.sql
--
-- Domain "lookups": small code tables + the single-row settings bags.
-- Ported from scripts/etl-b1b-lookups.ts and scripts/etl-b1c-settings.ts:
--   strOrNull  -> lsbd._s(x)              (trim, '' -> NULL)
--   strOrEmpty -> COALESCE(lsbd._s(x), '') (NOT NULL target columns)
--   boolOr(x, false) -> COALESCE(x, false); numbers/money pass through.
-- Keys per the 0003_legacy_keys KEY MAP: legacy_id = source int PK as text
-- (the serial id stays generated); tbl_form_empl.id = source code verbatim;
-- fee.fee_code = tblFees column name; app_settings.key = counter.|date.|control.<col>.
-- Code columns that carry their own UNIQUE index (compl_* codes, disposition)
-- keep the lowest source ID per code; later duplicates are skipped + counted.
-- Timestamps: (<col> AT TIME ZONE 'America/Chicago') -- source is naive Central.

-- ---------------------------------------------------------------------------
-- Source views
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS lsbd._src_address_type_lookup, lsbd._src_tbl_types, lsbd._src_tbl_status,
  lsbd._src_tbl_class, lsbd._src_tbl_inactive_status, lsbd._src_tbl_specialties, lsbd._src_tbl_prin_set,
  lsbd._src_tbl_form_empl, lsbd._src_tbl_report_type, lsbd._src_professional_type, lsbd._src_practice_type,
  lsbd._src_sed_level, lsbd._src_compl_action, lsbd._src_compl_closure, lsbd._src_compl_decision,
  lsbd._src_compl_hearing, lsbd._src_compl_probation, lsbd._src_compl_status, lsbd._src_disposition,
  lsbd._src_education_type, lsbd._src_permit_type, lsbd._src_trans_type, lsbd._src_charge_category,
  lsbd._src_charge_int, lsbd._src_fee, lsbd._src_app_settings, lsbd._src_renewal_settings CASCADE;

CREATE VIEW lsbd._src_address_type_lookup WITH (security_invoker = true) AS
SELECT r."AddressType_ID"::text AS legacy_id,
       r."AddressTypeID"        AS legacy_uid,
       COALESCE(lsbd._s(r."AddressType"), '') AS address_type
  FROM lsbd_raw."AddressType" r
 WHERE r._deleted_at IS NULL AND r."AddressType_ID" IS NOT NULL;

CREATE VIEW lsbd._src_tbl_types WITH (security_invoker = true) AS
SELECT r."ID"::text AS legacy_id,
       COALESCE(lsbd._s(r."Type"), '') AS type,
       lsbd._s(r."TypeDesc") AS type_desc
  FROM lsbd_raw."tblTypes" r
 WHERE r._deleted_at IS NULL AND r."ID" IS NOT NULL;

CREATE VIEW lsbd._src_tbl_status WITH (security_invoker = true) AS
SELECT r."ID"::text AS legacy_id,
       COALESCE(lsbd._s(r."StatusId"), '') AS status_id,
       lsbd._s(r."Status") AS status,
       COALESCE(r."LoginOk", false) AS login_ok,
       COALESCE(r."RenewOk", false) AS renew_ok
  FROM lsbd_raw."tblStatus" r
 WHERE r._deleted_at IS NULL AND r."ID" IS NOT NULL;

CREATE VIEW lsbd._src_tbl_class WITH (security_invoker = true) AS
SELECT r."ID"::text AS legacy_id,
       COALESCE(lsbd._s(r."Class"), '') AS class,
       lsbd._s(r."ClassDesc") AS class_desc,
       COALESCE(r."LoginOk", false) AS login_ok,
       COALESCE(r."RenewOk", false) AS renew_ok
  FROM lsbd_raw."tblClass" r
 WHERE r._deleted_at IS NULL AND r."ID" IS NOT NULL;

CREATE VIEW lsbd._src_tbl_inactive_status WITH (security_invoker = true) AS
SELECT r."ID"::text AS legacy_id,
       COALESCE(lsbd._s(r."Status"), '') AS status
  FROM lsbd_raw."tblnactiveStatus" r
 WHERE r._deleted_at IS NULL AND r."ID" IS NOT NULL;

CREATE VIEW lsbd._src_tbl_specialties WITH (security_invoker = true) AS
SELECT r."ID"::text AS legacy_id,
       COALESCE(lsbd._s(r."Specialty"), '') AS specialty
  FROM lsbd_raw."tblSpecialties" r
 WHERE r._deleted_at IS NULL AND r."ID" IS NOT NULL;

CREATE VIEW lsbd._src_tbl_prin_set WITH (security_invoker = true) AS
SELECT r."ID"::text AS legacy_id,
       lsbd._s(r."PrinSet") AS prin_set
  FROM lsbd_raw."tblPrinSet" r
 WHERE r._deleted_at IS NULL AND r."ID" IS NOT NULL;

-- id is the source nchar(4) code verbatim (key map: "id is text = source code verbatim").
CREATE VIEW lsbd._src_tbl_form_empl WITH (security_invoker = true) AS
SELECT r."ID" AS id,
       lsbd._s(r."FormEmploy") AS form_employ
  FROM lsbd_raw."tblFormEmpl" r
 WHERE r._deleted_at IS NULL AND r."ID" IS NOT NULL;

CREATE VIEW lsbd._src_tbl_report_type WITH (security_invoker = true) AS
SELECT r."ID"::text AS legacy_id,
       COALESCE(lsbd._s(r."ReportType"), '') AS report_type
  FROM lsbd_raw."tblReportType" r
 WHERE r._deleted_at IS NULL AND r."ID" IS NOT NULL;

CREATE VIEW lsbd._src_professional_type WITH (security_invoker = true) AS
SELECT r."ProfessionalType_ID"::text AS legacy_id,
       r."ProfessionalTypeID" AS legacy_uid,
       lsbd._s(r."ProfessionalType") AS professional_type,
       lsbd._s(r."LICSCode") AS lics_code,
       r."RenewalFee"   AS renewal_fee,
       r."LateFee"      AS late_fee,
       r."FirstTimeFee" AS first_time_fee
  FROM lsbd_raw."ProfessionalType" r
 WHERE r._deleted_at IS NULL AND r."ProfessionalType_ID" IS NOT NULL;

CREATE VIEW lsbd._src_practice_type WITH (security_invoker = true) AS
SELECT r."PracticeType_ID"::text AS legacy_id,
       r."PracticeTypeID" AS legacy_uid,
       lsbd._s(r."PracticeType") AS practice_type,
       r."Specialty" AS specialty
  FROM lsbd_raw."PracticeType" r
 WHERE r._deleted_at IS NULL AND r."PracticeType_ID" IS NOT NULL;

-- tblSedLevels has no source PK (raw PK is _rowid): key on ID, first _rowid wins.
CREATE VIEW lsbd._src_sed_level WITH (security_invoker = true) AS
SELECT DISTINCT ON (r."ID")
       r."ID"::text AS legacy_id,
       lsbd._s(r."SLEVEL") AS s_level,
       lsbd._s(r."DESCRIPTION") AS description
  FROM lsbd_raw."tblSedLevels" r
 WHERE r._deleted_at IS NULL AND r."ID" IS NOT NULL
 ORDER BY r."ID", r._rowid;

-- Complaint lookups: code is UNIQUE in lsbd; lowest source ID per code wins.
CREATE VIEW lsbd._src_compl_action WITH (security_invoker = true) AS
SELECT legacy_id, action, description FROM (
  SELECT r."ID"::text AS legacy_id, COALESCE(lsbd._s(r."Action"), '') AS action, lsbd._s(r."Desc") AS description,
         row_number() OVER (PARTITION BY COALESCE(lsbd._s(r."Action"), '') ORDER BY r."ID") AS rn
    FROM lsbd_raw."tblComplActions" r
   WHERE r._deleted_at IS NULL AND r."ID" IS NOT NULL) x
 WHERE rn = 1;

CREATE VIEW lsbd._src_compl_closure WITH (security_invoker = true) AS
SELECT legacy_id, closure, description FROM (
  SELECT r."ID"::text AS legacy_id, COALESCE(lsbd._s(r."Closure"), '') AS closure, lsbd._s(r."Desc") AS description,
         row_number() OVER (PARTITION BY COALESCE(lsbd._s(r."Closure"), '') ORDER BY r."ID") AS rn
    FROM lsbd_raw."tblComplClosure" r
   WHERE r._deleted_at IS NULL AND r."ID" IS NOT NULL) x
 WHERE rn = 1;

CREATE VIEW lsbd._src_compl_decision WITH (security_invoker = true) AS
SELECT legacy_id, decision, description FROM (
  SELECT r."ID"::text AS legacy_id, COALESCE(lsbd._s(r."Decision"), '') AS decision, lsbd._s(r."Desc") AS description,
         row_number() OVER (PARTITION BY COALESCE(lsbd._s(r."Decision"), '') ORDER BY r."ID") AS rn
    FROM lsbd_raw."tblComplDecisions" r
   WHERE r._deleted_at IS NULL AND r."ID" IS NOT NULL) x
 WHERE rn = 1;

CREATE VIEW lsbd._src_compl_hearing WITH (security_invoker = true) AS
SELECT legacy_id, hearing, description FROM (
  SELECT r."ID"::text AS legacy_id, COALESCE(lsbd._s(r."Hearing"), '') AS hearing, lsbd._s(r."Desc") AS description,
         row_number() OVER (PARTITION BY COALESCE(lsbd._s(r."Hearing"), '') ORDER BY r."ID") AS rn
    FROM lsbd_raw."tblComplHearings" r
   WHERE r._deleted_at IS NULL AND r."ID" IS NOT NULL) x
 WHERE rn = 1;

CREATE VIEW lsbd._src_compl_probation WITH (security_invoker = true) AS
SELECT legacy_id, probation, description FROM (
  SELECT r."ID"::text AS legacy_id, COALESCE(lsbd._s(r."Probation"), '') AS probation, lsbd._s(r."Desc") AS description,
         row_number() OVER (PARTITION BY COALESCE(lsbd._s(r."Probation"), '') ORDER BY r."ID") AS rn
    FROM lsbd_raw."tblComplProbation" r
   WHERE r._deleted_at IS NULL AND r."ID" IS NOT NULL) x
 WHERE rn = 1;

CREATE VIEW lsbd._src_compl_status WITH (security_invoker = true) AS
SELECT legacy_id, code, description FROM (
  SELECT r."ID"::text AS legacy_id, COALESCE(lsbd._s(r."Status"), '') AS code, lsbd._s(r."Description") AS description,
         row_number() OVER (PARTITION BY COALESCE(lsbd._s(r."Status"), '') ORDER BY r."ID") AS rn
    FROM lsbd_raw."tblComplStatus" r
   WHERE r._deleted_at IS NULL AND r."ID" IS NOT NULL) x
 WHERE rn = 1;

CREATE VIEW lsbd._src_disposition WITH (security_invoker = true) AS
SELECT legacy_id, code, description FROM (
  SELECT r."ID"::text AS legacy_id, COALESCE(lsbd._s(r."Disposition"), '') AS code, lsbd._s(r."Description") AS description,
         row_number() OVER (PARTITION BY COALESCE(lsbd._s(r."Disposition"), '') ORDER BY r."ID") AS rn
    FROM lsbd_raw."tblDisposition" r
   WHERE r._deleted_at IS NULL AND r."ID" IS NOT NULL) x
 WHERE rn = 1;

CREATE VIEW lsbd._src_education_type WITH (security_invoker = true) AS
SELECT r."EducationType_ID"::text AS legacy_id,
       lsbd._s(r."EducationType") AS education_type
  FROM lsbd_raw."EducationType" r
 WHERE r._deleted_at IS NULL AND r."EducationType_ID" IS NOT NULL;

CREATE VIEW lsbd._src_permit_type WITH (security_invoker = true) AS
SELECT r."PermitType_ID"::text AS legacy_id,
       lsbd._s(r."PermitType")  AS permit_type,
       lsbd._s(r."Description") AS description,
       r."PersonalFee"      AS personal_fee,
       r."OfficeFee"        AS office_fee,
       r."PersonalPriority" AS personal_priority
  FROM lsbd_raw."PermitType" r
 WHERE r._deleted_at IS NULL AND r."PermitType_ID" IS NOT NULL;

CREATE VIEW lsbd._src_trans_type WITH (security_invoker = true) AS
SELECT r."ID"::text AS legacy_id,
       COALESCE(lsbd._s(r."TransType"), '') AS trans_type
  FROM lsbd_raw."tblTransTypes" r
 WHERE r._deleted_at IS NULL AND r."ID" IS NOT NULL;

CREATE VIEW lsbd._src_charge_category WITH (security_invoker = true) AS
SELECT r."ID"::text AS legacy_id,
       lsbd._s(r."CHARGE_CAT") AS charge_cat,
       lsbd._s(r."DESCRIPT")   AS description
  FROM lsbd_raw."tblChargeCategory" r
 WHERE r._deleted_at IS NULL AND r."ID" IS NOT NULL;

CREATE VIEW lsbd._src_charge_int WITH (security_invoker = true) AS
SELECT r."ID"::text AS legacy_id,
       lsbd._s(r."INT_CHRG") AS int_charge,
       lsbd._s(r."DESCRIPT") AS description
  FROM lsbd_raw."tblChargeInt" r
 WHERE r._deleted_at IS NULL AND r."ID" IS NOT NULL;

-- tblFees: single-row, one lsbd.fee row per money column (fee_code = column
-- name), ID and the raw bookkeeping columns skipped. First live row by ID.
-- fee.description is not in the view, so a staff label is never overwritten.
CREATE VIEW lsbd._src_fee WITH (security_invoker = true) AS
SELECT j.key AS fee_code,
       j.value::numeric AS amount
  FROM (SELECT * FROM lsbd_raw."tblFees" f WHERE f._deleted_at IS NULL ORDER BY f."ID" LIMIT 1) r
 CROSS JOIN LATERAL jsonb_each_text(to_jsonb(r) - ARRAY['ID', '_row_hash', '_synced_at', '_deleted_at']) j;

-- tblNumbers / tblDates / Control -> key/value (value = String(v) in the May
-- ETL: integers as decimal, datetimes as the naive ISO text 'YYYY-MM-DDTHH:MI:SS').
CREATE VIEW lsbd._src_app_settings WITH (security_invoker = true) AS
SELECT 'counter.' || j.key AS key, j.value AS value, 'Legacy next-ID counter from MSSQL tblNumbers'::text AS notes
  FROM (SELECT * FROM lsbd_raw."tblNumbers" n WHERE n._deleted_at IS NULL ORDER BY n."ID" LIMIT 1) r
 CROSS JOIN LATERAL jsonb_each_text(to_jsonb(r) - ARRAY['ID', '_row_hash', '_synced_at', '_deleted_at']) j
UNION ALL
SELECT 'date.' || j.key, j.value, 'Legacy single-value date from MSSQL tblDates'::text
  FROM (SELECT * FROM lsbd_raw."tblDates" d WHERE d._deleted_at IS NULL ORDER BY d."ID" LIMIT 1) r
 CROSS JOIN LATERAL jsonb_each_text(to_jsonb(r) - ARRAY['ID', '_row_hash', '_synced_at', '_deleted_at']) j
UNION ALL
SELECT 'control.' || j.key, j.value, 'Legacy single-value setting from MSSQL Control'::text
  FROM (SELECT * FROM lsbd_raw."Control" c WHERE c._deleted_at IS NULL ORDER BY c._rowid LIMIT 1) r
 CROSS JOIN LATERAL jsonb_each_text(to_jsonb(r) - ARRAY['_rowid', '_row_hash', '_synced_at', '_deleted_at']) j;

-- RenewalSettings: every target column is NOT NULL; a row missing one is skipped + counted.
CREATE VIEW lsbd._src_renewal_settings WITH (security_invoker = true) AS
SELECT r."ID"::text AS legacy_id,
       r."LicenseType" AS license_type,
       (r."ExpirationDate" AT TIME ZONE 'America/Chicago') AS expiration_date,
       (r."RenewalDate"    AT TIME ZONE 'America/Chicago') AS renewal_date,
       r."Fee"          AS fee,
       r."WellBeingFee" AS well_being_fee,
       r."LateFee"      AS late_fee,
       (r."StartDate" AT TIME ZONE 'America/Chicago') AS start_date,
       (r."LateDate"  AT TIME ZONE 'America/Chicago') AS late_date,
       (r."EndDate"   AT TIME ZONE 'America/Chicago') AS end_date
  FROM lsbd_raw."RenewalSettings" r
 WHERE r._deleted_at IS NULL AND r."ID" IS NOT NULL
   AND num_nulls(r."LicenseType", r."ExpirationDate", r."RenewalDate", r."Fee", r."WellBeingFee",
                 r."LateFee", r."StartDate", r."LateDate", r."EndDate") = 0;

-- ---------------------------------------------------------------------------
-- Domain function
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION lsbd.transform_lookups(phase text DEFAULT 'all')
RETURNS integer
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  o integer := 0;
BEGIN
  IF phase NOT IN ('all', 'delete', 'upsert') THEN
    RAISE EXCEPTION 'transform_lookups: unknown phase %', phase;
  END IF;

  IF phase IN ('all', 'delete') THEN
    PERFORM lsbd._delete('lsbd.address_type_lookup', 'lsbd._src_address_type_lookup', '{legacy_id}');
    PERFORM lsbd._delete('lsbd.tbl_types',           'lsbd._src_tbl_types',           '{legacy_id}');
    PERFORM lsbd._delete('lsbd.tbl_status',          'lsbd._src_tbl_status',          '{legacy_id}');
    PERFORM lsbd._delete('lsbd.tbl_class',           'lsbd._src_tbl_class',           '{legacy_id}');
    PERFORM lsbd._delete('lsbd.tbl_inactive_status', 'lsbd._src_tbl_inactive_status', '{legacy_id}');
    PERFORM lsbd._delete('lsbd.tbl_specialties',     'lsbd._src_tbl_specialties',     '{legacy_id}');
    PERFORM lsbd._delete('lsbd.tbl_prin_set',        'lsbd._src_tbl_prin_set',        '{legacy_id}');
    PERFORM lsbd._delete('lsbd.tbl_form_empl',       'lsbd._src_tbl_form_empl',       '{id}');
    PERFORM lsbd._delete('lsbd.tbl_report_type',     'lsbd._src_tbl_report_type',     '{legacy_id}');
    PERFORM lsbd._delete('lsbd.professional_type',   'lsbd._src_professional_type',   '{legacy_id}');
    PERFORM lsbd._delete('lsbd.practice_type',       'lsbd._src_practice_type',       '{legacy_id}');
    PERFORM lsbd._delete('lsbd.sed_level',           'lsbd._src_sed_level',           '{legacy_id}');
    PERFORM lsbd._delete('lsbd.compl_action',        'lsbd._src_compl_action',        '{legacy_id}');
    PERFORM lsbd._delete('lsbd.compl_closure',       'lsbd._src_compl_closure',       '{legacy_id}');
    PERFORM lsbd._delete('lsbd.compl_decision',      'lsbd._src_compl_decision',      '{legacy_id}');
    PERFORM lsbd._delete('lsbd.compl_hearing',       'lsbd._src_compl_hearing',       '{legacy_id}');
    PERFORM lsbd._delete('lsbd.compl_probation',     'lsbd._src_compl_probation',     '{legacy_id}');
    PERFORM lsbd._delete('lsbd.compl_status',        'lsbd._src_compl_status',        '{legacy_id}');
    PERFORM lsbd._delete('lsbd.disposition',         'lsbd._src_disposition',         '{legacy_id}');
    PERFORM lsbd._delete('lsbd.education_type',      'lsbd._src_education_type',      '{legacy_id}');
    PERFORM lsbd._delete('lsbd.permit_type',         'lsbd._src_permit_type',         '{legacy_id}');
    PERFORM lsbd._delete('lsbd.trans_type',          'lsbd._src_trans_type',          '{legacy_id}');
    PERFORM lsbd._delete('lsbd.charge_category',     'lsbd._src_charge_category',     '{legacy_id}');
    PERFORM lsbd._delete('lsbd.charge_int',          'lsbd._src_charge_int',          '{legacy_id}');
    PERFORM lsbd._delete('lsbd.fee',                 'lsbd._src_fee',                 '{fee_code}');
    PERFORM lsbd._delete('lsbd.app_settings',        'lsbd._src_app_settings',        '{key}',
                         $f$t.key LIKE 'counter.%' OR t.key LIKE 'date.%' OR t.key LIKE 'control.%'$f$);
    PERFORM lsbd._delete('lsbd.renewal_settings',    'lsbd._src_renewal_settings',    '{legacy_id}');
  END IF;

  IF phase IN ('all', 'upsert') THEN
    o := o + lsbd._upsert('lsbd.address_type_lookup', 'lsbd._src_address_type_lookup', '{legacy_id}', 'AddressType');
    o := o + lsbd._upsert('lsbd.tbl_types',           'lsbd._src_tbl_types',           '{legacy_id}', 'tblTypes');
    o := o + lsbd._upsert('lsbd.tbl_status',          'lsbd._src_tbl_status',          '{legacy_id}', 'tblStatus');
    o := o + lsbd._upsert('lsbd.tbl_class',           'lsbd._src_tbl_class',           '{legacy_id}', 'tblClass');
    o := o + lsbd._upsert('lsbd.tbl_inactive_status', 'lsbd._src_tbl_inactive_status', '{legacy_id}', 'tblnactiveStatus');
    o := o + lsbd._upsert('lsbd.tbl_specialties',     'lsbd._src_tbl_specialties',     '{legacy_id}', 'tblSpecialties');
    o := o + lsbd._upsert('lsbd.tbl_prin_set',        'lsbd._src_tbl_prin_set',        '{legacy_id}', 'tblPrinSet');
    o := o + lsbd._upsert('lsbd.tbl_form_empl',       'lsbd._src_tbl_form_empl',       '{id}',        'tblFormEmpl');
    o := o + lsbd._upsert('lsbd.tbl_report_type',     'lsbd._src_tbl_report_type',     '{legacy_id}', 'tblReportType');
    o := o + lsbd._upsert('lsbd.professional_type',   'lsbd._src_professional_type',   '{legacy_id}', 'ProfessionalType');
    o := o + lsbd._upsert('lsbd.practice_type',       'lsbd._src_practice_type',       '{legacy_id}', 'PracticeType');
    o := o + lsbd._upsert('lsbd.sed_level',           'lsbd._src_sed_level',           '{legacy_id}', 'tblSedLevels');
    o := o + lsbd._upsert('lsbd.compl_action',        'lsbd._src_compl_action',        '{legacy_id}', 'tblComplActions');
    o := o + lsbd._upsert('lsbd.compl_closure',       'lsbd._src_compl_closure',       '{legacy_id}', 'tblComplClosure');
    o := o + lsbd._upsert('lsbd.compl_decision',      'lsbd._src_compl_decision',      '{legacy_id}', 'tblComplDecisions');
    o := o + lsbd._upsert('lsbd.compl_hearing',       'lsbd._src_compl_hearing',       '{legacy_id}', 'tblComplHearings');
    o := o + lsbd._upsert('lsbd.compl_probation',     'lsbd._src_compl_probation',     '{legacy_id}', 'tblComplProbation');
    o := o + lsbd._upsert('lsbd.compl_status',        'lsbd._src_compl_status',        '{legacy_id}', 'tblComplStatus');
    o := o + lsbd._upsert('lsbd.disposition',         'lsbd._src_disposition',         '{legacy_id}', 'tblDisposition');
    o := o + lsbd._upsert('lsbd.education_type',      'lsbd._src_education_type',      '{legacy_id}', 'EducationType');
    o := o + lsbd._upsert('lsbd.permit_type',         'lsbd._src_permit_type',         '{legacy_id}', 'PermitType');
    o := o + lsbd._upsert('lsbd.trans_type',          'lsbd._src_trans_type',          '{legacy_id}', 'tblTransTypes');
    o := o + lsbd._upsert('lsbd.charge_category',     'lsbd._src_charge_category',     '{legacy_id}', 'tblChargeCategory');
    o := o + lsbd._upsert('lsbd.charge_int',          'lsbd._src_charge_int',          '{legacy_id}', 'tblChargeInt');
    o := o + lsbd._upsert('lsbd.fee',                 'lsbd._src_fee',                 '{fee_code}');
    o := o + lsbd._upsert('lsbd.app_settings',        'lsbd._src_app_settings',        '{key}');
    o := o + lsbd._upsert('lsbd.renewal_settings',    'lsbd._src_renewal_settings',    '{legacy_id}', 'RenewalSettings');
  END IF;
  RETURN o;
END;
$$;

INSERT INTO lsbd._transform_registry (domain, fn, sort_order, source_tables)
VALUES ('lookups', 'lsbd.transform_lookups'::regproc, 10, ARRAY[
  'AddressType', 'tblTypes', 'tblStatus', 'tblClass', 'tblnactiveStatus', 'tblSpecialties', 'tblPrinSet',
  'tblFormEmpl', 'tblReportType', 'ProfessionalType', 'PracticeType', 'tblSedLevels', 'tblComplActions',
  'tblComplClosure', 'tblComplDecisions', 'tblComplHearings', 'tblComplProbation', 'tblComplStatus',
  'tblDisposition', 'EducationType', 'PermitType', 'tblTransTypes', 'tblChargeCategory', 'tblChargeInt',
  'tblFees', 'tblNumbers', 'tblDates', 'Control', 'RenewalSettings'])
ON CONFLICT (domain) DO UPDATE
  SET fn = EXCLUDED.fn, sort_order = EXCLUDED.sort_order, source_tables = EXCLUDED.source_tables;

SELECT lsbd._lockdown();
