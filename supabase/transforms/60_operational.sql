-- supabase/transforms/60_operational.sql
--
-- Domain "operational" (Task 14): inspection_status, inspections, inspection_details,
-- permits, permit_history, as_permit, education, renewals, renewal_details,
-- renewal_certification. Ported from scripts/etl-b3.ts (the B-3 operational group);
-- permit_history (0 rows) and as_permit (tblASPermits, 0 rows) had no May mapper and map
-- 1:1 from their sources.
--
-- Value rules (as in Task 11): strOrNull -> lsbd._s(x); ints / booleans / money (numeric)
-- pass through; every timestamptz target is (<col> AT TIME ZONE 'America/Chicago').
-- Keys (0003 KEY MAP): id = the source int PK, inserted explicitly: inspection_status
-- (InspectionStatus_ID), inspections (INSPECTID), inspection_details (InspectionDetail_ID),
-- permits (Permits_ID), permit_history (ID), as_permit (Key), education (Education_ID),
-- renewals (Renewal_ID), renewal_details (RenewalDetail_ID), renewal_certification (ID).
--
-- References: all "lookup, not gate" (controller carry 1). The row is always loaded; an
-- unresolved reference is NULL and counted 'unlinked' in lsbd._transform_quality.
--   inspections.inspection_status_id -> inspection_status (DB FK): InspectionStatusID uuid ->
--     live InspectionStatus row -> its InspectionStatus_ID (= inspection_status.id).
--   inspections.inspector_id -> users.id (= User_ID): InspectorID uuid -> Users.UserID.
--     (The May ETL passed the uuid through intOrNull, i.e. always NULL.)
--   inspection_details.inspection_id -> inspections (DB FK): InspectionID uuid -> INSPECTID,
--     else the INSPECTID int column.
--   permits.permit_type_id -> permit_type (no DB FK; permit_type.id is GENERATED, so it is
--     resolved by JOIN ON permit_type.legacy_id, controller carry 2 - the May ETL wrongly
--     assumed id = PermitType_ID). PermitTypeID uuid -> live PermitType rows. Three source
--     PermitType rows (6, 7, 8) share one uuid; such a uuid is disambiguated by the permit's
--     own PermitType name (exact trimmed match); still ambiguous -> NULL (unlinked).
--   education.education_type_id -> education_type (DB FK, id GENERATED): EducationTypeID ->
--     EducationType_ID -> JOIN education_type.legacy_id.
--   education.school_state_id -> states (id GENERATED): SchoolStateID -> _src_states
--     legacy_uid -> legacy_id -> JOIN states.legacy_id.
--   renewal_details.renewal_id / permit_id -> renewals / permits (DB FKs): RenewalID /
--     PermitID uuid -> Renewal_ID / Permits_ID, else the Renewal_ID / Permit_ID int column.
--   DB-FK references are NULLed by _unlink() in the delete phase before their parent row
--   is deleted (children first), so a parent delete never fails on the NO ACTION FK.
--   verbatim, no DB FK (as the May ETL): inspections.office_id, inspection_details
--   .individual_id (INDVID), permits.dentist_id / office_id, education.professional_id /
--   individual_id / den_hyg_id, renewals.individual_id, renewal_certification.den_hyg_id.

DROP VIEW IF EXISTS lsbd._src_inspection_status, lsbd._src_inspections, lsbd._src_inspection_details,
  lsbd._src_permits, lsbd._src_permit_history, lsbd._src_as_permit, lsbd._src_education,
  lsbd._src_renewals, lsbd._src_renewal_details, lsbd._src_renewal_certification CASCADE;

CREATE VIEW lsbd._src_inspection_status WITH (security_invoker = true) AS
SELECT r."InspectionStatus_ID"        AS id,
       lsbd._s(r."InspectionStatus")  AS inspection_status
  FROM lsbd_raw."InspectionStatus" r
 WHERE r._deleted_at IS NULL AND r."InspectionStatus_ID" IS NOT NULL;

