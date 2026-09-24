CREATE TABLE "upload_file" (
	"id" uuid PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"position" integer NOT NULL,
	"file_name" text NOT NULL,
	"content_type" text NOT NULL,
	"size" integer NOT NULL,
	"sha256" text NOT NULL,
	"object_path" text NOT NULL,
	"url" text NOT NULL,
	"uploaded_at" timestamp with time zone,
	CONSTRAINT "upload_file_path_reserved" UNIQUE("object_path"),
	CONSTRAINT "upload_file_kind_hash_unique" UNIQUE("session_id","kind","sha256"),
	CONSTRAINT "upload_file_kind_valid" CHECK ("upload_file"."kind" in ('image','file')),
	CONSTRAINT "upload_file_size_valid" CHECK ("upload_file"."size" > 0),
	CONSTRAINT "upload_file_position_valid" CHECK ("upload_file"."position" >= 0),
	CONSTRAINT "upload_file_hash_valid" CHECK ("upload_file"."sha256" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "upload_session" (
	"id" uuid PRIMARY KEY NOT NULL,
	"uploader_clerk_id" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" bigint NOT NULL,
	"reserved_resource_id" bigint,
	"reserved_version" integer,
	"payload" jsonb,
	"expires_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "upload_session_target_type_valid" CHECK ("upload_session"."target_type" in ('product', 'collection', 'collection_item', 'resource')),
	CONSTRAINT "upload_session_target_id_valid" CHECK ("upload_session"."target_id" > 0),
	CONSTRAINT "upload_session_version_valid" CHECK ("upload_session"."reserved_version" is null or "upload_session"."reserved_version" > 0)
);
--> statement-breakpoint
DROP TABLE "catalog_image_upload_file" CASCADE;--> statement-breakpoint
DROP TABLE "catalog_image_upload_session" CASCADE;--> statement-breakpoint
DROP TABLE "resource_upload_files" CASCADE;--> statement-breakpoint
DROP TABLE "resource_upload_sessions" CASCADE;--> statement-breakpoint
ALTER TABLE "upload_file" ADD CONSTRAINT "upload_file_session_id_upload_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."upload_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "upload_file_session_idx" ON "upload_file" USING btree ("session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "upload_file_name_unique" ON "upload_file" USING btree ("session_id","kind",lower("file_name"));--> statement-breakpoint
CREATE INDEX "upload_session_expiry_idx" ON "upload_session" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "upload_session_owner_idx" ON "upload_session" USING btree ("uploader_clerk_id");--> statement-breakpoint
CREATE UNIQUE INDEX "upload_session_resource_version_reserved" ON "upload_session" USING btree ("target_id","reserved_version") WHERE "upload_session"."target_type" = 'resource' and "upload_session"."completed_at" is null;