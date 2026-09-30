CREATE TABLE "resource_files" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "resource_files_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"version_id" bigint NOT NULL,
	"file_name" text NOT NULL,
	"content_type" text NOT NULL,
	"size" integer NOT NULL,
	"storage_provider" text DEFAULT 'bunny' NOT NULL,
	"object_path" text NOT NULL,
	"url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "resource_files_object_path_unique" UNIQUE("object_path"),
	CONSTRAINT "resource_files_size_positive" CHECK ("resource_files"."size" > 0)
);
--> statement-breakpoint
ALTER TABLE "resource_downloads" ALTER COLUMN "version_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "resource_versions" ALTER COLUMN "file_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "resource_versions" ALTER COLUMN "content_type" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "resource_versions" ALTER COLUMN "size" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "resource_versions" ALTER COLUMN "storage_provider" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "resource_versions" ALTER COLUMN "object_path" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "resource_versions" ALTER COLUMN "url" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "resource_downloads" ADD COLUMN "file_id" bigint;--> statement-breakpoint
ALTER TABLE "resource_files" ADD CONSTRAINT "resource_files_version_id_resource_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."resource_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "resource_files_version_id_idx" ON "resource_files" USING btree ("version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "resource_files_version_file_name_unique" ON "resource_files" USING btree ("version_id",lower("file_name"));--> statement-breakpoint
ALTER TABLE "resource_downloads" ADD CONSTRAINT "resource_downloads_file_id_resource_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."resource_files"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "resource_downloads_file_id_idx" ON "resource_downloads" USING btree ("file_id");
--> statement-breakpoint
INSERT INTO "resource_files" ("version_id", "file_name", "content_type", "size", "storage_provider", "object_path", "url", "created_at")
SELECT "id", "file_name", "content_type", "size", "storage_provider", "object_path", "url", "created_at"
FROM "resource_versions";
--> statement-breakpoint
UPDATE "resource_downloads"
SET "file_id" = "resource_files"."id"
FROM "resource_files"
WHERE "resource_files"."version_id" = "resource_downloads"."version_id";
--> statement-breakpoint
WITH upserted_category AS (
	INSERT INTO "resource_categories" ("name", "slug", "created_by_clerk_id")
	VALUES ('Refill Adapter/Tool', 'refill-adapter-tool', 'user_3JQJhakaVBT9CfnhqO8P2rtkehQ')
	ON CONFLICT ("slug") DO UPDATE SET "name" = "resource_categories"."name"
	RETURNING "id", (xmax = 0) AS "created"
), inserted_resource AS (
	INSERT INTO "resources" ("uploader_clerk_id", "name", "description")
	SELECT 'user_3JQJhakaVBT9CfnhqO8P2rtkehQ', 'Refill Trim Kit', 'STLs to print your own refill trim kit.'
	WHERE NOT EXISTS (
		SELECT 1 FROM "resources"
		WHERE "uploader_clerk_id" = 'user_3JQJhakaVBT9CfnhqO8P2rtkehQ'
			AND "name" = 'Refill Trim Kit'
	)
	RETURNING "id"
), target_resource AS (
	SELECT "id" FROM inserted_resource
	UNION ALL
	SELECT "id" FROM "resources"
	WHERE "uploader_clerk_id" = 'user_3JQJhakaVBT9CfnhqO8P2rtkehQ'
		AND "name" = 'Refill Trim Kit'
	LIMIT 1
), inserted_version AS (
	INSERT INTO "resource_versions" ("resource_id", "version")
	SELECT "id", 1 FROM target_resource
	ON CONFLICT ("resource_id", "version") DO UPDATE SET "version" = "resource_versions"."version"
	RETURNING "id"
), inserted_files AS (
	INSERT INTO "resource_files" ("version_id", "file_name", "content_type", "size", "object_path", "url")
	SELECT inserted_version."id", seed."file_name", 'application/octet-stream', seed."size", seed."object_path", seed."url"
	FROM inserted_version
	CROSS JOIN (VALUES
		('GUIDE TRIM TOOL_No-Text.stl', 1911484, 'resources/files/GUIDE TRIM TOOL_No-Text.stl', 'https://cdn.pocket-trash.app/resources/files/GUIDE%20TRIM%20TOOL_No-Text.stl'),
		('GUIDE TRIM TOOL_Text-on-Side.stl', 2217884, 'resources/files/GUIDE TRIM TOOL_Text-on-Side.stl', 'https://cdn.pocket-trash.app/resources/files/GUIDE%20TRIM%20TOOL_Text-on-Side.stl')
	) AS seed("file_name", "size", "object_path", "url")
	ON CONFLICT DO NOTHING
	RETURNING "id"
), inserted_assignment AS (
	INSERT INTO "resources_to_categories" ("resource_id", "category_id")
	SELECT target_resource."id", upserted_category."id"
	FROM target_resource CROSS JOIN upserted_category
	ON CONFLICT DO NOTHING
), inserted_resource_notification AS (
	INSERT INTO "resource_notifications" ("type", "resource_id", "uploader_clerk_id")
	SELECT 'resource_created', "id", 'user_3JQJhakaVBT9CfnhqO8P2rtkehQ'
	FROM inserted_resource
), inserted_category_notification AS (
	INSERT INTO "resource_notifications" ("type", "resource_id", "category_id", "uploader_clerk_id")
	SELECT 'category_created', target_resource."id", upserted_category."id", 'user_3JQJhakaVBT9CfnhqO8P2rtkehQ'
	FROM target_resource CROSS JOIN upserted_category
	WHERE upserted_category."created"
)
SELECT count(*) FROM inserted_files;
--> statement-breakpoint
UPDATE "tmp_images"
SET
	"image_file_id" = '/images/' || ltrim("image_file_id", '/'),
	"image_path" = '/images/' || ltrim("image_path", '/'),
	"image_url" = regexp_replace(
		"image_url",
		'^https://cdn[.]pocket-trash[.]app/pocket-trash-images/',
		'https://cdn.pocket-trash.app/images/'
	),
	"updated_at" = now()
WHERE "image_provider" = 'bunny'
	AND "status" = 'uploaded'
	AND "image_file_id" IS NOT NULL
	AND "image_path" IS NOT NULL
	AND "image_url" LIKE 'https://cdn.pocket-trash.app/pocket-trash-images/%';
