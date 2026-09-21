CREATE TABLE "resource_images" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "resource_images_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"resource_id" bigint NOT NULL,
	"position" integer NOT NULL,
	"file_name" text NOT NULL,
	"content_type" text NOT NULL,
	"size" integer NOT NULL,
	"storage_provider" text DEFAULT 'bunny' NOT NULL,
	"object_path" text NOT NULL,
	"url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "resource_images_resource_position_unique" UNIQUE("resource_id","position"),
	CONSTRAINT "resource_images_object_path_unique" UNIQUE("object_path"),
	CONSTRAINT "resource_images_position_valid" CHECK ("resource_images"."position" >= 0),
	CONSTRAINT "resource_images_size_positive" CHECK ("resource_images"."size" > 0)
);
--> statement-breakpoint
ALTER TABLE "resource_upload_files" DROP CONSTRAINT "resource_upload_files_kind_valid";--> statement-breakpoint
ALTER TABLE "resource_upload_sessions" DROP CONSTRAINT "resource_upload_sessions_metadata_consistent";--> statement-breakpoint
ALTER TABLE "resources" DROP CONSTRAINT "resources_preview_metadata_consistent";--> statement-breakpoint
DROP INDEX "resource_upload_files_session_preview_unique";--> statement-breakpoint
DELETE FROM "resource_upload_sessions";--> statement-breakpoint
ALTER TABLE "resource_upload_files" ADD COLUMN "position" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "resource_upload_sessions" ADD COLUMN "reserved_resource_id" bigint;--> statement-breakpoint
ALTER TABLE "resource_images" ADD CONSTRAINT "resource_images_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "resource_images_resource_id_idx" ON "resource_images" USING btree ("resource_id");--> statement-breakpoint
INSERT INTO "resource_images" (
	"resource_id", "position", "file_name", "content_type", "size", "object_path", "url"
)
SELECT "id", 0, "preview_image_file_name", "preview_image_content_type",
	"preview_image_size", "preview_image_object_path", "preview_image_url"
FROM "resources"
WHERE "preview_image_file_name" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "resources" DROP COLUMN "preview_image_file_name";--> statement-breakpoint
ALTER TABLE "resources" DROP COLUMN "preview_image_content_type";--> statement-breakpoint
ALTER TABLE "resources" DROP COLUMN "preview_image_size";--> statement-breakpoint
ALTER TABLE "resources" DROP COLUMN "preview_image_object_path";--> statement-breakpoint
ALTER TABLE "resources" DROP COLUMN "preview_image_url";--> statement-breakpoint
ALTER TABLE "resource_upload_files" ADD CONSTRAINT "resource_upload_files_session_kind_position_unique" UNIQUE("session_id","kind","position");--> statement-breakpoint
ALTER TABLE "resource_upload_files" ADD CONSTRAINT "resource_upload_files_position_valid" CHECK ("resource_upload_files"."position" >= 0);--> statement-breakpoint
ALTER TABLE "resource_upload_files" ADD CONSTRAINT "resource_upload_files_kind_valid" CHECK ("resource_upload_files"."kind" in ('resource', 'image'));--> statement-breakpoint
ALTER TABLE "resource_upload_sessions" ADD CONSTRAINT "resource_upload_sessions_metadata_consistent" CHECK (("resource_upload_sessions"."operation" = 'create' and "resource_upload_sessions"."resource_id" is null and "resource_upload_sessions"."reserved_resource_id" is not null and num_nonnulls("resource_upload_sessions"."name", "resource_upload_sessions"."description") = 2 and jsonb_array_length("resource_upload_sessions"."categories") between 1 and 10) or ("resource_upload_sessions"."operation" = 'version' and "resource_upload_sessions"."resource_id" is not null and "resource_upload_sessions"."reserved_resource_id" is null and num_nonnulls("resource_upload_sessions"."name", "resource_upload_sessions"."description") = 0 and "resource_upload_sessions"."categories" = '[]'::jsonb and not "resource_upload_sessions"."is_private"));
