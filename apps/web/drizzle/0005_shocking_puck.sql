-- The retirement 0002 promised.
--
-- Nothing has written `tasks.status` since boards landed, so it has sat frozen
-- at whatever 0002 backfilled — and one query was still filtering on it, which
-- is why My Tasks' state filter returned stale rows. Split from 0004 so each
-- migration is unambiguous to drizzle-kit: additions first, then the drop.

ALTER TABLE "tasks" DROP COLUMN "status";--> statement-breakpoint
DROP TYPE "public"."task_status";