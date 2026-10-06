CREATE TABLE "maker_image" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "maker_image_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"maker_id" bigint NOT NULL,
	"position" integer NOT NULL,
	"file_name" text NOT NULL,
	"content_type" text NOT NULL,
	"size" integer NOT NULL,
	"sha256" text NOT NULL,
	"storage_provider" text DEFAULT 'bunny' NOT NULL,
	"object_path" text NOT NULL,
	"url" text NOT NULL,
	"uploaded_by_clerk_id" text,
	"deleted_at" timestamp with time zone,
	"deleted_by_clerk_id" text,
	"deleted_by_role" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "maker_image_object_path_unique" UNIQUE("object_path"),
	CONSTRAINT "maker_image_maker_hash_unique" UNIQUE("maker_id","sha256"),
	CONSTRAINT "maker_image_position_valid" CHECK ("maker_image"."position" >= 0),
	CONSTRAINT "maker_image_size_positive" CHECK ("maker_image"."size" > 0),
	CONSTRAINT "maker_image_sha256_valid" CHECK ("maker_image"."sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "maker_image_deletion_metadata_consistent" CHECK (("maker_image"."deleted_at" is null and "maker_image"."deleted_by_clerk_id" is null and "maker_image"."deleted_by_role" is null) or ("maker_image"."deleted_at" is not null and "maker_image"."deleted_by_role" is not null)),
	CONSTRAINT "maker_image_deleted_by_role_valid" CHECK ("maker_image"."deleted_by_role" is null or "maker_image"."deleted_by_role" = 'admin')
);
--> statement-breakpoint
ALTER TABLE "upload_session" DROP CONSTRAINT "upload_session_target_type_valid";--> statement-breakpoint
ALTER TABLE "maker_image" ADD CONSTRAINT "maker_image_maker_id_makers_id_fk" FOREIGN KEY ("maker_id") REFERENCES "public"."makers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "maker_image_maker_id_idx" ON "maker_image" USING btree ("maker_id");--> statement-breakpoint
ALTER TABLE "upload_session" ADD CONSTRAINT "upload_session_target_type_valid" CHECK ("upload_session"."target_type" in ('maker', 'product', 'material', 'collection', 'collection_item', 'resource'));