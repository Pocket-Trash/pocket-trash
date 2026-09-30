CREATE TABLE "audit_event" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_event_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"actor_user_id" bigint,
	"owner_user_id" bigint,
	"actor_username" text,
	"actor_role" text NOT NULL,
	"authorization_type" text NOT NULL,
	"permission" text,
	"reason" text,
	"before_state" jsonb,
	"after_state" jsonb,
	"metadata" jsonb,
	"request_id" text,
	"correlation_id" text,
	"occurred_at" timestamp with time zone NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_event_actor_role_valid" CHECK ("audit_event"."actor_role" in ('user', 'editor', 'admin', 'system_admin', 'system')),
	CONSTRAINT "audit_event_authorization_valid" CHECK ("audit_event"."authorization_type" in ('owner', 'permission', 'system')),
	CONSTRAINT "audit_event_authorization_metadata_consistent" CHECK ((
        "audit_event"."authorization_type" = 'permission'
        and "audit_event"."permission" is not null
        and "audit_event"."actor_role" <> 'system'
      ) or (
        "audit_event"."authorization_type" = 'owner'
        and "audit_event"."permission" is null
        and "audit_event"."actor_role" <> 'system'
      ) or (
        "audit_event"."authorization_type" = 'system'
        and "audit_event"."permission" is null
        and "audit_event"."actor_role" = 'system'
        and "audit_event"."actor_user_id" is null
        and "audit_event"."actor_username" is null
      )),
	CONSTRAINT "audit_event_payload_shape_valid" CHECK (num_nonnulls("audit_event"."before_state", "audit_event"."after_state", "audit_event"."metadata") > 0
        and ("audit_event"."metadata" is null or ("audit_event"."before_state" is null and "audit_event"."after_state" is null))),
	CONSTRAINT "audit_event_payload_size_valid" CHECK (octet_length(coalesce("audit_event"."before_state"::text, ''))
        + octet_length(coalesce("audit_event"."after_state"::text, ''))
        + octet_length(coalesce("audit_event"."metadata"::text, '')) <= 262144),
	CONSTRAINT "audit_event_reason_nonblank" CHECK ("audit_event"."reason" is null or char_length(trim("audit_event"."reason")) > 0)
);
--> statement-breakpoint
CREATE INDEX "audit_event_recorded_at_id_idx" ON "audit_event" USING btree ("recorded_at","id");--> statement-breakpoint
CREATE INDEX "audit_event_actor_recorded_at_id_idx" ON "audit_event" USING btree ("actor_user_id","recorded_at","id") WHERE "audit_event"."actor_user_id" is not null;--> statement-breakpoint
CREATE INDEX "audit_event_owner_user_id_idx" ON "audit_event" USING btree ("owner_user_id") WHERE "audit_event"."owner_user_id" is not null;--> statement-breakpoint
CREATE INDEX "audit_event_action_recorded_at_id_idx" ON "audit_event" USING btree ("action","recorded_at","id");--> statement-breakpoint
CREATE INDEX "audit_event_target_recorded_at_id_idx" ON "audit_event" USING btree ("target_type","target_id","recorded_at","id");
--> statement-breakpoint
CREATE FUNCTION enforce_audit_event_append_only() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Audit events are append-only.';
  END IF;

  IF current_setting('pocket_trash.audit_erasure_redaction', true) IS DISTINCT FROM 'on'
    OR NEW.id IS DISTINCT FROM OLD.id
    OR NEW.action IS DISTINCT FROM OLD.action
    OR NEW.target_type IS DISTINCT FROM OLD.target_type
    OR NEW.target_id IS DISTINCT FROM OLD.target_id
    OR NEW.actor_role IS DISTINCT FROM OLD.actor_role
    OR NEW.authorization_type IS DISTINCT FROM OLD.authorization_type
    OR NEW.permission IS DISTINCT FROM OLD.permission
    OR NEW.request_id IS DISTINCT FROM OLD.request_id
    OR NEW.correlation_id IS DISTINCT FROM OLD.correlation_id
    OR NEW.occurred_at IS DISTINCT FROM OLD.occurred_at
    OR NEW.recorded_at IS DISTINCT FROM OLD.recorded_at
    OR NOT (NEW.actor_user_id IS NULL OR NEW.actor_user_id IS NOT DISTINCT FROM OLD.actor_user_id)
    OR NOT (NEW.owner_user_id IS NULL OR NEW.owner_user_id IS NOT DISTINCT FROM OLD.owner_user_id)
    OR (
      NEW.actor_user_id IS NOT DISTINCT FROM OLD.actor_user_id
      AND NEW.actor_username IS DISTINCT FROM OLD.actor_username
    )
  THEN
    RAISE EXCEPTION 'Audit events are append-only.';
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER audit_event_append_only
BEFORE UPDATE OR DELETE ON audit_event
FOR EACH ROW EXECUTE FUNCTION enforce_audit_event_append_only();
--> statement-breakpoint
CREATE FUNCTION block_erasing_account_user_id_write() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  column_name text;
  internal_user_id bigint;
  subject_id text;
BEGIN
  FOREACH column_name IN ARRAY TG_ARGV LOOP
    internal_user_id := (to_jsonb(NEW) ->> column_name)::bigint;
    IF internal_user_id IS NULL THEN
      CONTINUE;
    END IF;

    SELECT clerk_id INTO subject_id FROM users WHERE id = internal_user_id;
    IF subject_id IS NULL THEN
      CONTINUE;
    END IF;

    PERFORM pg_advisory_xact_lock(
      hashtextextended('account-erasure:' || subject_id, 0)
    );
    IF EXISTS (
      SELECT 1 FROM erasure_request
      WHERE target_clerk_id = subject_id
        AND status IN ('pending', 'running', 'needs_attention')
    ) THEN
      RAISE EXCEPTION 'Account erasure is in progress.';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER audit_event_block_erasing_account_write
BEFORE INSERT OR UPDATE OF actor_user_id, owner_user_id ON audit_event
FOR EACH ROW EXECUTE FUNCTION block_erasing_account_user_id_write('actor_user_id', 'owner_user_id');
