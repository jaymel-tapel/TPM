CREATE TYPE "public"."leave_half" AS ENUM('am', 'pm');--> statement-breakpoint
CREATE TYPE "public"."leave_kind" AS ENUM('vacation', 'sick', 'personal', 'unpaid');--> statement-breakpoint
CREATE TYPE "public"."leave_status" AS ENUM('pending', 'approved', 'declined', 'cancelled');--> statement-breakpoint
CREATE TABLE "leave_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "leave_kind" NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"half" "leave_half",
	"note" text,
	"status" "leave_status" DEFAULT 'pending' NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"decision_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "leave_range_ck" CHECK (end_date >= start_date),
	CONSTRAINT "leave_half_single_day_ck" CHECK (half is null or start_date = end_date)
);
--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "leave_user_range_idx" ON "leave_requests" USING btree ("user_id","start_date");