CREATE VIEW lsbd._src_inspections WITH (security_invoker = true) AS
SELECT r."INSPECTID"                AS id,
       r."OFFICE_ID"                AS office_id,
       (r."InspectionDate" AT TIME ZONE 'America/Chicago') AS inspection_date,
       lsbd._s(r."InspectionNote")  AS inspection_note,
       r."Score"                    AS score,
       lsbd._s(r."D_1")             AS d1,
       lsbd._s(r."D_1_List")        AS d1_list,
       lsbd._s(r."D_1_Notes")       AS d1_notes,
       lsbd._s(r."D_2")             AS d2,
       lsbd._s(r."E_1")             AS e1,
       lsbd._s(r."E_1_Notes")       AS e1_notes,
       u.id                         AS inspector_id,
       st.id                        AS inspection_status_id,
       lsbd._s(r."Address1")        AS address1,
       lsbd._s(r."Address2")        AS address2,
       lsbd._s(r."Address3")        AS address3,
       lsbd._s(r."City")            AS city,
       lsbd._s(r."State")           AS state,
       lsbd._s(r."PostalCode")      AS postal_code,
       lsbd._s(r."C_1_List")        AS c1_list,
       lsbd._s(r."C_1_Notes")       AS c1_notes,
       lsbd._s(r."C_2")             AS c2,
       lsbd._s(r."C_3")             AS c3,
       lsbd._s(r."C_4")             AS c4,
       lsbd._s(r."E_2")             AS e2,
       lsbd._s(r."E_2_List")        AS e2_list,
       lsbd._s(r."E_2_Notes")       AS e2_notes,
       lsbd._s(r."Phone")           AS phone,
       lsbd._s(r."Violations")      AS violations,
       lsbd._s(r."STATUS")          AS status,
       lsbd._s(r."Inspector")       AS inspector
  FROM lsbd_raw."Inspections" r
  LEFT JOIN (SELECT legacy_uid, min(id) AS id FROM lsbd._src_users
              WHERE legacy_uid IS NOT NULL GROUP BY legacy_uid) u ON u.legacy_uid = r."InspectorID"
  LEFT JOIN (SELECT s."InspectionStatusID" AS uid, min(s."InspectionStatus_ID") AS id
               FROM lsbd_raw."InspectionStatus" s
              WHERE s._deleted_at IS NULL AND s."InspectionStatus_ID" IS NOT NULL AND s."InspectionStatusID" IS NOT NULL
              GROUP BY s."InspectionStatusID") st ON st.uid = r."InspectionStatusID"
 WHERE r._deleted_at IS NULL AND r."INSPECTID" IS NOT NULL;

CREATE VIEW lsbd._src_inspection_details WITH (security_invoker = true) AS
SELECT r."InspectionDetail_ID"      AS id,
       COALESCE(iu.id, ii.id)       AS inspection_id,
       r."INDVID"                   AS individual_id,
       lsbd._s(r."LastName")        AS last_name,
       lsbd._s(r."FirstName")       AS first_name,
       lsbd._s(r."MiddleName")      AS middle_name,
       lsbd._s(r."MarriedName")     AS married_name,
       lsbd._s(r."LicenseName")     AS license_name,
       lsbd._s(r."Suffix")          AS suffix,
       lsbd._s(r."Prefix")          AS prefix,
       lsbd._s(r."Role")            AS role,
       r."A_1" AS a1, r."A_2" AS a2, r."A_3" AS a3, r."A_4" AS a4, r."A_5" AS a5,
       r."A_6" AS a6, r."A_7" AS a7, r."A_8" AS a8, r."A_9" AS a9
  FROM lsbd_raw."InspectionDetails" r
  LEFT JOIN (SELECT i."InspectionID" AS uid, min(i."INSPECTID") AS id FROM lsbd_raw."Inspections" i
              WHERE i._deleted_at IS NULL AND i."INSPECTID" IS NOT NULL AND i."InspectionID" IS NOT NULL
              GROUP BY i."InspectionID") iu ON iu.uid = r."InspectionID"
  LEFT JOIN lsbd._src_inspections ii ON ii.id = r."INSPECTID"
 WHERE r._deleted_at IS NULL AND r."InspectionDetail_ID" IS NOT NULL;

