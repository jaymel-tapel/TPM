CREATE TABLE "task_schedule" (
	"task_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"minutes" integer NOT NULL,
	CONSTRAINT "task_schedule_task_id_user_id_pk" PRIMARY KEY("task_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "task_schedule" ADD CONSTRAINT "task_schedule_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_schedule" ADD CONSTRAINT "task_schedule_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "task_schedule_day_idx" ON "task_schedule" USING btree ("user_id","starts_at");