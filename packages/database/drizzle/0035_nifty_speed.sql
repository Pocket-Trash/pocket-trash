ALTER TABLE "erasure_request" ADD COLUMN "storage_targets" text[];--> statement-breakpoint
ALTER TABLE "storage_object_deletion" ADD COLUMN "owner_clerk_id" text;--> statement-breakpoint
CREATE INDEX "storage_object_deletion_owner_idx" ON "storage_object_deletion" USING btree ("owner_clerk_id");