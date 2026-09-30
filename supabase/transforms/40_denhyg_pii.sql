-- supabase/transforms/40_denhyg_pii.sql
--
-- Domain "denhyg_pii": the tblDenHyg split (the public /verify path).
-- ONE lsbd.person + ONE lsbd.license per live tblDenHyg row, both keyed by
-- tblDenHyg."Key" (legacy_key). No license_id dedupe: LICENSEID is only unique
-- per Type and even (Type, LICENSEID) has duplicate groups (Global Constraints).
-- Children (licensee_pii, person_address, person_education,
-- person_practice_stats, person_meta) key on person_id, resolved as
-- lsbd.person.id WHERE person.legacy_key = r."Key" (person upserts first, and
-- its generated id is never overwritten, so person_id is stable across runs).
--
-- Ported from scripts/etl-tbldenhyg.ts (person, license) and
-- scripts/etl-b2-pii.ts (licensee_pii):
--   etl-tbldenhyg strOrNull does NOT trim: NULLIF(x, '').
--   Type/Class/STATUS enumOrNull: trimmed value if in the enum, else NULL.
--   LICENSEID NULL -> 'unknown-<Key>'. UseLicenseName ?? false, IsCurrent ?? true.
--   licensee_pii: ssn_hash = lsbd_raw SSN (already the base64 HMAC, or NULL);
--   sex/race trimmed (etl-b2-pii strOrNull); background ?? false;
--   password_hash never written (not in the view).
-- The four person_* children have no May mapper; mapped from the tblDenHyg
-- columns named in the Drizzle schema comments (src/lib/db/lsbd/core.ts):
--   person_address: one row per NON-EMPTY bucket (home / office / permanent);
--     a bucket with no address component (line1..3, city, state, zip, county,
--     country) produces no row. address_id (xref to ADDRESS) is left untouched.
--   person_education / person_practice_stats / person_meta: one row per person.
--   cs_none/cs_dispense/cs_administer/inactive2 NULL -> false (schema default).
--   person_meta.legacy_id = tblDenHyg.ID (not the PK), individual_uuid =
--   tblDenHyg.IndividualID verbatim, individual_legacy_id = IndividualID_.
--   ACTIVE is dropped (schema: redundant with license.status).
--
-- Individual link (ruling R22, spec 4.2 "App-facing IDs must stay stable"):
-- person, license and every child depend ONLY on the live lsbd_raw."tblDenHyg"
-- row. person.individual_id is a LEFT JOIN lookup tblDenHyg.IndividualID_ ->
-- Individual.INDVID (via lsbd._src_individual); when it does not resolve,
-- individual_id is NULL (lsbd.person has no FK to individual). Unresolved
-- links are "unlinked": reported by RAISE NOTICE, NOT added to the returned
-- orphan count, and never excluded or deleted -- an Individual/IndividualStatus
-- change can only update person.individual_id, never delete a licensee.
-- (tblDenHyg's IndividualID uuid matches no Individual row in the source, so it
-- is only carried verbatim on person_meta.)
-- Timestamps: (<col> AT TIME ZONE 'America/Chicago').

DROP VIEW IF EXISTS lsbd._src_denhyg, lsbd._src_person, lsbd._src_license, lsbd._src_licensee_pii,
  lsbd._src_person_address, lsbd._src_person_education, lsbd._src_person_practice_stats,
  lsbd._src_person_meta CASCADE;

-- Live tblDenHyg rows (+ the resolved individual uuid, NULL when unlinked).
-- indv_id is unique in _src_individual (INDVID is the source PK), so the LEFT
-- JOIN never multiplies rows.
CREATE VIEW lsbd._src_denhyg WITH (security_invoker = true) AS
SELECT r.*, i.individual_id AS _individual_id
  FROM lsbd_raw."tblDenHyg" r
  LEFT JOIN lsbd._src_individual i ON i.indv_id = r."IndividualID_"
 WHERE r._deleted_at IS NULL AND r."Key" IS NOT NULL;

