-- Durations on tasks, and the activity stream.
--
-- `estimate_minutes` / `actual_minutes` are nullable because most work is never
-- estimated, and zero is a real answer that must not be confused with "nobody
-- said". A day is eight hours here — see lib/duration.ts.
--
-- `task_activity` snapshots column names as text rather than referencing
-- board_statuses: a column can be renamed or deleted, and history must keep
-- reading correctly afterwards.

CREATE TYPE "public"."activity_kind" AS ENUM('comment', 'created', 'status_changed', 'completed', 'reopened', 'assigned', 'unassigned', 'board_changed');--> statement-breakpoint
CREATE TABLE "task_activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"kind" "activity_kind" NOT NULL,
	"body" text,
	"from_label" text,
	"to_label" text,
	"subject_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "estimate_minutes" integer;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "actual_minutes" integer;--> statement-breakpoint
ALTER TABLE "task_activity" ADD CONSTRAINT "task_activity_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_activity" ADD CONSTRAINT "task_activity_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "task_activity_task_idx" ON "task_activity" USING btree ("task_id","created_at");