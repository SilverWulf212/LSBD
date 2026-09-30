-- supabase/transforms/50_relationships.sql
--
-- Domain "relationships" (Task 14): address, address_history, individual_affiliation,
-- office_affiliation, office_aff_history, association_history, professional_llc,
-- professional_association. Ported from scripts/etl-b3.ts (the B-3 relationship group);
-- professional_association (tblPAs, 0 rows today) had no May mapper and mirrors
-- professional_llc. vs_auth / vs_capture stay empty: their sources are EXCLUDED from sync.
--
-- Value rules (as in Task 11): strOrNull -> lsbd._s(x); ints / booleans / uuids pass
-- through; every timestamptz target is (<col> AT TIME ZONE 'America/Chicago').
-- Keys (0003 KEY MAP): id = the source int PK, inserted explicitly (run_transforms bumps
-- the sequences): address (Address_ID), address_history (ID), individual_affiliation
-- (IndividualAffiliation_ID), office_affiliation (OfficeAffiliation_ID), office_aff_history
-- (ID), association_history (ID), professional_llc (tblPLLCs.Key), professional_association
-- (tblPAs.Key).
--
-- References
--   gate (brief, test (a)): office_affiliation.office_id (OFFICE_ID) -> office (id = OFFICE_ID).
--     A non-NULL OFFICE_ID with no live Office row is an orphan: skipped + counted, never
--     inserted. (1,926 of 4,088 live rows point at OFFICE_IDs 4180..6730, above the highest
--     Office row: see the Task 14 report.)
--   lookup, not gate (controller carry 1): the row is always loaded, an unresolved reference
--     is NULL and counted 'unlinked' in lsbd._transform_quality:
--       individual_affiliation.dentist_id / individual_id (uuid, DB FK -> individual):
--         DentistID / IndividualID resolved through lsbd._src_individual; _unlink() NULLs a
--         reference whose Individual is gone BEFORE entities deletes it (NO ACTION FK).
--       address.city_id / state_id / country_id / parish_id / address_type_id (no DB FK):
--         source uuid -> the parent's _src_ view (legacy_uid -> legacy_id, lowest legacy_id
--         per uuid) -> lsbd.<parent>.id by JOIN ON legacy_id (the serial id is generated;
--         never assumed equal to the source PK, controller carry 2).
--   verbatim, no DB FK (as the May ETL): address.individual_id / office_id,
--     individual_affiliation.dentist_legacy_id / individual_legacy_id (these are
--     tblDenHyg.Key values in the source), office_affiliation.dentist_id (DENTIST_ID,
--     also a tblDenHyg.Key), office_aff_history.office_id, professional_llc.office_id.

DROP VIEW IF EXISTS lsbd._src_address, lsbd._src_address_history, lsbd._src_individual_affiliation,
  lsbd._src_office_affiliation, lsbd._src_office_aff_history, lsbd._src_association_history,
  lsbd._src_professional_llc, lsbd._src_professional_association CASCADE;

