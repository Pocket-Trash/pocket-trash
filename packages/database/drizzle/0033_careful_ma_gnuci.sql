ALTER TABLE "feedback" ADD COLUMN "linear_client_uuid" uuid;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_linear_client_uuid_unique" UNIQUE("linear_client_uuid");--> statement-breakpoint
ALTER TABLE "feedback" DROP CONSTRAINT "feedback_approved_category_required";--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_approved_category_required" CHECK ("feedback"."status" in ('pending', 'merged', 'denied') or "feedback"."category" is not null);
