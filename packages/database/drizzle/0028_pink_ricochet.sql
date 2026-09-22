CREATE TABLE "catalog_image_upload_file" (
	"id" uuid PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"file_name" text NOT NULL,
	"content_type" text NOT NULL,
	"size" integer NOT NULL,
	"sha256" text NOT NULL,
	"object_path" text NOT NULL,
	"url" text NOT NULL,
	"uploaded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "catalog_image_upload_file_object_path_unique" UNIQUE("object_path"),
	CONSTRAINT "catalog_image_upload_file_session_position_unique" UNIQUE("session_id","position"),
	CONSTRAINT "catalog_image_upload_file_session_hash_unique" UNIQUE("session_id","sha256"),
	CONSTRAINT "catalog_image_upload_file_position_valid" CHECK ("catalog_image_upload_file"."position" >= 0),
	CONSTRAINT "catalog_image_upload_file_size_positive" CHECK ("catalog_image_upload_file"."size" > 0)
);
--> statement-breakpoint
CREATE TABLE "catalog_image_upload_session" (
	"id" uuid PRIMARY KEY NOT NULL,
	"uploader_clerk_id" text NOT NULL,
	"target_type" text NOT NULL,
	"product_id" bigint,
	"collection_item_id" bigint,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "catalog_image_upload_session_target_consistent" CHECK (("catalog_image_upload_session"."target_type" = 'product' and "catalog_image_upload_session"."product_id" is not null and "catalog_image_upload_session"."collection_item_id" is null) or ("catalog_image_upload_session"."target_type" = 'collection_item' and "catalog_image_upload_session"."product_id" is null and "catalog_image_upload_session"."collection_item_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "collection_item_image" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "collection_item_image_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"collection_item_id" bigint NOT NULL,
	"position" integer NOT NULL,
	"file_name" text NOT NULL,
	"content_type" text NOT NULL,
	"size" integer NOT NULL,
	"sha256" text NOT NULL,
	"storage_provider" text DEFAULT 'bunny' NOT NULL,
	"object_path" text NOT NULL,
	"url" text NOT NULL,
	"uploaded_by_clerk_id" text NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by_clerk_id" text,
	"deleted_by_role" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collection_item_image_object_path_unique" UNIQUE("object_path"),
	CONSTRAINT "collection_item_image_item_hash_unique" UNIQUE("collection_item_id","sha256"),
	CONSTRAINT "collection_item_image_position_valid" CHECK ("collection_item_image"."position" >= 0),
	CONSTRAINT "collection_item_image_size_positive" CHECK ("collection_item_image"."size" > 0),
	CONSTRAINT "collection_item_image_deletion_metadata_consistent" CHECK (num_nonnulls("collection_item_image"."deleted_at", "collection_item_image"."deleted_by_clerk_id", "collection_item_image"."deleted_by_role") in (0, 3))
);
--> statement-breakpoint
CREATE TABLE "product_image" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "product_image_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"product_id" bigint NOT NULL,
	"position" integer NOT NULL,
	"file_name" text NOT NULL,
	"content_type" text NOT NULL,
	"size" integer NOT NULL,
	"sha256" text NOT NULL,
	"storage_provider" text DEFAULT 'bunny' NOT NULL,
	"object_path" text NOT NULL,
	"url" text NOT NULL,
	"uploaded_by_clerk_id" text NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by_clerk_id" text,
	"deleted_by_role" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_image_object_path_unique" UNIQUE("object_path"),
	CONSTRAINT "product_image_product_hash_unique" UNIQUE("product_id","sha256"),
	CONSTRAINT "product_image_position_valid" CHECK ("product_image"."position" >= 0),
	CONSTRAINT "product_image_size_positive" CHECK ("product_image"."size" > 0),
	CONSTRAINT "product_image_deletion_metadata_consistent" CHECK (num_nonnulls("product_image"."deleted_at", "product_image"."deleted_by_clerk_id", "product_image"."deleted_by_role") in (0, 3))
);
--> statement-breakpoint
CREATE TABLE "user_collection" (
	"owner_id" bigint PRIMARY KEY NOT NULL,
	"is_private" boolean DEFAULT true NOT NULL,
	"private_reason" text,
	"privated_at" timestamp with time zone,
	"privated_by_clerk_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_collection_private_metadata_consistent" CHECK (("user_collection"."is_private" and num_nonnulls("user_collection"."private_reason", "user_collection"."privated_at", "user_collection"."privated_by_clerk_id") in (0, 3)) or (not "user_collection"."is_private" and num_nonnulls("user_collection"."private_reason", "user_collection"."privated_at", "user_collection"."privated_by_clerk_id") = 0))
);
--> statement-breakpoint
ALTER TABLE "collection_item" ADD COLUMN "is_private" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "collection_item" ADD COLUMN "private_reason" text;--> statement-breakpoint
ALTER TABLE "collection_item" ADD COLUMN "privated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "collection_item" ADD COLUMN "privated_by_clerk_id" text;--> statement-breakpoint
ALTER TABLE "collection_item" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "collection_item" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "owner_clerk_id" text;--> statement-breakpoint
UPDATE "product" SET "owner_clerk_id" = 'user_3FrjTtIKHL0ptK6jeljcf5kCM7J' WHERE "owner_clerk_id" IS NULL;--> statement-breakpoint
ALTER TABLE "product" ALTER COLUMN "owner_clerk_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "is_private" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "private_reason" text;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "privated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "privated_by_clerk_id" text;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
INSERT INTO "user_collection" ("owner_id", "is_private")
SELECT DISTINCT "owner_id", false FROM "collection_item"
ON CONFLICT ("owner_id") DO NOTHING;--> statement-breakpoint
ALTER TABLE "catalog_image_upload_file" ADD CONSTRAINT "catalog_image_upload_file_session_id_catalog_image_upload_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."catalog_image_upload_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_image_upload_session" ADD CONSTRAINT "catalog_image_upload_session_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_image_upload_session" ADD CONSTRAINT "catalog_image_upload_session_collection_item_id_collection_item_id_fk" FOREIGN KEY ("collection_item_id") REFERENCES "public"."collection_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_item_image" ADD CONSTRAINT "collection_item_image_collection_item_id_collection_item_id_fk" FOREIGN KEY ("collection_item_id") REFERENCES "public"."collection_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_image" ADD CONSTRAINT "product_image_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_collection" ADD CONSTRAINT "user_collection_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "catalog_image_upload_file_session_id_idx" ON "catalog_image_upload_file" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "catalog_image_upload_session_expires_at_idx" ON "catalog_image_upload_session" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "collection_item_image_item_id_idx" ON "collection_item_image" USING btree ("collection_item_id");--> statement-breakpoint
CREATE INDEX "product_image_product_id_idx" ON "product_image" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "user_collection_visibility_idx" ON "user_collection" USING btree ("is_private");--> statement-breakpoint
CREATE INDEX "collection_item_owner_visibility_idx" ON "collection_item" USING btree ("owner_id","is_private");--> statement-breakpoint
CREATE INDEX "product_owner_clerk_id_idx" ON "product" USING btree ("owner_clerk_id");--> statement-breakpoint
CREATE INDEX "product_visibility_idx" ON "product" USING btree ("is_private");--> statement-breakpoint
ALTER TABLE "collection_item" ADD CONSTRAINT "collection_item_private_metadata_consistent" CHECK (("collection_item"."is_private" and num_nonnulls("collection_item"."private_reason", "collection_item"."privated_at", "collection_item"."privated_by_clerk_id") in (0, 3)) or (not "collection_item"."is_private" and num_nonnulls("collection_item"."private_reason", "collection_item"."privated_at", "collection_item"."privated_by_clerk_id") = 0));--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_private_metadata_consistent" CHECK (("product"."is_private" and num_nonnulls("product"."private_reason", "product"."privated_at", "product"."privated_by_clerk_id") in (0, 3)) or (not "product"."is_private" and num_nonnulls("product"."private_reason", "product"."privated_at", "product"."privated_by_clerk_id") = 0));
