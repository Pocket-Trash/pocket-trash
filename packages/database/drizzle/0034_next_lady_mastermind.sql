TRUNCATE TABLE "resource_downloads";--> statement-breakpoint
ALTER TABLE "resource_downloads" DROP CONSTRAINT "resource_downloads_file_id_resource_files_id_fk";
--> statement-breakpoint
DROP INDEX "resource_downloads_file_id_idx";--> statement-breakpoint
ALTER TABLE "resource_downloads" ALTER COLUMN "version_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "resource_downloads" ADD COLUMN "user_clerk_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "resource_versions" ADD COLUMN "archive_object_path" text;--> statement-breakpoint
ALTER TABLE "resource_versions" ADD COLUMN "anonymous_download_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "resource_downloads" DROP COLUMN "file_id";--> statement-breakpoint
ALTER TABLE "resource_downloads" ADD CONSTRAINT "resource_downloads_version_user_unique" UNIQUE("version_id","user_clerk_id");--> statement-breakpoint
ALTER TABLE "resource_versions" ADD CONSTRAINT "resource_versions_archive_object_path_unique" UNIQUE("archive_object_path");--> statement-breakpoint
ALTER TABLE "resource_versions" ADD CONSTRAINT "resource_versions_anonymous_download_count_nonnegative" CHECK ("resource_versions"."anonymous_download_count" >= 0);
