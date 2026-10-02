-- A previously deployed audit-export migration had a later timestamp than 0045,
-- so Drizzle skipped the feedback lifecycle migration on those databases.
ALTER TABLE "feedback" ADD COLUMN IF NOT EXISTS "completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "feedback" ADD COLUMN IF NOT EXISTS "linear_updated_at" timestamp with time zone;--> statement-breakpoint
UPDATE "feedback" SET "completed_at" = "updated_at" WHERE "status" = 'completed' AND "completed_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feedback_status_completed_at_idx" ON "feedback" USING btree ("status","completed_at");
