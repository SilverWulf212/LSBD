-- 0006_db_roles.sql
--
-- Hand-written, like 0005 (not in the Drizzle journal). Apply with:
--   npx tsx scripts/apply-sql.ts drizzle/0006_db_roles.sql
--
-- Why: the site connects as postgres, which bypasses RLS and can read and write
-- everything (licensee PII, payments, the raw mirror). This file defines the two
-- least-privilege roles the site will connect as instead:
--
--   lsbd_app       the CMS tables in public, the public licensee view, and the two
--                  sync status tables. Nothing in schema lsbd.
--   lsbd_staff_ro  read-only on an explicit list of lsbd tables. Never PII, payments,
--                  renewals, complaints or the legacy user/login tables.
--
-- Neither role can be created with BYPASSRLS here, so each gets explicit policies.
-- Both are NOLOGIN with no password: the user sets LOGIN and a password out of band
-- (docs/RUNBOOK-DB-ROLES.md), never in a file.
--
-- Idempotent, and it only changes what the two new roles can do, so it is safe to
-- apply at any time and to re-apply (re-apply after adding a table to public). Runs
-- in one transaction (the runner wraps it). No ALTER DEFAULT PRIVILEGES: a new table
-- is invisible to both roles until it is granted here.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lsbd_app') THEN
    CREATE ROLE lsbd_app NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lsbd_staff_ro') THEN
    CREATE ROLE lsbd_staff_ro NOLOGIN;
  END IF;
END $$;

ALTER ROLE lsbd_app SET statement_timeout = '30s';
ALTER ROLE lsbd_staff_ro SET statement_timeout = '30s';

-- So scripts/verify-rls.ts (connected as postgres) can SET ROLE to each.
GRANT lsbd_app, lsbd_staff_ro TO postgres;

-- ─────────────────────────────────────────────────────────────────────────
-- lsbd_app: CMS tables in public
-- ─────────────────────────────────────────────────────────────────────────
GRANT USAGE ON SCHEMA public TO lsbd_app;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    IF r.tablename = 'audit_log' THEN
      -- Append-only for the app: no UPDATE, no DELETE.
      EXECUTE 'REVOKE ALL ON TABLE public.audit_log FROM lsbd_app';
      EXECUTE 'GRANT SELECT, INSERT ON TABLE public.audit_log TO lsbd_app';
    ELSE
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO lsbd_app', r.tablename);
    END IF;
    -- RLS is on after 0005; the grants above decide what the role may do.
    EXECUTE format('DROP POLICY IF EXISTS lsbd_app_all ON public.%I', r.tablename);
    EXECUTE format(
      'CREATE POLICY lsbd_app_all ON public.%I FOR ALL TO lsbd_app USING (true) WITH CHECK (true)',
      r.tablename);
  END LOOP;
END $$;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO lsbd_app;

-- The public verify / directory surface. Readable through the owner-rights view
-- only once 0007 is applied (until then the view runs with the caller's rights and
-- lsbd_app has none on schema lsbd).
GRANT SELECT ON public.public_licensee TO lsbd_app;

-- Sync status for the admin dashboard.
GRANT USAGE ON SCHEMA lsbd_raw TO lsbd_app;
GRANT SELECT ON lsbd_raw._sync_runs, lsbd_raw._sync_tables TO lsbd_app;

DROP POLICY IF EXISTS lsbd_app_select ON lsbd_raw._sync_runs;
CREATE POLICY lsbd_app_select ON lsbd_raw._sync_runs
  FOR SELECT TO lsbd_app USING (true);

DROP POLICY IF EXISTS lsbd_app_select ON lsbd_raw._sync_tables;
CREATE POLICY lsbd_app_select ON lsbd_raw._sync_tables
  FOR SELECT TO lsbd_app USING (true);

-- ─────────────────────────────────────────────────────────────────────────
-- lsbd_staff_ro: read-only on an explicit list of lsbd tables
-- ─────────────────────────────────────────────────────────────────────────
GRANT USAGE ON SCHEMA lsbd TO lsbd_staff_ro;

-- Start from nothing, so this file is the full definition of the role's access:
-- taking a table off the list below removes the grant on re-apply. (The role's
-- staff_ro_select policy on that table stays, and is inert without the grant.)
REVOKE ALL ON ALL TABLES IN SCHEMA lsbd FROM lsbd_staff_ro;

-- NEVER add to this list: licensee_pii, users, logins, person_practice_stats, any
-- transaction, renewal, complaint or vs_* table, any _src_* view or _transform_*
-- table. A missing table fails the whole file rather than being skipped.
-- scripts/lib/staff-ro-tables.ts holds the same list for the catalog check.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    -- people and licenses
    'person',
    'license',
    'person_address',
    'person_education',
    'person_meta',
    'individual_status',
    'professional',
    'individual_affiliation',
    -- offices
    'office',
    'office_affiliation',
    -- permits and entities
    'permits',
    'permit_type',
    'sed_level',
    'professional_llc',
    'professional_association',
    -- discipline (public record) and education
    'disciplinary',
    'education',
    'education_type',
    -- geography
    'countries',
    'states',
    'parishes',
    'tbl_counties',
    'cities',
    'zipcodes',
    'election_districts',
    -- code lookups
    'address_type_lookup',
    'tbl_types',
    'tbl_status',
    'tbl_class',
    'tbl_inactive_status',
    'tbl_specialties',
    'professional_type',
    'practice_type'
  ] LOOP
    EXECUTE format('GRANT SELECT ON TABLE lsbd.%I TO lsbd_staff_ro', t);
    EXECUTE format('DROP POLICY IF EXISTS staff_ro_select ON lsbd.%I', t);
    EXECUTE format('CREATE POLICY staff_ro_select ON lsbd.%I FOR SELECT TO lsbd_staff_ro USING (true)', t);
  END LOOP;
END $$;

-- lsbd.individual carries ssn, dob, sex and race (the same data as licensee_pii),
-- so it gets a column grant that leaves those four out instead of a table grant.
GRANT SELECT (
  individual_id, last_name, first_name, middle_name, married_name, license_name,
  suffix, prefix, use_license_name, email, web_site, processing_group, notes,
  updated_at, individual_status_uuid, legacy_id, status, indv_id
) ON lsbd.individual TO lsbd_staff_ro;

DROP POLICY IF EXISTS staff_ro_select ON lsbd.individual;
CREATE POLICY staff_ro_select ON lsbd.individual
  FOR SELECT TO lsbd_staff_ro USING (true);