CREATE VIEW lsbd._src_permits WITH (security_invoker = true) AS
SELECT r."Permits_ID"               AS id,
       pt.id                        AS permit_type_id,
       r."Dentist_ID"               AS dentist_id,
       r."Office_ID"                AS office_id,
       lsbd._s(r."PermitType")      AS permit_type_name,
       lsbd._s(r."PermitLevel")     AS permit_level,
       lsbd._s(r."Description")     AS description,
       (r."IssueDate"     AT TIME ZONE 'America/Chicago') AS issue_date,
       (r."Updated"       AT TIME ZONE 'America/Chicago') AS updated,
       (r."UpdatedOnline" AT TIME ZONE 'America/Chicago') AS updated_online
  FROM lsbd_raw."Permits" r
  LEFT JOIN (SELECT p."PermitTypeID" AS uid, count(*) AS n, min(p."PermitType_ID") AS id
               FROM lsbd_raw."PermitType" p
              WHERE p._deleted_at IS NULL AND p."PermitType_ID" IS NOT NULL AND p."PermitTypeID" IS NOT NULL
              GROUP BY p."PermitTypeID") pu ON pu.uid = r."PermitTypeID"
  LEFT JOIN (SELECT p."PermitTypeID" AS uid, lsbd._s(p."PermitType") AS nm, count(*) AS n, min(p."PermitType_ID") AS id
               FROM lsbd_raw."PermitType" p
              WHERE p._deleted_at IS NULL AND p."PermitType_ID" IS NOT NULL AND p."PermitTypeID" IS NOT NULL
              GROUP BY p."PermitTypeID", lsbd._s(p."PermitType")) pn
         ON pn.uid = r."PermitTypeID" AND pn.nm = lsbd._s(r."PermitType")
  LEFT JOIN lsbd.permit_type pt
         ON pt.legacy_id = (CASE WHEN pu.n = 1 THEN pu.id WHEN pn.n = 1 THEN pn.id END)::text
 WHERE r._deleted_at IS NULL AND r."Permits_ID" IS NOT NULL;

CREATE VIEW lsbd._src_permit_history WITH (security_invoker = true) AS
SELECT r."ID"                       AS id,
       r."LicenseID"                AS license_id,
       lsbd._s(r."PermitType")      AS permit_type_name,
       r."OfficeID"                 AS office_id,
       lsbd._s(r."OperationType")   AS operation_type,
       (r."Updated" AT TIME ZONE 'America/Chicago') AS updated,
       lsbd._s(r."UpdatedBy")       AS updated_by
  FROM lsbd_raw."PermitHistory" r
 WHERE r._deleted_at IS NULL AND r."ID" IS NOT NULL;

CREATE VIEW lsbd._src_as_permit WITH (security_invoker = true) AS
SELECT r."Key"                      AS id,
       lsbd._s(r."LicenseId")       AS license_id,
       lsbd._s(r."Type")            AS type,
       lsbd._s(r."STATUS")          AS status,
       (r."DateSince"     AT TIME ZONE 'America/Chicago') AS date_since,
       (r."DateUntil"     AT TIME ZONE 'America/Chicago') AS date_until,
       (r."DateInactive"  AT TIME ZONE 'America/Chicago') AS date_inactive,
       (r."DateReinstate" AT TIME ZONE 'America/Chicago') AS date_reinstate,
       (r."DateUpdated"   AT TIME ZONE 'America/Chicago') AS date_updated,
       (r."DateRenew"     AT TIME ZONE 'America/Chicago') AS date_renew,
       lsbd._s(r."DLicenseId")      AS d_license_id,
       lsbd._s(r."OtherDentists")   AS other_dentists,
       lsbd._s(r."TRAINING")        AS training,
       lsbd._s(r."TRAINYEAR")       AS train_year,
       lsbd._s(r."RegYear")         AS reg_year,
       lsbd._s(r."InspectedO")      AS inspected_o,
       lsbd._s(r."Inspected")       AS inspected,
       lsbd._s(r."InspectedS1")     AS inspected_s1,
       lsbd._s(r."InspectedS2")     AS inspected_s2,
       lsbd._s(r."RenewMnth")       AS renew_month,
       lsbd._s(r."Notes")           AS notes,
       lsbd._s(r."Audit")           AS audit,
       lsbd._s(r."SLEVEL")          AS s_level
  FROM lsbd_raw."tblASPermits" r
 WHERE r._deleted_at IS NULL AND r."Key" IS NOT NULL;

