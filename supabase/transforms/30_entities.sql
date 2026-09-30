-- supabase/transforms/30_entities.sql
--
-- Domain "entities": individual_status, individual, professional, office,
-- schools, users, category, specialty, statutes, board_members,
-- announcements, faqs. Ported from scripts/etl-b2-entities.ts.
-- Keys (0003 KEY MAP):
--   id = source int PK (inserted explicitly; run_transforms bumps the sequence):
--        individual_status (IndividualStatus_ID), office (OFFICE_ID),
--        schools (ID), users (User_ID), category (CATID),
--        board_members (BoardMember_ID), announcements (ANNOUNCID), faqs (FAQSID)
--   individual.indv_id = INDVID (PK individual_id = source IndividualID uuid;
--        legacy_id = source ID, NOT a key)
--   professional.legacy_id = Professional_ID (PK professional_id = ProfessionalID uuid)
--   specialty / statutes legacy_id = lower(<uuid>::text) (sources have no PK)
-- Parents (orphan = non-NULL reference with no eligible parent: skipped + counted,
-- never inserted with a NULL FK):
--   individual.individual_status_uuid -> individual_status (DB FK)
--   professional.individual_id        -> individual        (DB FK)
--   specialty.professional_uid        -> professional (professional_id int := professional.legacy_id)
--   announcements/faqs.category_uid   -> category (category_id := category.id = CATID)
-- Columns that are UNIQUE in lsbd besides the key (individual_status_uuid,
-- individual.individual_id, professional.professional_id) keep the lowest
-- source key per value; later duplicates are skipped + counted.
-- individual.ssn: NULL. The May ETL nulled it after moving the SSN into
-- licensee_pii (etl-b2-pii.ts); the HMAC only lives in lsbd.licensee_pii.

DROP VIEW IF EXISTS lsbd._src_individual_status, lsbd._src_individual, lsbd._src_professional,
  lsbd._src_office, lsbd._src_schools, lsbd._src_users, lsbd._src_category, lsbd._src_specialty,
  lsbd._src_statutes, lsbd._src_board_members, lsbd._src_announcements, lsbd._src_faqs CASCADE;

CREATE VIEW lsbd._src_individual_status WITH (security_invoker = true) AS
SELECT id, individual_status_uuid, status, process_renewal, legacy_id FROM (
  SELECT r."IndividualStatus_ID" AS id,
         r."IndividualStatusID"  AS individual_status_uuid,
         lsbd._s(r."Status")     AS status,
         r."ProcessRenewal"      AS process_renewal,
         r."IndividualStatus_ID" AS legacy_id,
         CASE WHEN r."IndividualStatusID" IS NULL THEN 1
              ELSE row_number() OVER (PARTITION BY r."IndividualStatusID" ORDER BY r."IndividualStatus_ID") END AS rn
    FROM lsbd_raw."IndividualStatus" r
   WHERE r._deleted_at IS NULL AND r."IndividualStatus_ID" IS NOT NULL) x
 WHERE rn = 1;

CREATE VIEW lsbd._src_individual WITH (security_invoker = true) AS
SELECT individual_id, last_name, first_name, middle_name, married_name, license_name, suffix, prefix,
       use_license_name, ssn, dob, sex, race, email, web_site, processing_group, notes, updated_at,
       individual_status_uuid, legacy_id, status, indv_id
  FROM (
  SELECT r."IndividualID"          AS individual_id,
         lsbd._s(r."LastName")     AS last_name,
         lsbd._s(r."FirstName")    AS first_name,
         lsbd._s(r."MiddleName")   AS middle_name,
         lsbd._s(r."MarriedName")  AS married_name,
         lsbd._s(r."LicenseName")  AS license_name,
         lsbd._s(r."Suffix")       AS suffix,
         lsbd._s(r."Prefix")       AS prefix,
         r."UseLicenseName"        AS use_license_name,
         NULL::text                AS ssn,
         (r."DOB" AT TIME ZONE 'America/Chicago') AS dob,
         lsbd._s(r."Sex")          AS sex,
         lsbd._s(r."Race")         AS race,
         lsbd._s(r."Email")        AS email,
         lsbd._s(r."WebSite")      AS web_site,
         lsbd._s(r."ProcessingGroup") AS processing_group,
         lsbd._s(r."Notes")        AS notes,
         (r."Updated" AT TIME ZONE 'America/Chicago') AS updated_at,
         r."IndividualStatusID"    AS individual_status_uuid,
         r."ID"                    AS legacy_id,
         lsbd._s(r."STATUS")       AS status,
         r."INDVID"                AS indv_id,
         row_number() OVER (PARTITION BY r."IndividualID" ORDER BY r."INDVID") AS rn
    FROM lsbd_raw."Individual" r
    LEFT JOIN lsbd._src_individual_status s ON s.individual_status_uuid = r."IndividualStatusID"
   WHERE r._deleted_at IS NULL AND r."INDVID" IS NOT NULL AND r."IndividualID" IS NOT NULL
     AND (r."IndividualStatusID" IS NULL OR s.individual_status_uuid IS NOT NULL)) x
 WHERE rn = 1;

