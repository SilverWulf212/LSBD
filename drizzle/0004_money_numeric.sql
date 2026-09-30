-- 0004_money_numeric.sql
--
-- Task 14 (controller carry 7, global "money kept as exact numeric"): the money columns of
-- lsbd.transactions and lsbd.transaction_splits become exact numeric(19,4), the type every
-- other lsbd money column already uses (renewals, fee, permit_type, renewal_settings).
-- The source columns are SQL Server float (lsbd_raw keeps them as float8); the transform
-- converts float8 -> numeric (Postgres keeps 15 significant digits), so a source 12.34 lands
-- as exactly 12.34 and float noise such as 0.30000000000000004 lands as 0.3. No live source
-- value has more than 4 decimal places (checked 2026-09-30), so the scale loses nothing.
-- ce_hours stays double precision: it is hours, not money.
-- Both tables were empty when this was applied (they are first loaded by Task 14's
-- transforms). drizzle-kit generated; renumbered 0003 -> 0004 because 0003_legacy_keys
-- already holds journal idx 2 (0002_rls is hand-written and not in the journal).
-- Apply: npx tsx scripts/apply-migration.ts drizzle/0004_money_numeric.sql

ALTER TABLE "lsbd"."transaction_splits" ALTER COLUMN "fee" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "lsbd"."transactions" ALTER COLUMN "fee" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "lsbd"."transactions" ALTER COLUMN "penalty" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "lsbd"."transactions" ALTER COLUMN "total" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "lsbd"."transactions" ALTER COLUMN "ass_fee" SET DATA TYPE numeric(19, 4);--> statement-breakpoint
ALTER TABLE "lsbd"."transactions" ALTER COLUMN "well_being_fee" SET DATA TYPE numeric(19, 4);