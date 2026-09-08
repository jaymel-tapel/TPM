CREATE TYPE "public"."status_kind" AS ENUM('open', 'done', 'blocked');--> statement-breakpoint
CREATE TABLE "board_statuses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"board_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" "status_kind" DEFAULT 'open' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "board_statuses_board_name_key" UNIQUE("board_id","name"),
	CONSTRAINT "board_statuses_id_board_key" UNIQUE("id","board_id")
);
--> statement-breakpoint
CREATE TABLE "boards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"name" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "boards_team_name_key" UNIQUE("team_id","name"),
	CONSTRAINT "boards_id_team_key" UNIQUE("id","team_id")
);
--> statement-breakpoint
ALTER TABLE "board_statuses" ADD CONSTRAINT "board_statuses_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boards" ADD CONSTRAINT "boards_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boards" ADD CONSTRAINT "boards_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "board_statuses_board_idx" ON "board_statuses" USING btree ("board_id");--> statement-breakpoint
CREATE INDEX "boards_team_idx" ON "boards" USING btree ("team_id");--> statement-breakpoint

-- Added nullable so existing rows survive; made NOT NULL below once backfilled.
ALTER TABLE "tasks" ADD COLUMN "board_id" uuid;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "status_id" uuid;--> statement-breakpoint

-- Every team gets the board its work already implicitly lived on, named after
-- the team. Attributed to its own Account Director, falling back to a Senior
-- Director for a team that somehow has none.
INSERT INTO "boards" ("team_id", "name", "position", "created_by")
SELECT
	t."id",
	t."name",
	0,
	COALESCE(t."account_director_id", (SELECT u."id" FROM "users" u WHERE u."role" = 'senior_director' LIMIT 1))
FROM "teams" t;--> statement-breakpoint

-- The four statuses that were the enum, now rows. `kind` is what every query
-- reasons about; the name is only what people read.
INSERT INTO "board_statuses" ("board_id", "name", "kind", "position")
SELECT b."id", v."name", v."kind"::"status_kind", v."position"
FROM "boards" b
CROSS JOIN (VALUES
	('To Do', 'open', 0),
	('In Progress', 'open', 1),
	('Done', 'done', 2),
	('Blocked', 'blocked', 3)
) AS v("name", "kind", "position");--> statement-breakpoint

UPDATE "tasks" k
SET "board_id" = b."id"
FROM "boards" b
WHERE b."team_id" = k."team_id";--> statement-breakpoint

UPDATE "tasks" k
SET "status_id" = s."id"
FROM "board_statuses" s
WHERE s."board_id" = k."board_id"
	AND s."name" = CASE k."status"
		WHEN 'todo' THEN 'To Do'
		WHEN 'in_progress' THEN 'In Progress'
		WHEN 'done' THEN 'Done'
		WHEN 'blocked' THEN 'Blocked'
	END;--> statement-breakpoint

ALTER TABLE "tasks" ALTER COLUMN "board_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "status_id" SET NOT NULL;--> statement-breakpoint

ALTER TABLE "tasks" ADD CONSTRAINT "tasks_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_status_id_board_statuses_id_fk" FOREIGN KEY ("status_id") REFERENCES "public"."board_statuses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_board_team_fk" FOREIGN KEY ("board_id","team_id") REFERENCES "public"."boards"("id","team_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_status_board_fk" FOREIGN KEY ("status_id","board_id") REFERENCES "public"."board_statuses"("id","board_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tasks_board_idx" ON "tasks" USING btree ("board_id");
