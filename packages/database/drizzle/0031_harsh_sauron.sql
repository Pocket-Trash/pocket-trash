CREATE TABLE "feedback" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "feedback_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"submitter_clerk_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"category" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feedback_title_length_valid" CHECK (char_length("feedback"."title") between 1 and 120),
	CONSTRAINT "feedback_description_length_valid" CHECK (char_length("feedback"."description") between 1 and 5000),
	CONSTRAINT "feedback_approved_category_required" CHECK ("feedback"."status" in ('pending', 'denied') or "feedback"."category" is not null)
);
--> statement-breakpoint
CREATE TABLE "feedback_notifications" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "feedback_notifications_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"feedback_id" bigint NOT NULL,
	"type" text NOT NULL,
	"read_at" timestamp with time zone,
	"read_by_clerk_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feedback_notifications_read_metadata_consistent" CHECK (num_nonnulls("feedback_notifications"."read_at", "feedback_notifications"."read_by_clerk_id") in (0, 2))
);
--> statement-breakpoint
CREATE TABLE "feedback_votes" (
	"feedback_id" bigint NOT NULL,
	"voter_clerk_id" text NOT NULL,
	"is_permanent" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feedback_votes_feedback_id_voter_clerk_id_pk" PRIMARY KEY("feedback_id","voter_clerk_id")
);
--> statement-breakpoint
ALTER TABLE "feedback_notifications" ADD CONSTRAINT "feedback_notifications_feedback_id_feedback_id_fk" FOREIGN KEY ("feedback_id") REFERENCES "public"."feedback"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_votes" ADD CONSTRAINT "feedback_votes_feedback_id_feedback_id_fk" FOREIGN KEY ("feedback_id") REFERENCES "public"."feedback"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "feedback_submitter_status_idx" ON "feedback" USING btree ("submitter_clerk_id","status");--> statement-breakpoint
CREATE INDEX "feedback_status_created_at_idx" ON "feedback" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "feedback_notifications_created_at_idx" ON "feedback_notifications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "feedback_votes_voter_idx" ON "feedback_votes" USING btree ("voter_clerk_id");