CREATE VIEW lsbd._src_person WITH (security_invoker = true) AS
SELECT r."Key"                         AS legacy_key,
       r._individual_id                AS individual_id,
       NULLIF(r."FIRSTName", '')       AS first_name,
       NULLIF(r."MIDDLE", '')          AS middle_name,
       NULLIF(r."LASTName", '')        AS last_name,
       NULLIF(r."LicenseName", '')     AS license_name,
       NULLIF(r."MarriedName", '')     AS married_name,
       NULLIF(r."Prefix", '')          AS prefix,
       NULLIF(r."Suffix", '')          AS suffix,
       COALESCE(r."UseLicenseName", false) AS use_license_name,
       NULLIF(r."Email", '')           AS email,
       NULLIF(r."URL", '')             AS url,
       NULLIF(r."Phone1", '')          AS phone1,
       NULLIF(r."Ext1", '')            AS ext1,
       NULLIF(r."Phone2", '')          AS phone2,
       NULLIF(r."Ext2", '')            AS ext2,
       NULLIF(r."Fax", '')             AS fax,
       NULLIF(r."Fax2", '')            AS fax2,
       NULLIF(r."OPT_IN", '')          AS opt_in
  FROM lsbd._src_denhyg r;

CREATE VIEW lsbd._src_license WITH (security_invoker = true) AS
SELECT r."Key" AS legacy_key,
       COALESCE(NULLIF(r."LICENSEID", ''), 'unknown-' || r."Key") AS license_id,
       p.id AS person_id,
       CASE WHEN btrim(r."Type") IN ('D', 'H', 'E', 'O')
            THEN btrim(r."Type")::lsbd.license_type END AS type,
       CASE WHEN btrim(r."Class") IN ('L', 'A', 'I', 'P', 'T', 'O', 'C', 'V', 'NL')
            THEN btrim(r."Class")::lsbd.license_class END AS class,
       CASE WHEN btrim(r."STATUS") IN ('ACT', 'SUS', 'REV', 'REP', 'ARC', 'PRB', 'DEC', 'EXP', 'OTH', 'TMP', 'INA', 'RET', 'VOL')
            THEN btrim(r."STATUS")::lsbd.license_status END AS status,
       (r."DateSince"     AT TIME ZONE 'America/Chicago') AS date_since,
       (r."DateInactive"  AT TIME ZONE 'America/Chicago') AS date_inactive,
       (r."DateReinstate" AT TIME ZONE 'America/Chicago') AS date_reinstate,
       (r."DateRenew"     AT TIME ZONE 'America/Chicago') AS date_renew,
       (r."DateUntil"     AT TIME ZONE 'America/Chicago') AS date_until,
       NULLIF(r."RegYear", '')         AS reg_year,
       NULLIF(r."RenewMnth", '')       AS renew_month,
       NULLIF(r."PANO", '')            AS pa_number,
       NULLIF(r."PLLCNO", '')          AS pllc_number,
       NULLIF(r."PERMITNO", '')        AS permit_number,
       NULLIF(r."ProcessingGroup", '') AS processing_group,
       COALESCE(r."IsCurrent", true)   AS is_current,
       NULLIF(r."Audit", '')           AS audit,
       NULLIF(r."Action", '')          AS action,
       NULLIF(r."AuditYear", '')       AS audit_year,
       NULLIF(r."Credential_Exam", '') AS credential_exam
  FROM lsbd._src_denhyg r
  JOIN lsbd.person p ON p.legacy_key = r."Key";

CREATE VIEW lsbd._src_licensee_pii WITH (security_invoker = true) AS
SELECT p.id AS person_id,
       NULLIF(r."SSN", '') AS ssn_hash,
       (r."DOB" AT TIME ZONE 'America/Chicago') AS dob,
       lsbd._s(r."SEX")  AS sex,
       lsbd._s(r."RACE") AS race,
       COALESCE(r."BACKGROUND", false) AS background
  FROM lsbd._src_denhyg r
  JOIN lsbd.person p ON p.legacy_key = r."Key";

