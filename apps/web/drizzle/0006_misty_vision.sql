-- Time logging.
--
-- `ALTER TYPE ... ADD VALUE` runs inside the migrator's transaction, which
-- Postgres allows from 12 onward so long as the new value is not *used* in the
-- same transaction. This migration only declares it; the first row using it
-- comes later, from the app.

ALTER TYPE "public"."activity_kind" ADD VALUE 'time_logged' BEFORE 'created';--> statement-breakpoint
ALTER TABLE "task_activity" ADD COLUMN "minutes" integer;