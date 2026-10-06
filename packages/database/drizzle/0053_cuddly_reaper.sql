CREATE TABLE "material_image" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "material_image_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"material_id" bigint NOT NULL,
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
	CONSTRAINT "material_image_object_path_unique" UNIQUE("object_path"),
	CONSTRAINT "material_image_material_hash_unique" UNIQUE("material_id","sha256"),
	CONSTRAINT "material_image_position_valid" CHECK ("material_image"."position" >= 0),
	CONSTRAINT "material_image_size_positive" CHECK ("material_image"."size" > 0),
	CONSTRAINT "material_image_sha256_valid" CHECK ("material_image"."sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "material_image_deletion_metadata_consistent" CHECK (("material_image"."deleted_at" is null and "material_image"."deleted_by_clerk_id" is null and "material_image"."deleted_by_role" is null) or ("material_image"."deleted_at" is not null and "material_image"."deleted_by_role" is not null)),
	CONSTRAINT "material_image_deleted_by_role_valid" CHECK ("material_image"."deleted_by_role" is null or "material_image"."deleted_by_role" in ('owner', 'admin'))
);
--> statement-breakpoint
ALTER TABLE "upload_session" DROP CONSTRAINT "upload_session_target_type_valid";--> statement-breakpoint
ALTER TABLE "materials" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "material_image" ADD CONSTRAINT "material_image_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "material_image_material_id_idx" ON "material_image" USING btree ("material_id");--> statement-breakpoint
CREATE INDEX "collection_item_material_public_idx" ON "collection_item" USING btree ("material_id","owned","approval_status","is_private");--> statement-breakpoint
CREATE INDEX "product_material_material_id_idx" ON "product_material" USING btree ("material_id");--> statement-breakpoint
ALTER TABLE "materials" ADD CONSTRAINT "materials_description_length_valid" CHECK ("materials"."description" is null or char_length("materials"."description") <= 5000);--> statement-breakpoint
ALTER TABLE "upload_session" ADD CONSTRAINT "upload_session_target_type_valid" CHECK ("upload_session"."target_type" in ('product', 'material', 'collection', 'collection_item', 'resource'));