CREATE VIEW lsbd._src_address WITH (security_invoker = true) AS
SELECT r."Address_ID"            AS id,
       r."AddressID"             AS legacy_uid,
       r."LinkID"                AS link_uid,
       lsbd._s(r."Address1")     AS address_1,
       lsbd._s(r."Address2")     AS address_2,
       lsbd._s(r."Address3")     AS address_3,
       ci.id                     AS city_id,
       st.id                     AS state_id,
       lsbd._s(r."PostalCode")   AS postal_code,
       co.id                     AS country_id,
       aty.id                    AS address_type_id,
       pa.id                     AS parish_id,
       r."IsCurrent"             AS is_current,
       r."Mailing"               AS mailing,
       (r."Updated" AT TIME ZONE 'America/Chicago') AS updated,
       r."Home"                  AS home,
       r."FLG_DUP"               AS flg_dup,
       lsbd._s(r."CITY")         AS city_text,
       lsbd._s(r."STATE")        AS state_text,
       lsbd._s(r."COUNTRY")      AS country_text,
       r."Individual_ID"         AS individual_id,
       r."Office_ID"             AS office_id
  FROM lsbd_raw."ADDRESS" r
  LEFT JOIN (SELECT DISTINCT ON (legacy_uid) legacy_uid, legacy_id FROM lsbd._src_cities
              WHERE legacy_uid IS NOT NULL ORDER BY legacy_uid, legacy_id::int) sci ON sci.legacy_uid = r."CityID"
  LEFT JOIN lsbd.cities ci ON ci.legacy_id = sci.legacy_id
  LEFT JOIN (SELECT DISTINCT ON (legacy_uid) legacy_uid, legacy_id FROM lsbd._src_states
              WHERE legacy_uid IS NOT NULL ORDER BY legacy_uid, legacy_id::int) sst ON sst.legacy_uid = r."StateID"
  LEFT JOIN lsbd.states st ON st.legacy_id = sst.legacy_id
  LEFT JOIN (SELECT DISTINCT ON (legacy_uid) legacy_uid, legacy_id FROM lsbd._src_countries
              WHERE legacy_uid IS NOT NULL ORDER BY legacy_uid, legacy_id::int) sco ON sco.legacy_uid = r."CountryID"
  LEFT JOIN lsbd.countries co ON co.legacy_id = sco.legacy_id
  LEFT JOIN (SELECT DISTINCT ON (legacy_uid) legacy_uid, legacy_id FROM lsbd._src_address_type_lookup
              WHERE legacy_uid IS NOT NULL ORDER BY legacy_uid, legacy_id::int) saty ON saty.legacy_uid = r."AddressTypeID"
  LEFT JOIN lsbd.address_type_lookup aty ON aty.legacy_id = saty.legacy_id
  LEFT JOIN (SELECT DISTINCT ON (legacy_uid) legacy_uid, legacy_id FROM lsbd._src_parishes
              WHERE legacy_uid IS NOT NULL ORDER BY legacy_uid, legacy_id::int) spa ON spa.legacy_uid = r."ParishID"
  LEFT JOIN lsbd.parishes pa ON pa.legacy_id = spa.legacy_id
 WHERE r._deleted_at IS NULL AND r."Address_ID" IS NOT NULL;

CREATE VIEW lsbd._src_address_history WITH (security_invoker = true) AS
SELECT r."ID"                    AS id,
       lsbd._s(r."LICENSEID")    AS license_id,
       lsbd._s(r."Type")         AS type,
       lsbd._s(r."FIRSTName")    AS first_name,
       lsbd._s(r."MIDDLE")       AS middle,
       lsbd._s(r."LASTName")     AS last_name,
       lsbd._s(r."Address1")     AS address_1,
       lsbd._s(r."Address2")     AS address_2,
       lsbd._s(r."CITY")         AS city,
       lsbd._s(r."STATE")        AS state,
       lsbd._s(r."ZIP")          AS zip,
       lsbd._s(r."COUNTY")       AS county,
       lsbd._s(r."Email")        AS email,
       lsbd._s(r."AddressO1")    AS address_o_1,
       lsbd._s(r."AddressO2")    AS address_o_2,
       lsbd._s(r."CITYO")        AS city_o,
       lsbd._s(r."STATEO")       AS state_o,
       lsbd._s(r."ZIPO")         AS zip_o,
       lsbd._s(r."COUNTYO")      AS county_o,
       (r."Updated" AT TIME ZONE 'America/Chicago') AS updated,
       lsbd._s(r."UpdatedBy")    AS updated_by,
       lsbd._s(r."OPT_IN")       AS opt_in,
       lsbd._s(r."DEANO")        AS deano
  FROM lsbd_raw."AddressHistory" r
 WHERE r._deleted_at IS NULL AND r."ID" IS NOT NULL;

CREATE VIEW lsbd._src_individual_affiliation WITH (security_invoker = true) AS
SELECT r."IndividualAffiliation_ID" AS id,
       r."IndividualAffiliationID"  AS individual_affiliation_uuid,
       d.individual_id              AS dentist_id,
       i.individual_id              AS individual_id,
       r."DENTID"                   AS dentist_legacy_id,
       r."INDVID"                   AS individual_legacy_id,
       r."IndividualAffiliation_ID" AS legacy_id
  FROM lsbd_raw."IndividualAffiliation" r
  LEFT JOIN lsbd._src_individual d ON d.individual_id = r."DentistID"
  LEFT JOIN lsbd._src_individual i ON i.individual_id = r."IndividualID"
 WHERE r._deleted_at IS NULL AND r."IndividualAffiliation_ID" IS NOT NULL;

