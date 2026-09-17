CREATE TABLE "resource_notifications" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "resource_notifications_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"type" text NOT NULL,
	"resource_id" bigint NOT NULL,
	"category_id" bigint,
	"uploader_clerk_id" text NOT NULL,
	"read_at" timestamp with time zone,
	"read_by_clerk_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "resource_notifications_type_valid" CHECK ("resource_notifications"."type" in ('resource_created', 'category_created')),
	CONSTRAINT "resource_notifications_category_matches_type" CHECK (("resource_notifications"."type" = 'category_created') = ("resource_notifications"."category_id" is not null)),
	CONSTRAINT "resource_notifications_read_metadata_consistent" CHECK (num_nonnulls("resource_notifications"."read_at", "resource_notifications"."read_by_clerk_id") in (0, 2))
);
--> statement-breakpoint
ALTER TABLE "resource_notifications" ADD CONSTRAINT "resource_notifications_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_notifications" ADD CONSTRAINT "resource_notifications_category_id_resource_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."resource_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "resource_notifications_created_at_idx" ON "resource_notifications" USING btree ("created_at");