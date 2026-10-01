-- 0007_public_view_owner_rights.sql
--
-- Hand-written, like 0005 (not in the Drizzle journal). Apply with:
--   npx tsx scripts/apply-sql.ts drizzle/0007_public_view_owner_rights.sql
--
-- APPLY ONLY AFTER the server-side verify pages are deployed to every environment
-- that serves /verify. This file removes the anon path the old code used: after it,
-- the anon key can read nothing about licensees.
--
-- Why: 0002 exposed public.public_licensee to the anon key as a security_invoker
-- view, which needed anon to hold USAGE on schema lsbd, column grants on
-- lsbd.license and lsbd.person, and two anon policies. The site now reads the view
-- through its server connection, so the view becomes owner-rights (it runs with its
-- owner's access to the base tables) and anon loses everything in lsbd.
--
-- Also appends legacy_key (the source system's row key = license identity) as the
-- last view column. Idempotent. Runs in one transaction (the runner wraps it).

-- An owner-rights view reads the base tables as its owner. If the owner neither
-- bypasses RLS nor owns both tables, the view would silently return zero rows.
DO $$
DECLARE
  v_owner oid;
  ok boolean;
BEGIN
  SELECT c.relowner INTO v_owner
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'public_licensee' AND c.relkind = 'v';
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'view public.public_licensee does not exist';
  END IF;

  SELECT r.rolsuper OR r.rolbypassrls OR (
           SELECT count(*) = 2
           FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = 'lsbd' AND c.relname IN ('license', 'person')
             AND c.relowner = v_owner AND NOT c.relforcerowsecurity)
    INTO ok
  FROM pg_roles r WHERE r.oid = v_owner;
  IF ok IS NOT TRUE THEN
    RAISE EXCEPTION 'owner of public.public_licensee (%) neither bypasses RLS nor owns lsbd.license and lsbd.person; the view would return no rows',
      v_owner::regrole;
  END IF;
END $$;

CREATE OR REPLACE VIEW public.public_licensee
  WITH (security_invoker = false, security_barrier = true)
  AS
  SELECT
    l.license_id,
    l.type,
    l.status,
    l.action,
    l.date_since,
    l.date_until,
    p.first_name,
    p.middle_name,
    p.last_name,
    p.license_name,
    p.suffix,
    p.prefix,
    l.legacy_key
  FROM lsbd.license l
  JOIN lsbd.person p ON p.id = l.person_id
  WHERE l.status IN ('ACT','PRB')
    AND l.type IN ('D','H','E');

REVOKE ALL ON public.public_licensee FROM anon, authenticated;

DROP POLICY IF EXISTS anon_active_license ON lsbd.license;
DROP POLICY IF EXISTS anon_person_for_active_license ON lsbd.person;

-- Table-level REVOKE also clears the column grants from 0002.
REVOKE ALL ON ALL TABLES IN SCHEMA lsbd FROM anon;
REVOKE USAGE ON SCHEMA lsbd FROM anon;
