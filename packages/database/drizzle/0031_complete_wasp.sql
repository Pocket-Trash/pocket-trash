CREATE TABLE "storage_object_deletion" (
	"object_path" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "storage_object_deletion_created_idx" ON "storage_object_deletion" USING btree ("created_at");