-- Gate: OFFICE_ID must be NULL or a live Office row.
CREATE VIEW lsbd._src_office_affiliation WITH (security_invoker = true) AS
SELECT r."OfficeAffiliation_ID"  AS id,
       r."OfficeAffiliationID"   AS legacy_uid,
       r."DentistID"             AS dentist_uid,
       r."OfficeID"              AS office_uid,
       r."OfficePermit"          AS office_permit,
       r."DENTIST_ID"            AS dentist_id,
       r."OFFICE_ID"             AS office_id
  FROM lsbd_raw."OfficeAffiliation" r
  LEFT JOIN lsbd._src_office o ON o.id = r."OFFICE_ID"
 WHERE r._deleted_at IS NULL AND r."OfficeAffiliation_ID" IS NOT NULL
   AND (r."OFFICE_ID" IS NULL OR o.id IS NOT NULL);

CREATE VIEW lsbd._src_office_aff_history WITH (security_invoker = true) AS
SELECT r."ID"                     AS id,
       lsbd._s(r."LicenseID")     AS license_id,
       lsbd._s(r."LicenseType")   AS license_type,
       r."OfficeID"               AS office_id,
       lsbd._s(r."OperationType") AS operation_type,
       (r."Updated" AT TIME ZONE 'America/Chicago') AS updated,
       lsbd._s(r."UpdatedBy")     AS updated_by
  FROM lsbd_raw."OfficeAffHistory" r
 WHERE r._deleted_at IS NULL AND r."ID" IS NOT NULL;

CREATE VIEW lsbd._src_association_history WITH (security_invoker = true) AS
SELECT r."ID"                             AS id,
       lsbd._s(r."LicenseID")             AS license_id,
       lsbd._s(r."LicenseType")           AS license_type,
       lsbd._s(r."AssociatedLicenseID")   AS associated_license_id,
       lsbd._s(r."AssociatedLicenseType") AS associated_license_type,
       lsbd._s(r."OperationType")         AS operation_type,
       (r."Updated" AT TIME ZONE 'America/Chicago') AS updated_at,
       lsbd._s(r."UpdatedBy")             AS updated_by
  FROM lsbd_raw."AssociationHistory" r
 WHERE r._deleted_at IS NULL AND r."ID" IS NOT NULL;

CREATE VIEW lsbd._src_professional_llc WITH (security_invoker = true) AS
SELECT r."Key"                   AS id,
       lsbd._s(r."LICENSEID")    AS license_id,
       lsbd._s(r."ESTNAME")      AS est_name,
       lsbd._s(r."STATUS")       AS status,
       (r."DateSince"   AT TIME ZONE 'America/Chicago') AS date_since,
       (r."DateUpdated" AT TIME ZONE 'America/Chicago') AS date_updated,
       (r."DateRenew"   AT TIME ZONE 'America/Chicago') AS date_renew,
       (r."DateUntil"   AT TIME ZONE 'America/Chicago') AS date_until,
       lsbd._s(r."RenewMnth")    AS renew_month,
       lsbd._s(r."RegYear")      AS reg_year,
       lsbd._s(r."ADDR_NAME1")   AS addr_name1,
       lsbd._s(r."ADDR_NAME2")   AS addr_name2,
       lsbd._s(r."SORT1")        AS sort1,
       lsbd._s(r."SORT2")        AS sort2,
       lsbd._s(r."COMMENT1")     AS comment1,
       lsbd._s(r."COMMENT2")     AS comment2,
       lsbd._s(r."COMMENT3")     AS comment3,
       lsbd._s(r."ADDRESS1")     AS address1,
       lsbd._s(r."ADDRESS2")     AS address2,
       lsbd._s(r."ADDRESS3")     AS address3,
       lsbd._s(r."CITY")         AS city,
       lsbd._s(r."STATE")        AS state,
       lsbd._s(r."ZIP")          AS zip,
       lsbd._s(r."COUNTY")       AS county,
       lsbd._s(r."Phone1")       AS phone1,
       lsbd._s(r."Ext1")         AS ext1,
       lsbd._s(r."Phone2")       AS phone2,
       lsbd._s(r."Ext2")         AS ext2,
       lsbd._s(r."Fax")          AS fax,
       lsbd._s(r."Notes")        AS notes,
       lsbd._s(r."Location")     AS location,
       lsbd._s(r."Email")        AS email,
       lsbd._s(r."URL")          AS url,
       lsbd._s(r."Type")         AS type,
       r."Office_ID"             AS office_id,
       r."OldOfficeID"           AS old_office_id
  FROM lsbd_raw."tblPLLCs" r
 WHERE r._deleted_at IS NULL AND r."Key" IS NOT NULL;

