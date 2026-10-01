-- 0005_public_cms_lockdown.sql
--
-- Hand-written, like 0002_rls.sql (not in the Drizzle journal). Apply with:
--   npx tsx scripts/apply-sql.ts drizzle/0005_public_cms_lockdown.sql
--
-- Why: the CMS tables in schema public (users, posts, audit_log, ...) were created
-- without RLS, and Supabase's default grants give anon + authenticated full access
-- to every table in public. The anon key is public by design, so anyone holding it
-- could read public.users (including password_hash) and write CMS content through
-- PostgREST. Verified 2026-10-01 with a read-only probe.
--
-- What: enable RLS on every table in public and revoke anon/authenticated on the
-- tables and sequences. No policies are added: the site reads and writes these
-- tables only through the server-side connection, which bypasses RLS. Views are
-- left alone, so public.public_licensee stays readable by anon (the verify pages
-- still use it). Default privileges are revoked so a future table does not
-- reopen the hole.
--
-- Idempotent. Runs in one transaction (the runner wraps it).

DO $$
DECLARE
  r record;
  foreign_owned text;
BEGIN
  SELECT string_agg(tablename, ', ') INTO foreign_owned
  FROM pg_tables
  WHERE schemaname = 'public' AND tableowner <> current_user;
  IF foreign_owned IS NOT NULL THEN
    RAISE EXCEPTION 'public tables not owned by %: %', current_user, foreign_owned;
  END IF;

  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', r.tablename);
  END LOOP;
END $$;

REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
