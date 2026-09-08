ALTER TABLE "boards" ALTER COLUMN "team_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "team_id" DROP NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "boards_root_name_key" ON "boards" USING btree ("name") WHERE team_id is null;