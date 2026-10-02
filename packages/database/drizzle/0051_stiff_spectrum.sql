DROP INDEX "collection_item_collection_visibility_idx";--> statement-breakpoint
ALTER TABLE "collection_item" ADD COLUMN "approval_status" text DEFAULT 'approved' NOT NULL;--> statement-breakpoint
ALTER TABLE "collection_item" ALTER COLUMN "approval_status" SET DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "collection_item" ADD COLUMN "approval_decision_reason" text;--> statement-breakpoint
ALTER TABLE "collection_item" ADD COLUMN "approval_decided_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "collection_item_collection_visibility_idx" ON "collection_item" USING btree ("collection_id","owner_id","approval_status","is_private");--> statement-breakpoint
ALTER TABLE "collection_item" ADD CONSTRAINT "collection_item_approval_status_valid" CHECK ("collection_item"."approval_status" in ('pending', 'approved', 'rejected'));--> statement-breakpoint
ALTER TABLE "collection_item" ADD CONSTRAINT "collection_item_approval_decision_metadata_consistent" CHECK (num_nonnulls("collection_item"."approval_decision_reason", "collection_item"."approval_decided_at") in (0, 2));--> statement-breakpoint
ALTER TABLE "collection_item" ADD CONSTRAINT "collection_item_approval_reason_valid" CHECK ("collection_item"."approval_decision_reason" is null or char_length(trim("collection_item"."approval_decision_reason")) between 1 and 1000);
