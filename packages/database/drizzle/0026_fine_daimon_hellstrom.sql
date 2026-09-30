ALTER TABLE "resource_downloads" DROP CONSTRAINT "resource_downloads_version_id_resource_versions_id_fk";
--> statement-breakpoint
ALTER TABLE "resource_downloads" DROP CONSTRAINT "resource_downloads_file_id_resource_files_id_fk";
--> statement-breakpoint
ALTER TABLE "resource_downloads" ADD CONSTRAINT "resource_downloads_version_id_resource_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."resource_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_downloads" ADD CONSTRAINT "resource_downloads_file_id_resource_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."resource_files"("id") ON DELETE cascade ON UPDATE no action;