CREATE TABLE "task_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"icon" text DEFAULT 'clipboard-list' NOT NULL,
	"tone" text DEFAULT 'gray' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "task_types_slug_unique" UNIQUE("slug"),
	CONSTRAINT "task_types_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "tags" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "type_id" uuid;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_type_id_task_types_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."task_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
--
-- The six that shipped, with the icon and tone they already had in `TYPE_ICON`.
-- Order is the display order that map's key order encoded, which is not the
-- order `TASK_TYPE_LABELS` used — the `position` column settles that argument.
--
INSERT INTO "task_types" ("slug", "name", "icon", "tone", "position") VALUES
	('client_work', 'Client Work', 'briefcase',      'blue',  0),
	('review',      'Review',      'eye',            'sky',   1),
	('creative',    'Creative',    'palette',        'red',   2),
	('meeting',     'Meeting',     'users',          'green', 3),
	('internal',    'Internal',    'clipboard-list', 'gray',  4),
	('admin',       'Admin',       'settings',       'amber', 5)
ON CONFLICT ("slug") DO NOTHING;--> statement-breakpoint
--
-- Every task keeps the type it had. `type_id` stays nullable through the
-- expand phase: the enum column is still there and still authoritative for the
-- other worktree, and tightening this to NOT NULL belongs with dropping that.
--
UPDATE "tasks" t SET "type_id" = ty."id" FROM "task_types" ty WHERE ty."slug" = t."type"::text;