CREATE VIEW lsbd._src_person_address WITH (security_invoker = true) AS
SELECT person_id, address_type, line1, line2, line3, city, state, zip, county, country, legacy_addr_type
  FROM (
  SELECT p.id AS person_id, 'home'::lsbd.address_type AS address_type,
         NULLIF(r."Address1", '') AS line1, NULLIF(r."Address2", '') AS line2, NULLIF(r."Address3", '') AS line3,
         NULLIF(r."CITY", '') AS city, NULLIF(r."STATE", '') AS state, NULLIF(r."ZIP", '') AS zip,
         NULLIF(r."COUNTY", '') AS county, NULLIF(r."Country", '') AS country,
         NULLIF(r."AddrType", '') AS legacy_addr_type
    FROM lsbd._src_denhyg r JOIN lsbd.person p ON p.legacy_key = r."Key"
  UNION ALL
  SELECT p.id, 'office'::lsbd.address_type,
         NULLIF(r."AddressO1", ''), NULLIF(r."AddressO2", ''), NULL,
         NULLIF(r."CITYO", ''), NULLIF(r."STATEO", ''), NULLIF(r."ZIPO", ''),
         NULLIF(r."COUNTYO", ''), NULL,
         NULLIF(r."OAddrType", '')
    FROM lsbd._src_denhyg r JOIN lsbd.person p ON p.legacy_key = r."Key"
  UNION ALL
  SELECT p.id, 'permanent'::lsbd.address_type,
         NULLIF(r."AddressP1", ''), NULLIF(r."AddressP2", ''), NULL,
         NULLIF(r."CITYP", ''), NULLIF(r."STATEP", ''), NULLIF(r."ZIPP", ''),
         NULLIF(r."COUNTYP", ''), NULL,
         NULL
    FROM lsbd._src_denhyg r JOIN lsbd.person p ON p.legacy_key = r."Key") b
 WHERE num_nonnulls(lsbd._s(line1), lsbd._s(line2), lsbd._s(line3), lsbd._s(city), lsbd._s(state),
                    lsbd._s(zip), lsbd._s(county), lsbd._s(country)) > 0;

CREATE VIEW lsbd._src_person_education WITH (security_invoker = true) AS
SELECT p.id AS person_id,
       NULLIF(r."SCHNAME", '')  AS school_name,
       NULLIF(r."SCHSTATE", '') AS school_state,
       r."GRADYEAR" AS grad_year,
       r."DEGREE"   AS degree
  FROM lsbd._src_denhyg r
  JOIN lsbd.person p ON p.legacy_key = r."Key";

CREATE VIEW lsbd._src_person_practice_stats WITH (security_invoker = true) AS
SELECT p.id AS person_id,
       r."HRSWK"     AS hours_worked,
       r."PATIENTCR" AS patients_per_week,
       r."NUMDENT"   AS num_dentists,
       r."NUMHYGEN"  AS num_hygienists,
       r."NUMDA1"    AS num_da1,
       r."NUMDA2"    AS num_da2,
       NULLIF(r."SATCITY1", '') AS satellite_city1,
       NULLIF(r."SATCITY2", '') AS satellite_city2,
       r."CEHrs"     AS ce_hours,
       NULLIF(r."USEANES", '')  AS use_anesthesia,
       NULLIF(r."USESEDAT", '') AS use_sedation,
       COALESCE(r."CSNone", false)       AS cs_none,
       COALESCE(r."CSDispense", false)   AS cs_dispense,
       COALESCE(r."CSAdminister", false) AS cs_administer,
       NULLIF(r."CPR", '')          AS cpr,
       NULLIF(r."CENOTREQ", '')     AS ce_not_required,
       NULLIF(r."COMPLAINT", '')    AS complaint_flag,
       NULLIF(r."LimitedSupDH", '') AS limited_sup_dh,
       NULLIF(r."FORMEMPL", '')     AS formerly_employed,
       NULLIF(r."PRINSET", '')      AS principal_setting,
       NULLIF(r."DEANO", '')        AS dea_number,
       NULLIF(r."Notes", '')        AS notes,
       NULLIF(r."SPECIALTY", '')    AS specialty,
       NULLIF(r."Location", '')     AS location
  FROM lsbd._src_denhyg r
  JOIN lsbd.person p ON p.legacy_key = r."Key";

