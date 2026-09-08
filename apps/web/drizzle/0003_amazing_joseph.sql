CREATE TYPE "public"."doc_link_source" AS ENUM('attached', 'mentioned');--> statement-breakpoint
CREATE TYPE "public"."doc_visibility" AS ENUM('org', 'team');--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"search_text" text DEFAULT '' NOT NULL,
	"visibility" "doc_visibility" NOT NULL,
	"team_id" uuid,
	"parent_id" uuid,
	"position" integer DEFAULT 0 NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "documents_visibility_team_ck" CHECK ((visibility = 'org') = (team_id is null))
);
--> statement-breakpoint
CREATE TABLE "task_documents" (
	"task_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"source" "doc_link_source" NOT NULL,
	CONSTRAINT "task_documents_task_id_document_id_source_pk" PRIMARY KEY("task_id","document_id","source")
);
--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_documents" ADD CONSTRAINT "task_documents_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_documents" ADD CONSTRAINT "task_documents_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "documents_parent_idx" ON "documents" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "documents_team_idx" ON "documents" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "task_documents_document_idx" ON "task_documents" USING btree ("document_id");--> statement-breakpoint
-- Search covers the title and the flattened body. `search_text` is written by
-- the action from `toPlainText`, because the body is BlockNote JSON and only
-- the TypeScript knows how to flatten it; a trigger would have to reimplement
-- that in PL/pgSQL and would drift the first time a block type is added.
--
-- Written by hand rather than declared in `schema.ts`: drizzle-kit diffs the
-- schema against its own snapshot, never against the live database, so an
-- index it has never heard of is left alone. Any query hoping to use this has
-- to repeat the expression verbatim.
CREATE INDEX "documents_search_idx" ON "documents"
  USING gin (to_tsvector('english', "title" || ' ' || "search_text"));
