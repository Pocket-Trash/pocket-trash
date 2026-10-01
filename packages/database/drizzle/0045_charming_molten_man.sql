ALTER TABLE "feedback" ADD COLUMN "completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "feedback" ADD COLUMN "linear_updated_at" timestamp with time zone;--> statement-breakpoint
UPDATE "feedback" SET "completed_at" = "updated_at" WHERE "status" = 'completed';--> statement-breakpoint
CREATE INDEX "feedback_status_completed_at_idx" ON "feedback" USING btree ("status","completed_at");