CREATE VIEW lsbd._src_education WITH (security_invoker = true) AS
SELECT r."Education_ID"             AS id,
       r."Professional_ID"          AS professional_id,
       r."Individual_ID"            AS individual_id,
       r."DenHygID"                 AS den_hyg_id,
       et.id                        AS education_type_id,
       lsbd._s(r."School")          AS school,
       (r."GraduationDate" AT TIME ZONE 'America/Chicago') AS graduation_date,
       (r."Updated"        AT TIME ZONE 'America/Chicago') AS updated,
       st.id                        AS school_state_id,
       r."BoardCertified"           AS board_certified,
       lsbd._s(r."CertifiedBy")     AS certified_by,
       (r."CertificationDate" AT TIME ZONE 'America/Chicago') AS certification_date,
       lsbd._s(r."STATE")           AS state,
       lsbd._s(r."EDUTYPE")         AS edu_type
  FROM lsbd_raw."Education" r
  LEFT JOIN (SELECT e."EducationTypeID" AS uid, min(e."EducationType_ID") AS id FROM lsbd_raw."EducationType" e
              WHERE e._deleted_at IS NULL AND e."EducationType_ID" IS NOT NULL AND e."EducationTypeID" IS NOT NULL
              GROUP BY e."EducationTypeID") eu ON eu.uid = r."EducationTypeID"
  LEFT JOIN lsbd.education_type et ON et.legacy_id = eu.id::text
  LEFT JOIN (SELECT DISTINCT ON (legacy_uid) legacy_uid, legacy_id FROM lsbd._src_states
              WHERE legacy_uid IS NOT NULL ORDER BY legacy_uid, legacy_id::int) sst ON sst.legacy_uid = r."SchoolStateID"
  LEFT JOIN lsbd.states st ON st.legacy_id = sst.legacy_id
 WHERE r._deleted_at IS NULL AND r."Education_ID" IS NOT NULL;

CREATE VIEW lsbd._src_renewals WITH (security_invoker = true) AS
SELECT r."Renewal_ID"               AS id,
       r."Individual_ID"            AS individual_id,
       (r."AppPrinted"     AT TIME ZONE 'America/Chicago') AS app_printed,
       (r."LicensePrinted" AT TIME ZONE 'America/Chicago') AS license_printed,
       r."RenewalAmount"            AS renewal_amount,
       lsbd._s(r."RenewalYear")     AS renewal_year,
       (r."TransactionDate" AT TIME ZONE 'America/Chicago') AS transaction_date,
       (r."LastUpdate"      AT TIME ZONE 'America/Chicago') AS last_update,
       r."AmountPaid"               AS amount_paid,
       (r."pPermitPrinted" AT TIME ZONE 'America/Chicago') AS p_permit_printed,
       (r."oPermitPrinted" AT TIME ZONE 'America/Chicago') AS o_permit_printed
  FROM lsbd_raw."Renewals" r
 WHERE r._deleted_at IS NULL AND r."Renewal_ID" IS NOT NULL;

CREATE VIEW lsbd._src_renewal_details WITH (security_invoker = true) AS
SELECT r."RenewalDetail_ID"         AS id,
       COALESCE(ru.id, ri.id)       AS renewal_id,
       COALESCE(pu.id, pi.id)       AS permit_id,
       (r."Printed" AT TIME ZONE 'America/Chicago') AS printed
  FROM lsbd_raw."RenewalDetails" r
  LEFT JOIN (SELECT x."RenewalID" AS uid, min(x."Renewal_ID") AS id FROM lsbd_raw."Renewals" x
              WHERE x._deleted_at IS NULL AND x."Renewal_ID" IS NOT NULL AND x."RenewalID" IS NOT NULL
              GROUP BY x."RenewalID") ru ON ru.uid = r."RenewalID"
  LEFT JOIN lsbd._src_renewals ri ON ri.id = r."Renewal_ID"
  LEFT JOIN (SELECT x."PermitsID" AS uid, min(x."Permits_ID") AS id FROM lsbd_raw."Permits" x
              WHERE x._deleted_at IS NULL AND x."Permits_ID" IS NOT NULL AND x."PermitsID" IS NOT NULL
              GROUP BY x."PermitsID") pu ON pu.uid = r."PermitID"
  LEFT JOIN (SELECT x."Permits_ID" AS id FROM lsbd_raw."Permits" x
              WHERE x._deleted_at IS NULL AND x."Permits_ID" IS NOT NULL) pi ON pi.id = r."Permit_ID"
 WHERE r._deleted_at IS NULL AND r."RenewalDetail_ID" IS NOT NULL;

