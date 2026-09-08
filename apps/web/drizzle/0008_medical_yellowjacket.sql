ALTER TABLE "documents" DROP CONSTRAINT "documents_parent_fk";
--> statement-breakpoint
ALTER TABLE "documents" DROP COLUMN "parent_id";