-- tblPAs: 0 rows today; same shape as tblPLLCs minus ADDRESS3 / Office_ID / OldOfficeID.
CREATE VIEW lsbd._src_professional_association WITH (security_invoker = true) AS
SELECT r."Key"                   AS id,
       lsbd._s(r."LICENSEID")    AS license_id,
       lsbd._s(r."ESTNAME")      AS est_name,
       lsbd._s(r."STATUS")       AS status,
       (r."DateSince"   AT TIME ZONE 'America/Chicago') AS date_since,
       (r."DateUpdated" AT TIME ZONE 'America/Chicago') AS date_updated,
       (r."DateRenew"   AT TIME ZONE 'America/Chicago') AS date_renew,
       (r."DateUntil"   AT TIME ZONE 'America/Chicago') AS date_until,
       lsbd._s(r."RenewMnth")    AS renew_month,
       lsbd._s(r."RegYear")      AS reg_year,
       lsbd._s(r."ADDR_NAME1")   AS addr_name1,
       lsbd._s(r."ADDR_NAME2")   AS addr_name2,
       lsbd._s(r."SORT1")        AS sort1,
       lsbd._s(r."SORT2")        AS sort2,
       lsbd._s(r."COMMENT1")     AS comment1,
       lsbd._s(r."COMMENT2")     AS comment2,
       lsbd._s(r."COMMENT3")     AS comment3,
       lsbd._s(r."ADDRESS1")     AS address1,
       lsbd._s(r."ADDRESS2")     AS address2,
       lsbd._s(r."CITY")         AS city,
       lsbd._s(r."STATE")        AS state,
       lsbd._s(r."ZIP")          AS zip,
       lsbd._s(r."COUNTY")       AS county,
       lsbd._s(r."Phone1")       AS phone1,
       lsbd._s(r."Ext1")         AS ext1,
       lsbd._s(r."Phone2")       AS phone2,
       lsbd._s(r."Ext2")         AS ext2,
       lsbd._s(r."Fax")          AS fax,
       lsbd._s(r."Notes")        AS notes,
       lsbd._s(r."Location")     AS location,
       lsbd._s(r."Email")        AS email,
       lsbd._s(r."URL")          AS url,
       lsbd._s(r."Type")         AS type
  FROM lsbd_raw."tblPAs" r
 WHERE r._deleted_at IS NULL AND r."Key" IS NOT NULL;

