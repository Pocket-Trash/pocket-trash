CREATE TABLE "audit_export" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requested_by_user_id" bigint,
	"requested_by_username" text,
	"requested_by_role" text NOT NULL,
	"reason" text NOT NULL,
	"cutoff_at" timestamp with time zone NOT NULL,
	"high_water_event_id" bigint NOT NULL,
	"high_water_recorded_at" timestamp with time zone NOT NULL,
	"event_count" integer NOT NULL,
	"sha256" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"consumed_at" timestamp with time zone,
	CONSTRAINT "audit_export_requester_role_valid" CHECK ("audit_export"."requested_by_role" in ('editor', 'admin', 'system_admin')),
	CONSTRAINT "audit_export_reason_valid" CHECK (char_length(trim("audit_export"."reason")) between 1 and 500),
	CONSTRAINT "audit_export_event_count_valid" CHECK ("audit_export"."event_count" between 1 and 10000),
	CONSTRAINT "audit_export_checksum_valid" CHECK ("audit_export"."sha256" is null or "audit_export"."sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "audit_export_completion_valid" CHECK (("audit_export"."completed_at" is null and "audit_export"."sha256" is null)
        or ("audit_export"."completed_at" is not null and "audit_export"."sha256" is not null)),
	CONSTRAINT "audit_export_consumption_valid" CHECK ("audit_export"."consumed_at" is null or "audit_export"."completed_at" is not null)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "audit_export_one_unconsumed_unique" ON "audit_export" USING btree ((1)) WHERE "audit_export"."consumed_at" is null;--> statement-breakpoint
CREATE INDEX "audit_export_requester_idx" ON "audit_export" USING btree ("requested_by_user_id") WHERE "audit_export"."requested_by_user_id" is not null;--> statement-breakpoint
CREATE TRIGGER audit_export_block_erasing_account_write
BEFORE INSERT OR UPDATE OF requested_by_user_id ON audit_export
FOR EACH ROW EXECUTE FUNCTION block_erasing_account_user_id_write('requested_by_user_id');