CREATE VIEW lsbd._src_professional WITH (security_invoker = true) AS
SELECT professional_id, professional_type_uuid, practice_type_uuid, individual_id, license_number,
       original_lic_issue_date, credential_exam, audit_year, updated_at, inactive, cs_none, cs_dispense,
       cs_administer, legacy_id, professional_type, practice_type, individual_legacy_id
  FROM (
  SELECT r."ProfessionalID"        AS professional_id,
         r."ProfessionalTypeID"    AS professional_type_uuid,
         r."PracticeTypeID"        AS practice_type_uuid,
         r."IndividualID"          AS individual_id,
         lsbd._s(r."LicenseNumber") AS license_number,
         (r."Original_Lic_Issue_Date" AT TIME ZONE 'America/Chicago') AS original_lic_issue_date,
         lsbd._s(r."Creditial_Exam") AS credential_exam,
         lsbd._s(r."AuditYear")    AS audit_year,
         (r."Updated" AT TIME ZONE 'America/Chicago') AS updated_at,
         r."Inactive"              AS inactive,
         r."CSNone"                AS cs_none,
         r."CSDispense"            AS cs_dispense,
         r."CSAdminister"          AS cs_administer,
         r."Professional_ID"       AS legacy_id,
         lsbd._s(r."ProfessionalType") AS professional_type,
         lsbd._s(r."PracticeType") AS practice_type,
         lsbd._s(r."Individual_ID") AS individual_legacy_id,
         row_number() OVER (PARTITION BY r."ProfessionalID" ORDER BY r."Professional_ID") AS rn
    FROM lsbd_raw."Professional" r
    LEFT JOIN lsbd._src_individual i ON i.individual_id = r."IndividualID"
   WHERE r._deleted_at IS NULL AND r."Professional_ID" IS NOT NULL AND r."ProfessionalID" IS NOT NULL
     AND (r."IndividualID" IS NULL OR i.individual_id IS NOT NULL)) x
 WHERE rn = 1;

CREATE VIEW lsbd._src_office WITH (security_invoker = true) AS
SELECT r."OFFICE_ID" AS id,
       r."OfficeID" AS legacy_uid,
       lsbd._s(r."OfficeName") AS office_name,
       (r."Updated" AT TIME ZONE 'America/Chicago') AS updated,
       r."OldOfficeID" AS old_office_id,
       lsbd._s(r."Phone") AS phone
  FROM lsbd_raw."Office" r
 WHERE r._deleted_at IS NULL AND r."OFFICE_ID" IS NOT NULL;

CREATE VIEW lsbd._src_schools WITH (security_invoker = true) AS
SELECT r."ID" AS id,
       lsbd._s(r."SCHSTATE") AS sch_state,
       lsbd._s(r."SCHNAME")  AS sch_name
  FROM lsbd_raw."tblSchools" r
 WHERE r._deleted_at IS NULL AND r."ID" IS NOT NULL;

-- Users.Password never reaches lsbd_raw (column policy "drop").
CREATE VIEW lsbd._src_users WITH (security_invoker = true) AS
SELECT r."User_ID" AS id,
       r."UserID" AS legacy_uid,
       lsbd._s(r."UserName") AS user_name,
       r."AccessLevel" AS access_level,
       lsbd._s(r."EmailAddress") AS email_address,
       lsbd._s(r."FullName") AS full_name,
       r."SR_Col_1_Width" AS sr_col_1_width,
       r."SR_Col_2_Width" AS sr_col_2_width,
       r."Inspector" AS inspector,
       lsbd._s(r."Title") AS title,
       lsbd._s(r."Phone") AS phone
  FROM lsbd_raw."Users" r
 WHERE r._deleted_at IS NULL AND r."User_ID" IS NOT NULL;

