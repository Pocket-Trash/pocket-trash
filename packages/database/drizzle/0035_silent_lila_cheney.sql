ALTER TABLE "erasure_request" ADD COLUMN "verification_method" text;--> statement-breakpoint
ALTER TABLE "erasure_request" ADD COLUMN "verified_by_clerk_id" text;--> statement-breakpoint
ALTER TABLE "erasure_request" ADD COLUMN "verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "erasure_request" ADD CONSTRAINT "erasure_request_verification_method_valid" CHECK ("erasure_request"."verification_method" is null or "erasure_request"."verification_method" in ('clerk_reverification', 'authenticated_request', 'verified_email', 'clerk_webhook'));