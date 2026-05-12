-- 0002_rls.sql
--
-- Package C: RLS for the public anon-key path.
--
-- Scope (per plan review #5): RLS protects the public /verify route's
-- `anon` JWT only. Admin server actions go through @vercel/postgres and the
-- pooler connection string, which uses `service_role` — that role bypasses
-- RLS by Supabase convention. Admin authorization happens at the app layer
-- via requireAuth(role).
--
-- Public surface area:
--   public.public_licensee  -- read-only view of active D/H/E licensees

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Default-deny: revoke anon/authenticated access to the lsbd schema.
-- ─────────────────────────────────────────────────────────────────────────
REVOKE ALL ON SCHEMA lsbd FROM anon, authenticated;--> statement-breakpoint
REVOKE ALL ON ALL TABLES IN SCHEMA lsbd FROM anon, authenticated;--> statement-breakpoint
REVOKE ALL ON ALL SEQUENCES IN SCHEMA lsbd FROM anon, authenticated;--> statement-breakpoint

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Enable RLS on every lsbd.* table so even an accidental future GRANT
--    can't expose rows without an explicit policy.
-- ─────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'lsbd'
  LOOP
    EXECUTE format('ALTER TABLE lsbd.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;--> statement-breakpoint

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Public licensee surface
-- ─────────────────────────────────────────────────────────────────────────
-- Need USAGE on the schema and column-level SELECT on license + person so
-- the view's underlying query can resolve when invoked by anon.
GRANT USAGE ON SCHEMA lsbd TO anon;--> statement-breakpoint
GRANT SELECT (id, license_id, type, status, action, date_since, date_until, person_id)
  ON lsbd.license TO anon;--> statement-breakpoint
GRANT SELECT (id, first_name, last_name, license_name, middle_name, suffix, prefix)
  ON lsbd.person TO anon;--> statement-breakpoint

-- RLS row-level filters: anon can only see active dentists/hygienists/EDDAs
-- and the matching person rows.
DROP POLICY IF EXISTS anon_active_license ON lsbd.license;--> statement-breakpoint
CREATE POLICY anon_active_license ON lsbd.license
  FOR SELECT TO anon
  USING (status IN ('ACT','PRB') AND type IN ('D','H','E'));--> statement-breakpoint

DROP POLICY IF EXISTS anon_person_for_active_license ON lsbd.person;--> statement-breakpoint
CREATE POLICY anon_person_for_active_license ON lsbd.person
  FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM lsbd.license l
    WHERE l.person_id = lsbd.person.id
      AND l.status IN ('ACT','PRB')
      AND l.type IN ('D','H','E')
  ));--> statement-breakpoint

-- The public view itself. SECURITY INVOKER (default) — runs with anon's
-- permissions when anon queries it, so RLS on the underlying tables applies.
DROP VIEW IF EXISTS public.public_licensee CASCADE;--> statement-breakpoint
CREATE VIEW public.public_licensee
  WITH (security_invoker = true)
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
    p.prefix
  FROM lsbd.license l
  JOIN lsbd.person p ON p.id = l.person_id
  WHERE l.status IN ('ACT','PRB')
    AND l.type IN ('D','H','E');--> statement-breakpoint

GRANT SELECT ON public.public_licensee TO anon;--> statement-breakpoint
GRANT SELECT ON public.public_licensee TO authenticated;