CREATE OR REPLACE FUNCTION lsbd.transform_relationships(phase text DEFAULT 'all')
RETURNS integer
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  o integer := 0;
BEGIN
  IF phase NOT IN ('all', 'delete', 'upsert') THEN
    RAISE EXCEPTION 'transform_relationships: unknown phase %', phase;
  END IF;

  IF phase IN ('all', 'delete') THEN
    PERFORM lsbd._delete('lsbd.address',                  'lsbd._src_address',                  '{id}');
    PERFORM lsbd._delete('lsbd.address_history',          'lsbd._src_address_history',          '{id}');
    PERFORM lsbd._delete('lsbd.individual_affiliation',   'lsbd._src_individual_affiliation',   '{id}');
    -- NO ACTION FKs to individual: unlink before entities deletes the Individual.
    PERFORM lsbd._unlink('lsbd.individual_affiliation', 'dentist_id',
      'SELECT 1 FROM lsbd._src_individual s WHERE s.individual_id = t.dentist_id');
    PERFORM lsbd._unlink('lsbd.individual_affiliation', 'individual_id',
      'SELECT 1 FROM lsbd._src_individual s WHERE s.individual_id = t.individual_id');
    PERFORM lsbd._delete('lsbd.office_affiliation',       'lsbd._src_office_affiliation',       '{id}');
    PERFORM lsbd._delete('lsbd.office_aff_history',       'lsbd._src_office_aff_history',       '{id}');
    PERFORM lsbd._delete('lsbd.association_history',      'lsbd._src_association_history',      '{id}');
    PERFORM lsbd._delete('lsbd.professional_llc',         'lsbd._src_professional_llc',         '{id}');
    PERFORM lsbd._delete('lsbd.professional_association', 'lsbd._src_professional_association', '{id}');
  END IF;

  IF phase IN ('all', 'upsert') THEN
    o := o + lsbd._upsert('lsbd.address',                  'lsbd._src_address',                  '{id}', 'ADDRESS');
    o := o + lsbd._upsert('lsbd.address_history',          'lsbd._src_address_history',          '{id}', 'AddressHistory');
    o := o + lsbd._upsert('lsbd.individual_affiliation',   'lsbd._src_individual_affiliation',   '{id}', 'IndividualAffiliation');
    o := o + lsbd._upsert('lsbd.office_affiliation',       'lsbd._src_office_affiliation',       '{id}', 'OfficeAffiliation');
    o := o + lsbd._upsert('lsbd.office_aff_history',       'lsbd._src_office_aff_history',       '{id}', 'OfficeAffHistory');
    o := o + lsbd._upsert('lsbd.association_history',      'lsbd._src_association_history',      '{id}', 'AssociationHistory');
    o := o + lsbd._upsert('lsbd.professional_llc',         'lsbd._src_professional_llc',         '{id}', 'tblPLLCs');
    o := o + lsbd._upsert('lsbd.professional_association', 'lsbd._src_professional_association', '{id}', 'tblPAs');

    PERFORM lsbd._count_unlinked('lsbd.address', 'city_id -> cities', 'ADDRESS', 'r."Address_ID" = t.id', 'r."CityID"', 'city_id');
    PERFORM lsbd._count_unlinked('lsbd.address', 'state_id -> states', 'ADDRESS', 'r."Address_ID" = t.id', 'r."StateID"', 'state_id');
    PERFORM lsbd._count_unlinked('lsbd.address', 'country_id -> countries', 'ADDRESS', 'r."Address_ID" = t.id', 'r."CountryID"', 'country_id');
    PERFORM lsbd._count_unlinked('lsbd.address', 'address_type_id -> address_type_lookup', 'ADDRESS', 'r."Address_ID" = t.id', 'r."AddressTypeID"', 'address_type_id');
    PERFORM lsbd._count_unlinked('lsbd.address', 'parish_id -> parishes', 'ADDRESS', 'r."Address_ID" = t.id', 'r."ParishID"', 'parish_id');
    PERFORM lsbd._count_unlinked('lsbd.individual_affiliation', 'dentist_id -> individual', 'IndividualAffiliation',
      'r."IndividualAffiliation_ID" = t.id', 'r."DentistID"', 'dentist_id');
    PERFORM lsbd._count_unlinked('lsbd.individual_affiliation', 'individual_id -> individual', 'IndividualAffiliation',
      'r."IndividualAffiliation_ID" = t.id', 'r."IndividualID"', 'individual_id');
  END IF;
  RETURN o;
END;
$$;

INSERT INTO lsbd._transform_registry (domain, fn, sort_order, source_tables)
VALUES ('relationships', 'lsbd.transform_relationships'::regproc, 50, ARRAY[
  -- own sources
  'ADDRESS', 'AddressHistory', 'IndividualAffiliation', 'OfficeAffiliation', 'OfficeAffHistory',
  'AssociationHistory', 'tblPLLCs', 'tblPAs',
  -- parents (a change re-runs this domain: re-link / unlink / re-gate)
  'Individual', 'Office', 'Cities', 'States', 'Countries', 'AddressType', 'Parishes'])
ON CONFLICT (domain) DO UPDATE
  SET fn = EXCLUDED.fn, sort_order = EXCLUDED.sort_order, source_tables = EXCLUDED.source_tables;

SELECT lsbd._lockdown();
