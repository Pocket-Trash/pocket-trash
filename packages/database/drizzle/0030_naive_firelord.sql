DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_schema = 'public'
			AND table_name = 'users'
			AND column_name = 'username'
	) THEN
		RAISE EXCEPTION 'users.username is required; apply the ENG-109 user sync migration first';
	END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "catalog_image_upload_session" DROP CONSTRAINT "catalog_image_upload_session_target_consistent";
--> statement-breakpoint
DROP INDEX "collection_item_owner_visibility_idx";
--> statement-breakpoint
DROP INDEX "user_collection_visibility_idx";
--> statement-breakpoint
ALTER TABLE "catalog_image_upload_session" ADD COLUMN "collection_id" bigint;
--> statement-breakpoint
ALTER TABLE "user_collection" ADD COLUMN "id" bigint GENERATED ALWAYS AS IDENTITY (sequence name "user_collection_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1);
--> statement-breakpoint
ALTER TABLE "user_collection" ADD COLUMN "name" text;
--> statement-breakpoint
ALTER TABLE "user_collection" ADD COLUMN "normalized_name" text;
--> statement-breakpoint
ALTER TABLE "user_collection" ADD COLUMN "description" text;
--> statement-breakpoint
UPDATE "user_collection" AS collection
SET
	"name" = "users"."username" || '''s Collection',
	"normalized_name" = regexp_replace(
		lower(normalize(trim("users"."username" || '''s Collection'), NFKD)),
		'[^[:alnum:]]',
		'',
		'g'
	)
FROM "users"
WHERE collection."owner_id" = "users"."id"
	AND "users"."username" IS NOT NULL;
--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (
		SELECT 1 FROM "user_collection"
		WHERE "name" IS NULL OR "normalized_name" IS NULL OR "normalized_name" = ''
	) THEN
		RAISE EXCEPTION 'collection backfill requires a synchronized, normalizable username for every owner';
	END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "user_collection" ALTER COLUMN "id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "user_collection" ALTER COLUMN "name" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "user_collection" ALTER COLUMN "normalized_name" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "user_collection" DROP CONSTRAINT "user_collection_pkey";
--> statement-breakpoint
ALTER TABLE "user_collection" ADD CONSTRAINT "user_collection_pkey" PRIMARY KEY ("id");
--> statement-breakpoint
ALTER TABLE "collection_item" ADD COLUMN "collection_id" bigint;
--> statement-breakpoint
UPDATE "collection_item" AS item
SET "collection_id" = collection."id"
FROM "user_collection" AS collection
WHERE item."owner_id" = collection."owner_id";
--> statement-breakpoint
ALTER TABLE "collection_item" ALTER COLUMN "collection_id" SET NOT NULL;
--> statement-breakpoint
CREATE TABLE "collection_image" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "collection_image_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"collection_id" bigint NOT NULL,
	"is_current" boolean DEFAULT false NOT NULL,
	"position" integer NOT NULL,
	"file_name" text NOT NULL,
	"content_type" text NOT NULL,
	"size" integer NOT NULL,
	"sha256" text NOT NULL,
	"storage_provider" text DEFAULT 'bunny' NOT NULL,
	"object_path" text NOT NULL,
	"url" text NOT NULL,
	"uploaded_by_clerk_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collection_image_object_path_unique" UNIQUE("object_path"),
	CONSTRAINT "collection_image_collection_hash_unique" UNIQUE("collection_id","sha256"),
	CONSTRAINT "collection_image_position_valid" CHECK ("collection_image"."position" >= 0),
	CONSTRAINT "collection_image_size_positive" CHECK ("collection_image"."size" > 0),
	CONSTRAINT "collection_image_sha256_valid" CHECK ("collection_image"."sha256" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
ALTER TABLE "collection_image" ADD CONSTRAINT "collection_image_collection_id_user_collection_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."user_collection"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "catalog_image_upload_session" ADD CONSTRAINT "catalog_image_upload_session_collection_id_user_collection_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."user_collection"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_collection" ADD CONSTRAINT "user_collection_id_owner_unique" UNIQUE("id","owner_id");
--> statement-breakpoint
ALTER TABLE "collection_item" ADD CONSTRAINT "collection_item_collection_owner_fk" FOREIGN KEY ("collection_id","owner_id") REFERENCES "public"."user_collection"("id","owner_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "collection_image_collection_id_idx" ON "collection_image" USING btree ("collection_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "collection_image_current_unique" ON "collection_image" USING btree ("collection_id") WHERE "collection_image"."is_current";
--> statement-breakpoint
CREATE INDEX "collection_item_collection_visibility_idx" ON "collection_item" USING btree ("collection_id","owner_id","is_private");
--> statement-breakpoint
CREATE INDEX "user_collection_owner_visibility_idx" ON "user_collection" USING btree ("owner_id","is_private");
--> statement-breakpoint
ALTER TABLE "user_collection" ADD CONSTRAINT "user_collection_owner_name_unique" UNIQUE("owner_id","normalized_name");
--> statement-breakpoint
ALTER TABLE "catalog_image_upload_session" ADD CONSTRAINT "catalog_image_upload_session_target_consistent" CHECK (("catalog_image_upload_session"."target_type" = 'product' and "catalog_image_upload_session"."product_id" is not null and "catalog_image_upload_session"."collection_id" is null and "catalog_image_upload_session"."collection_item_id" is null) or ("catalog_image_upload_session"."target_type" = 'collection' and "catalog_image_upload_session"."product_id" is null and "catalog_image_upload_session"."collection_id" is not null and "catalog_image_upload_session"."collection_item_id" is null) or ("catalog_image_upload_session"."target_type" = 'collection_item' and "catalog_image_upload_session"."product_id" is null and "catalog_image_upload_session"."collection_id" is null and "catalog_image_upload_session"."collection_item_id" is not null));
--> statement-breakpoint
ALTER TABLE "user_collection" ADD CONSTRAINT "user_collection_name_length_valid" CHECK (char_length(trim("user_collection"."name")) between 2 and 80);
