-- 0008_login_attempts.sql
--
-- Hand-written, like 0005_public_cms_lockdown.sql (not in the Drizzle journal). Apply with:
--   npx tsx scripts/apply-sql.ts drizzle/0008_login_attempts.sql
--
-- Why: the admin sign-in had no brake on failed attempts, so passwords could be
-- guessed without limit (security audit 2026-10-02, H1).
--
-- What: one row per failed sign-in, keyed `ip:<ip>` or `email:<email>`. The app counts
-- rows in the last 15 minutes (10 per IP, 5 per email) and prunes rows older than 24
-- hours. RLS is enabled with no policies and anon/authenticated are revoked: only the
-- server-side connection touches this table.
--
-- Idempotent. No BEGIN/COMMIT: the runner wraps the file in a transaction.

CREATE TABLE IF NOT EXISTS public.login_attempts (
  id bigserial PRIMARY KEY,
  key text NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS login_attempts_key_time ON public.login_attempts (key, attempted_at);

ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.login_attempts FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.login_attempts_id_seq FROM anon, authenticated;
