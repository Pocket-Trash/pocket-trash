CREATE TABLE "erasure_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject_hmac" text NOT NULL,
	"target_clerk_id" text,
	"initiator" text NOT NULL,
	"verification_reference" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"step_results" jsonb NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone,
	"error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "erasure_request_subject_hmac_unique" UNIQUE("subject_hmac"),
	CONSTRAINT "erasure_request_initiator_valid" CHECK ("erasure_request"."initiator" in ('self', 'admin')),
	CONSTRAINT "erasure_request_status_valid" CHECK ("erasure_request"."status" in ('pending', 'running', 'completed', 'needs_attention')),
	CONSTRAINT "erasure_request_attempts_valid" CHECK ("erasure_request"."attempts" >= 0),
	CONSTRAINT "erasure_request_completion_valid" CHECK (("erasure_request"."status" = 'completed') = ("erasure_request"."completed_at" is not null and "erasure_request"."expires_at" is not null and "erasure_request"."target_clerk_id" is null))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "erasure_request_target_clerk_id_unique" ON "erasure_request" USING btree ("target_clerk_id") WHERE "erasure_request"."target_clerk_id" is not null;--> statement-breakpoint
CREATE INDEX "erasure_request_due_idx" ON "erasure_request" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "erasure_request_expiry_idx" ON "erasure_request" USING btree ("expires_at");