CREATE VIEW lsbd._src_category WITH (security_invoker = true) AS
SELECT r."CATID" AS id,
       r."CAT_ID" AS legacy_uid,
       lsbd._s(r."CAT_DESC") AS description,
       r."CAT_ACTIVE" AS active,
       r."CAT_TYPE" AS cat_type
  FROM lsbd_raw."Catagory" r
 WHERE r._deleted_at IS NULL AND r."CATID" IS NOT NULL;

-- Specialty: no source PK (0 rows today). Key lower(SpecialtyID), first _rowid wins.
CREATE VIEW lsbd._src_specialty WITH (security_invoker = true) AS
SELECT DISTINCT ON (lower(r."SpecialtyID"::text))
       lower(r."SpecialtyID"::text) AS legacy_id,
       r."SpecialtyID" AS legacy_uid,
       r."ProfessionalD" AS professional_uid,
       p.legacy_id AS professional_id,
       lsbd._s(r."Institution") AS institution,
       (r."SpecialtyDate" AT TIME ZONE 'America/Chicago') AS specialty_date,
       r."BoardCertified" AS board_certified,
       lsbd._s(r."CertifiedBy") AS certified_by,
       (r."CertifiedDate" AT TIME ZONE 'America/Chicago') AS certified_date,
       (r."Updated" AT TIME ZONE 'America/Chicago') AS updated
  FROM lsbd_raw."Specialty" r
  LEFT JOIN lsbd._src_professional p ON p.professional_id = r."ProfessionalD"
 WHERE r._deleted_at IS NULL AND r."SpecialtyID" IS NOT NULL
   AND (r."ProfessionalD" IS NULL OR p.professional_id IS NOT NULL)
 ORDER BY lower(r."SpecialtyID"::text), r._rowid;

-- Statutes: no source PK (0 rows today). Key lower(StatuteID), first _rowid wins.
CREATE VIEW lsbd._src_statutes WITH (security_invoker = true) AS
SELECT DISTINCT ON (lower(r."StatuteID"::text))
       lower(r."StatuteID"::text) AS legacy_id,
       r."StatuteID" AS legacy_uid,
       lsbd._s(r."Statute") AS statute,
       lsbd._s(r."StatuteTitle") AS statute_title,
       lsbd._s(r."Notes") AS notes
  FROM lsbd_raw."Statutes" r
 WHERE r._deleted_at IS NULL AND r."StatuteID" IS NOT NULL
 ORDER BY lower(r."StatuteID"::text), r._rowid;

CREATE VIEW lsbd._src_board_members WITH (security_invoker = true) AS
SELECT r."BoardMember_ID" AS id,
       r."BoardMemberID" AS legacy_uid,
       lsbd._s(r."FullName") AS full_name,
       lsbd._s(r."Title") AS title,
       lsbd._s(r."Address1") AS address_1,
       lsbd._s(r."Address2") AS address_2,
       r."DisplayOrderOverride" AS display_order_override
  FROM lsbd_raw."BoardMembers" r
 WHERE r._deleted_at IS NULL AND r."BoardMember_ID" IS NOT NULL;

CREATE VIEW lsbd._src_announcements WITH (security_invoker = true) AS
SELECT r."ANNOUNCID" AS id,
       r."ANNOUNC_ID" AS legacy_uid,
       lsbd._s(r."ANNOUNC_SUBJECT") AS subject,
       lsbd._s(r."ANNOUNC_ANNOUNCEMENTS") AS body,
       (r."ANNOUNC_EXP_DATE" AT TIME ZONE 'America/Chicago') AS expiration_date,
       r."ANNOUNC_ACTIVE" AS active,
       r."CAT_ID" AS category_uid,
       c.id AS category_id,
       lsbd._s(r."CATEGORY") AS category_text
  FROM lsbd_raw."Announcements" r
  LEFT JOIN (SELECT legacy_uid, min(id) AS id FROM lsbd._src_category GROUP BY legacy_uid) c ON c.legacy_uid = r."CAT_ID"
 WHERE r._deleted_at IS NULL AND r."ANNOUNCID" IS NOT NULL
   AND (r."CAT_ID" IS NULL OR c.id IS NOT NULL);