-- den_hyg_id and year are NOT NULL in lsbd: a row missing one is skipped + counted.
CREATE VIEW lsbd._src_renewal_certification WITH (security_invoker = true) AS
SELECT r."ID"                       AS id,
       r."DenHygID"                 AS den_hyg_id,
       r."Year"                     AS year,
       lsbd._s(r."AnesIncident")    AS anes_incident,
       lsbd._s(r."Convicted")       AS convicted,
       lsbd._s(r."Discipline")      AS discipline,
       lsbd._s(r."CE")              AS ce
  FROM lsbd_raw."RenewalCertification" r
 WHERE r._deleted_at IS NULL AND r."ID" IS NOT NULL AND r."DenHygID" IS NOT NULL AND r."Year" IS NOT NULL;

CREATE OR REPLACE FUNCTION lsbd.transform_operational(phase text DEFAULT 'all')
RETURNS integer
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  o integer := 0;
BEGIN
  IF phase NOT IN ('all', 'delete', 'upsert') THEN
    RAISE EXCEPTION 'transform_operational: unknown phase %', phase;
  END IF;

  IF phase IN ('all', 'delete') THEN
    -- children first; each NO ACTION FK is unlinked before its parent's delete
    PERFORM lsbd._delete('lsbd.inspection_details',    'lsbd._src_inspection_details',    '{id}');
    PERFORM lsbd._unlink('lsbd.inspection_details', 'inspection_id',
      'SELECT 1 FROM lsbd._src_inspections s WHERE s.id = t.inspection_id');
    PERFORM lsbd._delete('lsbd.inspections',           'lsbd._src_inspections',           '{id}');
    PERFORM lsbd._unlink('lsbd.inspections', 'inspection_status_id',
      'SELECT 1 FROM lsbd._src_inspection_status s WHERE s.id = t.inspection_status_id');
    PERFORM lsbd._delete('lsbd.inspection_status',     'lsbd._src_inspection_status',     '{id}');
    PERFORM lsbd._delete('lsbd.renewal_details',       'lsbd._src_renewal_details',       '{id}');
    PERFORM lsbd._unlink('lsbd.renewal_details', 'renewal_id',
      'SELECT 1 FROM lsbd._src_renewals s WHERE s.id = t.renewal_id');
    PERFORM lsbd._unlink('lsbd.renewal_details', 'permit_id',
      'SELECT 1 FROM lsbd._src_permits s WHERE s.id = t.permit_id');
    PERFORM lsbd._delete('lsbd.renewals',              'lsbd._src_renewals',              '{id}');
    PERFORM lsbd._delete('lsbd.permits',               'lsbd._src_permits',               '{id}');
    PERFORM lsbd._delete('lsbd.permit_history',        'lsbd._src_permit_history',        '{id}');
    PERFORM lsbd._delete('lsbd.as_permit',             'lsbd._src_as_permit',             '{id}');
    PERFORM lsbd._delete('lsbd.education',             'lsbd._src_education',             '{id}');
    -- education_type lives in the lookups domain (deleted later, sort_order 10)
    PERFORM lsbd._unlink('lsbd.education', 'education_type_id',
      'SELECT 1 FROM lsbd.education_type et JOIN lsbd._src_education_type s ON s.legacy_id = et.legacy_id WHERE et.id = t.education_type_id');
    PERFORM lsbd._delete('lsbd.renewal_certification', 'lsbd._src_renewal_certification', '{id}');
  END IF;

  IF phase IN ('all', 'upsert') THEN
    o := o + lsbd._upsert('lsbd.inspection_status',     'lsbd._src_inspection_status',     '{id}', 'InspectionStatus');
    o := o + lsbd._upsert('lsbd.inspections',           'lsbd._src_inspections',           '{id}', 'Inspections');
    o := o + lsbd._upsert('lsbd.inspection_details',    'lsbd._src_inspection_details',    '{id}', 'InspectionDetails');
    o := o + lsbd._upsert('lsbd.permits',               'lsbd._src_permits',               '{id}', 'Permits');
    o := o + lsbd._upsert('lsbd.permit_history',        'lsbd._src_permit_history',        '{id}', 'PermitHistory');
    o := o + lsbd._upsert('lsbd.as_permit',             'lsbd._src_as_permit',             '{id}', 'tblASPermits');
    o := o + lsbd._upsert('lsbd.education',             'lsbd._src_education',             '{id}', 'Education');
    o := o + lsbd._upsert('lsbd.renewals',              'lsbd._src_renewals',              '{id}', 'Renewals');
    o := o + lsbd._upsert('lsbd.renewal_details',       'lsbd._src_renewal_details',       '{id}', 'RenewalDetails');
    o := o + lsbd._upsert('lsbd.renewal_certification', 'lsbd._src_renewal_certification', '{id}', 'RenewalCertification');

    PERFORM lsbd._count_unlinked('lsbd.inspections', 'inspection_status_id -> inspection_status', 'Inspections',
      'r."INSPECTID" = t.id', 'r."InspectionStatusID"', 'inspection_status_id');
    PERFORM lsbd._count_unlinked('lsbd.inspections', 'inspector_id -> users', 'Inspections',
      'r."INSPECTID" = t.id', 'r."InspectorID"', 'inspector_id');
    PERFORM lsbd._count_unlinked('lsbd.inspection_details', 'inspection_id -> inspections', 'InspectionDetails',
      'r."InspectionDetail_ID" = t.id', 'COALESCE(r."InspectionID"::text, r."INSPECTID"::text)', 'inspection_id');
    PERFORM lsbd._count_unlinked('lsbd.permits', 'permit_type_id -> permit_type', 'Permits',
      'r."Permits_ID" = t.id', 'r."PermitTypeID"', 'permit_type_id');
    PERFORM lsbd._count_unlinked('lsbd.education', 'education_type_id -> education_type', 'Education',
      'r."Education_ID" = t.id', 'r."EducationTypeID"', 'education_type_id');
    PERFORM lsbd._count_unlinked('lsbd.education', 'school_state_id -> states', 'Education',
      'r."Education_ID" = t.id', 'r."SchoolStateID"', 'school_state_id');
    PERFORM lsbd._count_unlinked('lsbd.renewal_details', 'renewal_id -> renewals', 'RenewalDetails',
      'r."RenewalDetail_ID" = t.id', 'COALESCE(r."RenewalID"::text, r."Renewal_ID"::text)', 'renewal_id');
    PERFORM lsbd._count_unlinked('lsbd.renewal_details', 'permit_id -> permits', 'RenewalDetails',
      'r."RenewalDetail_ID" = t.id', 'COALESCE(r."PermitID"::text, r."Permit_ID"::text)', 'permit_id');
  END IF;
  RETURN o;
END;
$$;

INSERT INTO lsbd._transform_registry (domain, fn, sort_order, source_tables)
VALUES ('operational', 'lsbd.transform_operational'::regproc, 60, ARRAY[
  -- own sources
  'InspectionStatus', 'Inspections', 'InspectionDetails', 'Permits', 'PermitHistory', 'tblASPermits',
  'Education', 'Renewals', 'RenewalDetails', 'RenewalCertification',
  -- parents (lookups / entities / geography this domain resolves against)
  'Users', 'PermitType', 'EducationType', 'States'])
ON CONFLICT (domain) DO UPDATE
  SET fn = EXCLUDED.fn, sort_order = EXCLUDED.sort_order, source_tables = EXCLUDED.source_tables;

SELECT lsbd._lockdown();
