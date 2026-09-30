CREATE TABLE "resource_upload_files" (
	"id" uuid PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"file_name" text NOT NULL,
	"content_type" text NOT NULL,
	"size" integer NOT NULL,
	"object_path" text NOT NULL,
	"url" text NOT NULL,
	"uploaded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "resource_upload_files_object_path_unique" UNIQUE("object_path"),
	CONSTRAINT "resource_upload_files_kind_valid" CHECK ("resource_upload_files"."kind" in ('resource', 'preview')),
	CONSTRAINT "resource_upload_files_size_positive" CHECK ("resource_upload_files"."size" > 0)
);
--> statement-breakpoint
CREATE TABLE "resource_upload_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"uploader_clerk_id" text NOT NULL,
	"operation" text NOT NULL,
	"resource_id" bigint,
	"name" text,
	"description" text,
	"categories" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"completed_resource_id" bigint,
	"completed_version" integer,
	"expires_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "resource_upload_sessions_operation_valid" CHECK ("resource_upload_sessions"."operation" in ('create', 'version')),
	CONSTRAINT "resource_upload_sessions_metadata_consistent" CHECK (("resource_upload_sessions"."operation" = 'create' and "resource_upload_sessions"."resource_id" is null and num_nonnulls("resource_upload_sessions"."name", "resource_upload_sessions"."description") = 2 and jsonb_array_length("resource_upload_sessions"."categories") between 1 and 10) or ("resource_upload_sessions"."operation" = 'version' and "resource_upload_sessions"."resource_id" is not null and num_nonnulls("resource_upload_sessions"."name", "resource_upload_sessions"."description") = 0 and "resource_upload_sessions"."categories" = '[]'::jsonb)),
	CONSTRAINT "resource_upload_sessions_completion_consistent" CHECK (num_nonnulls("resource_upload_sessions"."completed_resource_id", "resource_upload_sessions"."completed_version", "resource_upload_sessions"."completed_at") in (0, 3))
);
--> statement-breakpoint
ALTER TABLE "resource_upload_files" ADD CONSTRAINT "resource_upload_files_session_id_resource_upload_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."resource_upload_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_upload_sessions" ADD CONSTRAINT "resource_upload_sessions_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_upload_sessions" ADD CONSTRAINT "resource_upload_sessions_completed_resource_id_resources_id_fk" FOREIGN KEY ("completed_resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "resource_upload_files_session_id_idx" ON "resource_upload_files" USING btree ("session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "resource_upload_files_session_file_name_unique" ON "resource_upload_files" USING btree ("session_id",lower("file_name")) WHERE "resource_upload_files"."kind" = 'resource';--> statement-breakpoint
CREATE UNIQUE INDEX "resource_upload_files_session_preview_unique" ON "resource_upload_files" USING btree ("session_id") WHERE "resource_upload_files"."kind" = 'preview';--> statement-breakpoint
CREATE INDEX "resource_upload_sessions_expires_at_idx" ON "resource_upload_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "resource_upload_sessions_uploader_clerk_id_idx" ON "resource_upload_sessions" USING btree ("uploader_clerk_id");