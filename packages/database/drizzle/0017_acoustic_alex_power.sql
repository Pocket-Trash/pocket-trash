CREATE TABLE "resource_categories" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "resource_categories_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_by_clerk_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "resource_categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "resource_downloads" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "resource_downloads_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"version_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resource_versions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "resource_versions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"resource_id" bigint NOT NULL,
	"version" integer NOT NULL,
	"file_name" text NOT NULL,
	"content_type" text NOT NULL,
	"size" integer NOT NULL,
	"storage_provider" text DEFAULT 'bunny' NOT NULL,
	"object_path" text NOT NULL,
	"url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "resource_versions_resource_version_unique" UNIQUE("resource_id","version"),
	CONSTRAINT "resource_versions_object_path_unique" UNIQUE("object_path"),
	CONSTRAINT "resource_versions_version_positive" CHECK ("resource_versions"."version" > 0),
	CONSTRAINT "resource_versions_size_positive" CHECK ("resource_versions"."size" > 0)
);
--> statement-breakpoint
CREATE TABLE "resources" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "resources_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"uploader_clerk_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"preview_image_file_name" text,
	"preview_image_content_type" text,
	"preview_image_size" integer,
	"preview_image_object_path" text,
	"preview_image_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "resources_preview_metadata_consistent" CHECK (num_nonnulls("resources"."preview_image_file_name", "resources"."preview_image_content_type", "resources"."preview_image_size", "resources"."preview_image_object_path", "resources"."preview_image_url") in (0, 5))
);
--> statement-breakpoint
CREATE TABLE "resources_to_categories" (
	"resource_id" bigint NOT NULL,
	"category_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "resources_to_categories_resource_id_category_id_pk" PRIMARY KEY("resource_id","category_id")
);
--> statement-breakpoint
ALTER TABLE "resource_downloads" ADD CONSTRAINT "resource_downloads_version_id_resource_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."resource_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_versions" ADD CONSTRAINT "resource_versions_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resources_to_categories" ADD CONSTRAINT "resources_to_categories_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resources_to_categories" ADD CONSTRAINT "resources_to_categories_category_id_resource_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."resource_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "resource_downloads_version_id_idx" ON "resource_downloads" USING btree ("version_id");--> statement-breakpoint
CREATE INDEX "resource_versions_resource_id_idx" ON "resource_versions" USING btree ("resource_id");--> statement-breakpoint
CREATE INDEX "resources_created_at_idx" ON "resources" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "resources_uploader_clerk_id_idx" ON "resources" USING btree ("uploader_clerk_id");--> statement-breakpoint
CREATE INDEX "resources_to_categories_category_id_idx" ON "resources_to_categories" USING btree ("category_id");