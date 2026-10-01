CREATE TABLE "audit_delivery" (
	"delivery_key" text PRIMARY KEY NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_delivery_status_valid" CHECK ("audit_delivery"."status" in ('pending', 'processing', 'needs_attention')),
	CONSTRAINT "audit_delivery_attempts_valid" CHECK ("audit_delivery"."attempts" between 0 and 5),
	CONSTRAINT "audit_delivery_payload_size_valid" CHECK (octet_length("audit_delivery"."payload"::text) <= 270000)
);
--> statement-breakpoint
ALTER TABLE "user_ban" ADD COLUMN "pending_before_status" text;--> statement-breakpoint
ALTER TABLE "user_ban" ADD COLUMN "pending_request_id" uuid;--> statement-breakpoint
UPDATE "user_ban"
SET
	"pending_before_status" = CASE WHEN "status" = 'pending_unban' THEN 'banned' ELSE NULL END,
	"pending_request_id" = gen_random_uuid()
WHERE "status" in ('pending_ban', 'pending_unban');--> statement-breakpoint
CREATE INDEX "audit_delivery_due_idx" ON "audit_delivery" USING btree ("status","next_attempt_at");--> statement-breakpoint
ALTER TABLE "user_ban" ADD CONSTRAINT "user_ban_pending_audit_valid" CHECK (("user_ban"."status" in ('pending_ban', 'pending_unban')) = ("user_ban"."pending_request_id" is not null));
