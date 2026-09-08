CREATE TABLE "department" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"timezone" text NOT NULL,
	"work_start_hour" integer DEFAULT 7 NOT NULL,
	"work_end_hour" integer DEFAULT 21 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "department_single_row_ck" CHECK (id = 1)
);
--> statement-breakpoint
-- The settings row itself. Seeded from the environment variable this replaces,
-- so an existing deployment keeps the timezone it already had.
INSERT INTO "department" ("id", "timezone") VALUES (1, 'Europe/London') ON CONFLICT DO NOTHING;
