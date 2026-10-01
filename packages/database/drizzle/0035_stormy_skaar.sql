CREATE TABLE "erasure_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject_hmac" text NOT NULL,
	"target_clerk_id" text,
	"initiator" text NOT NULL,
	"verification_reference" text,
	"verification_method" text,
	"verified_by_clerk_id" text,
	"verified_at" timestamp with time zone,
	"status" text DEFAULT 'pending' NOT NULL,
	"storage_targets" text[],
	"step_results" jsonb NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone,
	"error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "erasure_request_subject_hmac_unique" UNIQUE("subject_hmac"),
	CONSTRAINT "erasure_request_initiator_valid" CHECK ("erasure_request"."initiator" in ('self', 'admin')),
	CONSTRAINT "erasure_request_status_valid" CHECK ("erasure_request"."status" in ('pending', 'running', 'completed', 'needs_attention')),
	CONSTRAINT "erasure_request_verification_method_valid" CHECK ("erasure_request"."verification_method" is null or "erasure_request"."verification_method" in ('clerk_reverification', 'authenticated_request', 'verified_email', 'clerk_webhook')),
	CONSTRAINT "erasure_request_attempts_valid" CHECK ("erasure_request"."attempts" >= 0),
	CONSTRAINT "erasure_request_completion_valid" CHECK (("erasure_request"."status" = 'completed') = ("erasure_request"."completed_at" is not null and "erasure_request"."expires_at" is not null and "erasure_request"."target_clerk_id" is null))
);
--> statement-breakpoint
ALTER TABLE "collection_item" DROP CONSTRAINT "collection_item_private_metadata_consistent";--> statement-breakpoint
ALTER TABLE "collection_item_image" DROP CONSTRAINT "collection_item_image_deletion_metadata_consistent";--> statement-breakpoint
ALTER TABLE "product" DROP CONSTRAINT "product_private_metadata_consistent";--> statement-breakpoint
ALTER TABLE "product_image" DROP CONSTRAINT "product_image_deletion_metadata_consistent";--> statement-breakpoint
ALTER TABLE "user_collection" DROP CONSTRAINT "user_collection_private_metadata_consistent";--> statement-breakpoint
ALTER TABLE "resources" DROP CONSTRAINT "resources_private_metadata_consistent";--> statement-breakpoint
ALTER TABLE "resources" DROP CONSTRAINT "resources_deletion_metadata_consistent";--> statement-breakpoint
ALTER TABLE "collection_image" ALTER COLUMN "uploaded_by_clerk_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "collection_item_image" ALTER COLUMN "uploaded_by_clerk_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "product" ALTER COLUMN "owner_clerk_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "product_image" ALTER COLUMN "uploaded_by_clerk_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "feature_flag_user_overrides" ALTER COLUMN "created_by_clerk_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "feature_flag_user_overrides" ALTER COLUMN "updated_by_clerk_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "feature_flags" ALTER COLUMN "created_by_clerk_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "feature_flags" ALTER COLUMN "updated_by_clerk_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "resource_categories" ALTER COLUMN "created_by_clerk_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "storage_object_deletion" ADD COLUMN "owner_clerk_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "erasure_request_target_clerk_id_unique" ON "erasure_request" USING btree ("target_clerk_id") WHERE "erasure_request"."target_clerk_id" is not null;--> statement-breakpoint
CREATE INDEX "erasure_request_due_idx" ON "erasure_request" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "erasure_request_expiry_idx" ON "erasure_request" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "storage_object_deletion_owner_idx" ON "storage_object_deletion" USING btree ("owner_clerk_id");--> statement-breakpoint
ALTER TABLE "collection_item" ADD CONSTRAINT "collection_item_private_metadata_consistent" CHECK ((not "collection_item"."is_private" and num_nonnulls("collection_item"."private_reason", "collection_item"."privated_at", "collection_item"."privated_by_clerk_id") = 0) or ("collection_item"."is_private" and (num_nonnulls("collection_item"."private_reason", "collection_item"."privated_at", "collection_item"."privated_by_clerk_id") = 0 or ("collection_item"."private_reason" is not null and "collection_item"."privated_at" is not null))));--> statement-breakpoint
ALTER TABLE "collection_item_image" ADD CONSTRAINT "collection_item_image_deletion_metadata_consistent" CHECK (("collection_item_image"."deleted_at" is null and "collection_item_image"."deleted_by_clerk_id" is null and "collection_item_image"."deleted_by_role" is null) or ("collection_item_image"."deleted_at" is not null and "collection_item_image"."deleted_by_role" is not null));--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_private_metadata_consistent" CHECK ((not "product"."is_private" and num_nonnulls("product"."private_reason", "product"."privated_at", "product"."privated_by_clerk_id") = 0) or ("product"."is_private" and (num_nonnulls("product"."private_reason", "product"."privated_at", "product"."privated_by_clerk_id") = 0 or ("product"."private_reason" is not null and "product"."privated_at" is not null))));--> statement-breakpoint
ALTER TABLE "product_image" ADD CONSTRAINT "product_image_deletion_metadata_consistent" CHECK (("product_image"."deleted_at" is null and "product_image"."deleted_by_clerk_id" is null and "product_image"."deleted_by_role" is null) or ("product_image"."deleted_at" is not null and "product_image"."deleted_by_role" is not null));--> statement-breakpoint
ALTER TABLE "user_collection" ADD CONSTRAINT "user_collection_private_metadata_consistent" CHECK ((not "user_collection"."is_private" and num_nonnulls("user_collection"."private_reason", "user_collection"."privated_at", "user_collection"."privated_by_clerk_id") = 0) or ("user_collection"."is_private" and (num_nonnulls("user_collection"."private_reason", "user_collection"."privated_at", "user_collection"."privated_by_clerk_id") = 0 or ("user_collection"."private_reason" is not null and "user_collection"."privated_at" is not null))));--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_private_metadata_consistent" CHECK ((not "resources"."is_private" and num_nonnulls("resources"."private_reason", "resources"."privated_at", "resources"."privated_by_clerk_id") = 0) or ("resources"."is_private" and (num_nonnulls("resources"."private_reason", "resources"."privated_at", "resources"."privated_by_clerk_id") = 0 or ("resources"."private_reason" is not null and "resources"."privated_at" is not null))));--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_deletion_metadata_consistent" CHECK (("resources"."deleted_at" is null and "resources"."deleted_by_clerk_id" is null and "resources"."deleted_by_role" is null) or ("resources"."deleted_at" is not null and "resources"."deleted_by_role" is not null));