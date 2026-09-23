ALTER TABLE "resources" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "resources" ADD COLUMN "deleted_by_clerk_id" text;--> statement-breakpoint
ALTER TABLE "resources" ADD COLUMN "deleted_by_role" text;--> statement-breakpoint
CREATE INDEX "resources_deleted_at_idx" ON "resources" USING btree ("deleted_at");--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_deletion_metadata_consistent" CHECK (num_nonnulls("resources"."deleted_at", "resources"."deleted_by_clerk_id", "resources"."deleted_by_role") in (0, 3));--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_deleted_by_role_valid" CHECK ("resources"."deleted_by_role" is null or "resources"."deleted_by_role" in ('owner', 'admin'));