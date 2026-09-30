ALTER TABLE "resources" ADD COLUMN "is_private" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "resources" ADD COLUMN "private_reason" text;--> statement-breakpoint
ALTER TABLE "resources" ADD COLUMN "privated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "resources" ADD COLUMN "privated_by_clerk_id" text;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_private_metadata_consistent" CHECK (("resources"."is_private" and num_nonnulls("resources"."private_reason", "resources"."privated_at", "resources"."privated_by_clerk_id") = 3) or (not "resources"."is_private" and num_nonnulls("resources"."private_reason", "resources"."privated_at", "resources"."privated_by_clerk_id") = 0));