CREATE VIEW lsbd._src_faqs WITH (security_invoker = true) AS
SELECT r."FAQSID" AS id,
       r."FAQS_ID" AS legacy_uid,
       lsbd._s(r."FAQS_QUESTIONS") AS question,
       lsbd._s(r."FAQS_ANSWERS") AS answer,
       r."FAQS_ACTIVE" AS active,
       r."CAT_ID" AS category_uid,
       c.id AS category_id,
       lsbd._s(r."CATEGORY") AS category_text
  FROM lsbd_raw."FAQS" r
  LEFT JOIN (SELECT legacy_uid, min(id) AS id FROM lsbd._src_category GROUP BY legacy_uid) c ON c.legacy_uid = r."CAT_ID"
 WHERE r._deleted_at IS NULL AND r."FAQSID" IS NOT NULL
   AND (r."CAT_ID" IS NULL OR c.id IS NOT NULL);

CREATE OR REPLACE FUNCTION lsbd.transform_entities(phase text DEFAULT 'all')
RETURNS integer
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  o integer := 0;
BEGIN
  IF phase NOT IN ('all', 'delete', 'upsert') THEN
    RAISE EXCEPTION 'transform_entities: unknown phase %', phase;
  END IF;

  IF phase IN ('all', 'delete') THEN
    -- children before parents
    PERFORM lsbd._delete('lsbd.faqs',              'lsbd._src_faqs',              '{id}');
    PERFORM lsbd._delete('lsbd.announcements',     'lsbd._src_announcements',     '{id}');
    PERFORM lsbd._delete('lsbd.specialty',         'lsbd._src_specialty',         '{legacy_id}');
    PERFORM lsbd._delete('lsbd.professional',      'lsbd._src_professional',      '{legacy_id}');
    PERFORM lsbd._delete('lsbd.individual',        'lsbd._src_individual',        '{indv_id}');
    PERFORM lsbd._delete('lsbd.individual_status', 'lsbd._src_individual_status', '{id}');
    PERFORM lsbd._delete('lsbd.category',          'lsbd._src_category',          '{id}');
    PERFORM lsbd._delete('lsbd.office',            'lsbd._src_office',            '{id}');
    PERFORM lsbd._delete('lsbd.schools',           'lsbd._src_schools',           '{id}');
    PERFORM lsbd._delete('lsbd.users',             'lsbd._src_users',             '{id}');
    PERFORM lsbd._delete('lsbd.statutes',          'lsbd._src_statutes',          '{legacy_id}');
    PERFORM lsbd._delete('lsbd.board_members',     'lsbd._src_board_members',     '{id}');
  END IF;

  IF phase IN ('all', 'upsert') THEN
    o := o + lsbd._upsert('lsbd.individual_status', 'lsbd._src_individual_status', '{id}',        'IndividualStatus');
    o := o + lsbd._upsert('lsbd.individual',        'lsbd._src_individual',        '{indv_id}',   'Individual');
    o := o + lsbd._upsert('lsbd.professional',      'lsbd._src_professional',      '{legacy_id}', 'Professional');
    o := o + lsbd._upsert('lsbd.office',            'lsbd._src_office',            '{id}',        'Office');
    o := o + lsbd._upsert('lsbd.schools',           'lsbd._src_schools',           '{id}',        'tblSchools');
    o := o + lsbd._upsert('lsbd.users',             'lsbd._src_users',             '{id}',        'Users');
    o := o + lsbd._upsert('lsbd.category',          'lsbd._src_category',          '{id}',        'Catagory');
    o := o + lsbd._upsert('lsbd.specialty',         'lsbd._src_specialty',         '{legacy_id}', 'Specialty');
    o := o + lsbd._upsert('lsbd.statutes',          'lsbd._src_statutes',          '{legacy_id}', 'Statutes');
    o := o + lsbd._upsert('lsbd.board_members',     'lsbd._src_board_members',     '{id}',        'BoardMembers');
    o := o + lsbd._upsert('lsbd.announcements',     'lsbd._src_announcements',     '{id}',        'Announcements');
    o := o + lsbd._upsert('lsbd.faqs',              'lsbd._src_faqs',              '{id}',        'FAQS');
  END IF;
  RETURN o;
END;
$$;

INSERT INTO lsbd._transform_registry (domain, fn, sort_order, source_tables)
VALUES ('entities', 'lsbd.transform_entities'::regproc, 30, ARRAY[
  'IndividualStatus', 'Individual', 'Professional', 'Office', 'tblSchools', 'Users', 'Catagory',
  'Specialty', 'Statutes', 'BoardMembers', 'Announcements', 'FAQS'])
ON CONFLICT (domain) DO UPDATE
  SET fn = EXCLUDED.fn, sort_order = EXCLUDED.sort_order, source_tables = EXCLUDED.source_tables;

SELECT lsbd._lockdown();
