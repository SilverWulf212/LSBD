-- 0009_meetings_month_only.sql
--
-- Hand-written, like 0005 (not in the Drizzle journal). Apply with:
--   npx tsx scripts/apply-sql.ts drizzle/0009_meetings_month_only.sql
--
-- Why: lsbd.org lists its 2010-2016 minutes by month only. Such a meeting keeps the
-- first of the month in meeting_date and sets this flag, and the site shows month and
-- year. Apply BEFORE deploying the code that reads the column (the meetings page is
-- built against the database). Additive; the running site ignores the new column.
--
-- Idempotent. No BEGIN/COMMIT: the runner wraps the file in a transaction.

ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS date_is_month_only boolean NOT NULL DEFAULT false;
