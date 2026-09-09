CREATE TYPE "public"."campaign_status" AS ENUM('planned', 'live', 'wrapped');--> statement-breakpoint
CREATE TABLE "account_members" (
	"account_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_members_account_id_user_id_pk" PRIMARY KEY("account_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"name" text NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"status" "campaign_status" DEFAULT 'planned' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaigns_account_name_key" UNIQUE("account_id","name"),
	CONSTRAINT "campaigns_id_account_key" UNIQUE("id","account_id"),
	CONSTRAINT "campaigns_range_ck" CHECK (ends_on >= starts_on)
);
--> statement-breakpoint
ALTER TABLE "teams" RENAME TO "accounts";--> statement-breakpoint
ALTER TABLE "boards" RENAME COLUMN "team_id" TO "account_id";--> statement-breakpoint
ALTER TABLE "documents" RENAME COLUMN "team_id" TO "account_id";--> statement-breakpoint
ALTER TABLE "folders" RENAME COLUMN "team_id" TO "account_id";--> statement-breakpoint
ALTER TABLE "tasks" RENAME COLUMN "team_id" TO "account_id";--> statement-breakpoint
ALTER TABLE "boards" DROP CONSTRAINT "boards_team_name_key";--> statement-breakpoint
-- Hand-moved: the composite key on `tasks` points at `boards_id_team_key`,
-- so it has to go first. drizzle-kit emitted the drops the other way round.
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_board_team_fk";--> statement-breakpoint
ALTER TABLE "boards" DROP CONSTRAINT "boards_id_team_key";--> statement-breakpoint
ALTER TABLE "documents" DROP CONSTRAINT "documents_visibility_team_ck";--> statement-breakpoint
ALTER TABLE "folders" DROP CONSTRAINT "folders_visibility_team_ck";--> statement-breakpoint
ALTER TABLE "boards" DROP CONSTRAINT "boards_team_id_teams_id_fk";
--> statement-breakpoint
ALTER TABLE "documents" DROP CONSTRAINT "documents_team_id_teams_id_fk";
--> statement-breakpoint
ALTER TABLE "folders" DROP CONSTRAINT "folders_team_id_teams_id_fk";
--> statement-breakpoint
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_team_id_teams_id_fk";
--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_team_id_teams_id_fk";
--> statement-breakpoint
ALTER TABLE "documents" ALTER COLUMN "visibility" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "folders" ALTER COLUMN "visibility" SET DATA TYPE text;--> statement-breakpoint
-- Hand-added: the column is text for exactly these two statements, which is
-- the only window in which the old value can be renamed to the new one.
UPDATE "documents" SET "visibility" = 'account' WHERE "visibility" = 'team';--> statement-breakpoint
UPDATE "folders" SET "visibility" = 'account' WHERE "visibility" = 'team';--> statement-breakpoint
DROP TYPE "public"."doc_visibility";--> statement-breakpoint
CREATE TYPE "public"."doc_visibility" AS ENUM('org', 'account');--> statement-breakpoint
ALTER TABLE "documents" ALTER COLUMN "visibility" SET DATA TYPE "public"."doc_visibility" USING "visibility"::"public"."doc_visibility";--> statement-breakpoint
ALTER TABLE "folders" ALTER COLUMN "visibility" SET DATA TYPE "public"."doc_visibility" USING "visibility"::"public"."doc_visibility";--> statement-breakpoint
DROP INDEX "boards_team_idx";--> statement-breakpoint
DROP INDEX "documents_team_idx";--> statement-breakpoint
DROP INDEX "folders_team_idx";--> statement-breakpoint
DROP INDEX "tasks_team_due_idx";--> statement-breakpoint
DROP INDEX "users_team_idx";--> statement-breakpoint
DROP INDEX "boards_root_name_key";--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "campaign_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "account_members" ADD CONSTRAINT "account_members_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_members" ADD CONSTRAINT "account_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_members_user_idx" ON "account_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "campaigns_account_idx" ON "campaigns" USING btree ("account_id");--> statement-breakpoint
ALTER TABLE "boards" ADD CONSTRAINT "boards_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folders" ADD CONSTRAINT "folders_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Hand-moved: `tasks_board_account_fk` references these, so the unique keys
-- have to exist before it. drizzle-kit emitted them after.
ALTER TABLE "boards" ADD CONSTRAINT "boards_account_name_key" UNIQUE("account_id","name");--> statement-breakpoint
ALTER TABLE "boards" ADD CONSTRAINT "boards_id_account_key" UNIQUE("id","account_id");--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_board_account_fk" FOREIGN KEY ("board_id","account_id") REFERENCES "public"."boards"("id","account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_campaign_account_fk" FOREIGN KEY ("campaign_id","account_id") REFERENCES "public"."campaigns"("id","account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "boards_account_idx" ON "boards" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "documents_account_idx" ON "documents" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "folders_account_idx" ON "folders" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "tasks_account_due_idx" ON "tasks" USING btree ("account_id","due_date");--> statement-breakpoint
CREATE INDEX "tasks_campaign_idx" ON "tasks" USING btree ("campaign_id");--> statement-breakpoint
CREATE UNIQUE INDEX "boards_root_name_key" ON "boards" USING btree ("name") WHERE account_id is null;--> statement-breakpoint
-- Hand-added: carry the old one-team-per-person membership across before the
-- column holding it is dropped. Everybody keeps the account they were on;
-- being on a second one is the new thing, and nothing here can invent it.
INSERT INTO "account_members" ("account_id", "user_id")
  SELECT "team_id", "id" FROM "users" WHERE "team_id" IS NOT NULL
  ON CONFLICT DO NOTHING;--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "team_id";--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_name_unique" UNIQUE("name");--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_visibility_account_ck" CHECK ((visibility = 'org') = (account_id is null));--> statement-breakpoint
ALTER TABLE "folders" ADD CONSTRAINT "folders_visibility_account_ck" CHECK ((visibility = 'org') = (account_id is null));--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_campaign_needs_account_ck" CHECK (campaign_id is null or account_id is not null);