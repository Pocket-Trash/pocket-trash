DROP INDEX "product_visibility_idx";--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "approval_status" text DEFAULT 'approved' NOT NULL;--> statement-breakpoint
ALTER TABLE "product" ALTER COLUMN "approval_status" SET DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "approval_decision_reason" text;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "approval_decided_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "product_visibility_idx" ON "product" USING btree ("approval_status","is_private");--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_approval_status_valid" CHECK ("product"."approval_status" in ('pending', 'approved', 'rejected'));--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_approval_decision_metadata_consistent" CHECK (num_nonnulls("product"."approval_decision_reason", "product"."approval_decided_at") in (0, 2));--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_approval_reason_valid" CHECK ("product"."approval_decision_reason" is null or char_length(trim("product"."approval_decision_reason")) between 1 and 1000);
