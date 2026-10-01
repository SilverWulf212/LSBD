-- supabase/transforms/20_geography.sql
--
-- Domain "geography": countries, states, parishes, cities, zipcodes,
-- election_districts (ported from scripts/etl-b1a-geography.ts) plus
-- tbl_counties (no May mapper; mapped 1:1 from tblCounties, see the Task 11
-- report). Keys: legacy_id = source int PK as text; the serial id is generated.
--
-- election_districts.parish_id: the source row carries only the parish uuid
-- (ParishID), no int Parish_ID, so it resolves through parishes.legacy_uid to
-- the GENERATED lsbd.parishes.id (never assumed equal to the source PK).
-- "Lookup, not gate" (R33, review M5; same rule as R26/R30): a non-NULL ParishID
-- with no live parish loads with parish_id NULL and is counted 'unlinked' in
-- lsbd._transform_quality; the row is never dropped. parish_id has no DB FK, so
-- no _unlink step is needed before a parish delete.

DROP VIEW IF EXISTS lsbd._src_countries, lsbd._src_states, lsbd._src_parishes, lsbd._src_cities,
  lsbd._src_zipcodes, lsbd._src_election_districts, lsbd._src_tbl_counties CASCADE;

CREATE VIEW lsbd._src_countries WITH (security_invoker = true) AS
SELECT r."Country_ID"::text AS legacy_id,
       r."CountryID" AS legacy_uid,
       COALESCE(lsbd._s(r."Country"), '') AS country
  FROM lsbd_raw."Countries" r
 WHERE r._deleted_at IS NULL AND r."Country_ID" IS NOT NULL;

CREATE VIEW lsbd._src_states WITH (security_invoker = true) AS
SELECT r."State_ID"::text AS legacy_id,
       r."StateID" AS legacy_uid,
       COALESCE(lsbd._s(r."State"), '') AS state
  FROM lsbd_raw."States" r
 WHERE r._deleted_at IS NULL AND r."State_ID" IS NOT NULL;

CREATE VIEW lsbd._src_parishes WITH (security_invoker = true) AS
SELECT r."Parish_ID"::text AS legacy_id,
       r."ParishID" AS legacy_uid,
       COALESCE(lsbd._s(r."Parish"), '') AS parish
  FROM lsbd_raw."Parishes" r
 WHERE r._deleted_at IS NULL AND r."Parish_ID" IS NOT NULL;

CREATE VIEW lsbd._src_cities WITH (security_invoker = true) AS
SELECT r."City_ID"::text AS legacy_id,
       r."CityID" AS legacy_uid,
       COALESCE(lsbd._s(r."City"), '') AS city
  FROM lsbd_raw."Cities" r
 WHERE r._deleted_at IS NULL AND r."City_ID" IS NOT NULL;

CREATE VIEW lsbd._src_zipcodes WITH (security_invoker = true) AS
SELECT r."ID"::text AS legacy_id,
       lsbd._s(r."City")       AS city,
       lsbd._s(r."State")      AS state,
       lsbd._s(r."zip")        AS zip,
       lsbd._s(r."Area Code")  AS area_code,
       lsbd._s(r."County")     AS county,
       lsbd._s(r."State Code") AS state_code,
       lsbd._s(r."Time Zone")  AS time_zone,
       lsbd._s(r."Longitude")  AS longitude,
       lsbd._s(r."Latitude")   AS latitude
  FROM lsbd_raw."Zipcodes" r
 WHERE r._deleted_at IS NULL AND r."ID" IS NOT NULL;

CREATE VIEW lsbd._src_election_districts WITH (security_invoker = true) AS
SELECT r."ElectionDistrict_ID"::text AS legacy_id,
       r."ElectionDistrictID" AS legacy_uid,
       lsbd._s(r."ZipCode") AS zip_code,
       p.id AS parish_id,
       r."District" AS district,
       lsbd._s(r."PARISH") AS parish_name
  FROM lsbd_raw."ElectionDistricts" r
  LEFT JOIN (SELECT legacy_uid, min(id) AS id FROM lsbd.parishes GROUP BY legacy_uid) p ON p.legacy_uid = r."ParishID"
 WHERE r._deleted_at IS NULL AND r."ElectionDistrict_ID" IS NOT NULL;

CREATE VIEW lsbd._src_tbl_counties WITH (security_invoker = true) AS
SELECT r."ID"::text AS legacy_id,
       lsbd._s(r."County")     AS county,
       lsbd._s(r."CountyName") AS county_name
  FROM lsbd_raw."tblCounties" r
 WHERE r._deleted_at IS NULL AND r."ID" IS NOT NULL;

CREATE OR REPLACE FUNCTION lsbd.transform_geography(phase text DEFAULT 'all')
RETURNS integer
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  o integer := 0;
BEGIN
  IF phase NOT IN ('all', 'delete', 'upsert') THEN
    RAISE EXCEPTION 'transform_geography: unknown phase %', phase;
  END IF;

  IF phase IN ('all', 'delete') THEN
    PERFORM lsbd._delete('lsbd.election_districts', 'lsbd._src_election_districts', '{legacy_id}');
    PERFORM lsbd._delete('lsbd.zipcodes',           'lsbd._src_zipcodes',           '{legacy_id}');
    PERFORM lsbd._delete('lsbd.cities',             'lsbd._src_cities',             '{legacy_id}');
    PERFORM lsbd._delete('lsbd.parishes',           'lsbd._src_parishes',           '{legacy_id}');
    PERFORM lsbd._delete('lsbd.states',             'lsbd._src_states',             '{legacy_id}');
    PERFORM lsbd._delete('lsbd.countries',          'lsbd._src_countries',          '{legacy_id}');
    PERFORM lsbd._delete('lsbd.tbl_counties',       'lsbd._src_tbl_counties',       '{legacy_id}');
  END IF;

  IF phase IN ('all', 'upsert') THEN
    o := o + lsbd._upsert('lsbd.countries',          'lsbd._src_countries',          '{legacy_id}', 'Countries');
    o := o + lsbd._upsert('lsbd.states',             'lsbd._src_states',             '{legacy_id}', 'States');
    o := o + lsbd._upsert('lsbd.parishes',           'lsbd._src_parishes',           '{legacy_id}', 'Parishes');
    o := o + lsbd._upsert('lsbd.cities',             'lsbd._src_cities',             '{legacy_id}', 'Cities');
    o := o + lsbd._upsert('lsbd.zipcodes',           'lsbd._src_zipcodes',           '{legacy_id}', 'Zipcodes');
    o := o + lsbd._upsert('lsbd.election_districts', 'lsbd._src_election_districts', '{legacy_id}', 'ElectionDistricts');
    o := o + lsbd._upsert('lsbd.tbl_counties',       'lsbd._src_tbl_counties',       '{legacy_id}', 'tblCounties');

    PERFORM lsbd._count_unlinked('lsbd.election_districts', 'parish_id -> parishes', 'ElectionDistricts',
      'r."ElectionDistrict_ID"::text = t.legacy_id', 'r."ParishID"', 'parish_id');
  END IF;
  RETURN o;
END;
$$;

INSERT INTO lsbd._transform_registry (domain, fn, sort_order, source_tables)
VALUES ('geography', 'lsbd.transform_geography'::regproc, 20, ARRAY[
  'Countries', 'States', 'Parishes', 'Cities', 'Zipcodes', 'ElectionDistricts', 'tblCounties'])
ON CONFLICT (domain) DO UPDATE
  SET fn = EXCLUDED.fn, sort_order = EXCLUDED.sort_order, source_tables = EXCLUDED.source_tables;

SELECT lsbd._lockdown();