CREATE VIEW lsbd._src_person_meta WITH (security_invoker = true) AS
SELECT p.id AS person_id,
       NULLIF(r."UpdatedBy", '') AS updated_by,
       (r."Updated"     AT TIME ZONE 'America/Chicago') AS updated_at,
       (r."DateUpdated" AT TIME ZONE 'America/Chicago') AS date_updated,
       NULLIF(r."INACTIVE", '') AS inactive_reason,
       COALESCE(r."INACTIVE2", false) AS inactive2,
       r."IndividualID"  AS individual_uuid,
       r."IndividualID_" AS individual_legacy_id,
       r."ID"            AS legacy_id
  FROM lsbd._src_denhyg r
  JOIN lsbd.person p ON p.legacy_key = r."Key";

CREATE OR REPLACE FUNCTION lsbd.transform_denhyg_pii(phase text DEFAULT 'all')
RETURNS integer
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  o integer := 0;
  unlinked bigint;
BEGIN
  IF phase NOT IN ('all', 'delete', 'upsert') THEN
    RAISE EXCEPTION 'transform_denhyg_pii: unknown phase %', phase;
  END IF;

  IF phase IN ('all', 'delete') THEN
    -- license references person without ON DELETE CASCADE: it goes first.
    PERFORM lsbd._delete('lsbd.license',               'lsbd._src_license',               '{legacy_key}');
    PERFORM lsbd._delete('lsbd.licensee_pii',          'lsbd._src_licensee_pii',          '{person_id}');
    PERFORM lsbd._delete('lsbd.person_address',        'lsbd._src_person_address',        '{person_id,address_type}');
    PERFORM lsbd._delete('lsbd.person_education',      'lsbd._src_person_education',      '{person_id}');
    PERFORM lsbd._delete('lsbd.person_practice_stats', 'lsbd._src_person_practice_stats', '{person_id}');
    PERFORM lsbd._delete('lsbd.person_meta',           'lsbd._src_person_meta',           '{person_id}');
    PERFORM lsbd._delete('lsbd.person',                'lsbd._src_person',                '{legacy_key}');
  END IF;

  IF phase IN ('all', 'upsert') THEN
    -- Orphans are counted once, on person (every child follows its person).
    o := o + lsbd._upsert('lsbd.person',                'lsbd._src_person',                '{legacy_key}', 'tblDenHyg');
    o := o + lsbd._upsert('lsbd.license',               'lsbd._src_license',               '{legacy_key}');
    o := o + lsbd._upsert('lsbd.licensee_pii',          'lsbd._src_licensee_pii',          '{person_id}');
    o := o + lsbd._upsert('lsbd.person_address',        'lsbd._src_person_address',        '{person_id,address_type}');
    o := o + lsbd._upsert('lsbd.person_education',      'lsbd._src_person_education',      '{person_id}');
    o := o + lsbd._upsert('lsbd.person_practice_stats', 'lsbd._src_person_practice_stats', '{person_id}');
    o := o + lsbd._upsert('lsbd.person_meta',           'lsbd._src_person_meta',           '{person_id}');

    -- Unlinked: IndividualID_ set but no eligible Individual. Informational
    -- only (not orphans): the person/license rows exist with individual_id NULL.
    SELECT count(*) INTO unlinked
      FROM lsbd._src_denhyg r
     WHERE r."IndividualID_" IS NOT NULL AND r._individual_id IS NULL;
    IF unlinked > 0 THEN
      RAISE NOTICE 'transform lsbd.person: % tblDenHyg rows unlinked (IndividualID_ has no eligible Individual; individual_id NULL)', unlinked;
    END IF;
  END IF;
  RETURN o;
END;
$$;

-- Individual / IndividualStatus: person.individual_id (a lookup only, never
-- eligibility) depends on them via lsbd._src_individual.
INSERT INTO lsbd._transform_registry (domain, fn, sort_order, source_tables)
VALUES ('denhyg_pii', 'lsbd.transform_denhyg_pii'::regproc, 40, ARRAY['tblDenHyg', 'Individual', 'IndividualStatus'])
ON CONFLICT (domain) DO UPDATE
  SET fn = EXCLUDED.fn, sort_order = EXCLUDED.sort_order, source_tables = EXCLUDED.source_tables;

SELECT lsbd._lockdown();
