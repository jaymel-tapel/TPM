CREATE TABLE "folders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"parent_id" uuid,
	"visibility" "doc_visibility" NOT NULL,
	"team_id" uuid,
	"position" integer DEFAULT 0 NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "folders_visibility_team_ck" CHECK ((visibility = 'org') = (team_id is null))
);
--> statement-breakpoint
DROP INDEX "documents_parent_idx";--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "folder_id" uuid;--> statement-breakpoint
ALTER TABLE "folders" ADD CONSTRAINT "folders_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folders" ADD CONSTRAINT "folders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folders" ADD CONSTRAINT "folders_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "folders_parent_idx" ON "folders" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "folders_team_idx" ON "folders" USING btree ("team_id");--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_folder_id_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "documents_folder_idx" ON "documents" USING btree ("folder_id");--> statement-breakpoint
-- Documents used to contain documents. Folders contain, documents say
-- something, and this moves the existing tree onto that shape.
--
-- A document that has children becomes a folder of the same name, and keeps
-- the *same id*: every `parent_id` in the table already points at it, so the
-- ids remap themselves and nothing has to be looked up twice.
INSERT INTO "folders" (id, name, parent_id, visibility, team_id, position, created_by, created_at, updated_at)
SELECT d.id, d.title, d.parent_id, d.visibility, d.team_id, d.position, d.created_by, d.created_at, d.updated_at
FROM "documents" d
WHERE EXISTS (SELECT 1 FROM "documents" c WHERE c.parent_id = d.id);--> statement-breakpoint

-- Every document now lives in the folder its parent just became. A top-level
-- document had no parent and stays at the top.
UPDATE "documents" SET folder_id = parent_id WHERE parent_id IS NOT NULL;--> statement-breakpoint

-- A converted document that actually said something keeps saying it, as a
-- document inside its own new folder — nothing written is lost. `search_text`
-- is the flattened body, so it is the honest test of whether there was any.
UPDATE "documents" d
   SET folder_id = d.id
 WHERE EXISTS (SELECT 1 FROM "folders" f WHERE f.id = d.id)
   AND btrim(coalesce(d.search_text, '')) <> '';--> statement-breakpoint

-- One that held nothing but its children was only ever a container, and the
-- folder is now doing that job.
DELETE FROM "documents" d
 WHERE EXISTS (SELECT 1 FROM "folders" f WHERE f.id = d.id)
   AND btrim(coalesce(d.search_text, '')) = '';
