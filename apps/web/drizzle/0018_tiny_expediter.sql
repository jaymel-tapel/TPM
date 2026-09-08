ALTER TABLE "tasks" ADD COLUMN "position" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "tasks_status_position_idx" ON "tasks" USING btree ("status_id","position");