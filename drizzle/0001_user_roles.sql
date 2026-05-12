CREATE TYPE "public"."lsbd_role" AS ENUM('admin', 'staff', 'discipline', 'finance', 'inspector', 'board');--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" "lsbd_role";--> statement-breakpoint
UPDATE "users" SET "role" = 'admin' WHERE "role" IS NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'staff';
