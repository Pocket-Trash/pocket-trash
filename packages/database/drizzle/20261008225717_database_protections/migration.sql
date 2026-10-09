create function block_erasing_account_write() returns trigger
language plpgsql
as $$
declare
  column_name text;
  subject_id text;
begin
  foreach column_name in array tg_argv loop
    subject_id := to_jsonb(new) ->> column_name;
    if subject_id is null or subject_id = '' then
      continue;
    end if;

    perform pg_advisory_xact_lock(
      hashtextextended('account-erasure:' || subject_id, 0)
    );
    if exists (
      select 1 from erasure_request
      where target_clerk_id = subject_id
        and status in ('pending', 'running', 'needs_attention')
    ) then
      raise exception 'Account erasure is in progress.';
    end if;
  end loop;
  return new;
end;
$$;
--> statement-breakpoint
create trigger users_block_erasing_account_write
before insert or update of clerk_id on users
for each row execute function block_erasing_account_write('clerk_id');
--> statement-breakpoint
create trigger user_collection_block_erasing_account_write
before insert or update of privated_by_clerk_id on user_collection
for each row execute function block_erasing_account_write('privated_by_clerk_id');
--> statement-breakpoint
create trigger collection_item_block_erasing_account_write
before insert or update of privated_by_clerk_id on collection_item
for each row execute function block_erasing_account_write('privated_by_clerk_id');
--> statement-breakpoint
create trigger collection_image_block_erasing_account_write
before insert or update of uploaded_by_clerk_id on collection_image
for each row execute function block_erasing_account_write('uploaded_by_clerk_id');
--> statement-breakpoint
create trigger collection_item_image_block_erasing_account_write
before insert or update of uploaded_by_clerk_id, deleted_by_clerk_id on collection_item_image
for each row execute function block_erasing_account_write('uploaded_by_clerk_id', 'deleted_by_clerk_id');
--> statement-breakpoint
create trigger product_block_erasing_account_write
before insert or update of owner_clerk_id, privated_by_clerk_id on product
for each row execute function block_erasing_account_write('owner_clerk_id', 'privated_by_clerk_id');
--> statement-breakpoint
create trigger product_image_block_erasing_account_write
before insert or update of uploaded_by_clerk_id, deleted_by_clerk_id on product_image
for each row execute function block_erasing_account_write('uploaded_by_clerk_id', 'deleted_by_clerk_id');
--> statement-breakpoint
create trigger resources_block_erasing_account_write
before insert or update of uploader_clerk_id, privated_by_clerk_id, deleted_by_clerk_id on resources
for each row execute function block_erasing_account_write('uploader_clerk_id', 'privated_by_clerk_id', 'deleted_by_clerk_id');
--> statement-breakpoint
create trigger resource_categories_block_erasing_account_write
before insert or update of created_by_clerk_id on resource_categories
for each row execute function block_erasing_account_write('created_by_clerk_id');
--> statement-breakpoint
create trigger resource_downloads_block_erasing_account_write
before insert or update of user_clerk_id on resource_downloads
for each row execute function block_erasing_account_write('user_clerk_id');
--> statement-breakpoint
create trigger resource_notifications_block_erasing_account_write
before insert or update of uploader_clerk_id, read_by_clerk_id on resource_notifications
for each row execute function block_erasing_account_write('uploader_clerk_id', 'read_by_clerk_id');
--> statement-breakpoint
create trigger feedback_block_erasing_account_write
before insert or update of submitter_clerk_id on feedback
for each row execute function block_erasing_account_write('submitter_clerk_id');
--> statement-breakpoint
create trigger feedback_votes_block_erasing_account_write
before insert or update of voter_clerk_id on feedback_votes
for each row execute function block_erasing_account_write('voter_clerk_id');
--> statement-breakpoint
create trigger feedback_notifications_block_erasing_account_write
before insert or update of read_by_clerk_id on feedback_notifications
for each row execute function block_erasing_account_write('read_by_clerk_id');
--> statement-breakpoint
create trigger feature_flags_block_erasing_account_write
before insert or update of archived_by_clerk_id, created_by_clerk_id, updated_by_clerk_id on feature_flags
for each row execute function block_erasing_account_write('archived_by_clerk_id', 'created_by_clerk_id', 'updated_by_clerk_id');
--> statement-breakpoint
create trigger feature_flag_user_overrides_block_erasing_account_write
before insert or update of created_by_clerk_id, updated_by_clerk_id on feature_flag_user_overrides
for each row execute function block_erasing_account_write('created_by_clerk_id', 'updated_by_clerk_id');
--> statement-breakpoint
create trigger upload_session_block_erasing_account_write
before insert or update of uploader_clerk_id on upload_session
for each row execute function block_erasing_account_write('uploader_clerk_id');
--> statement-breakpoint
create trigger storage_object_deletion_block_erasing_account_write
before insert or update of owner_clerk_id on storage_object_deletion
for each row execute function block_erasing_account_write('owner_clerk_id');

--> statement-breakpoint
CREATE FUNCTION enforce_audit_event_append_only() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM audit_export
      WHERE id::text = current_setting('pocket_trash.audit_export_deletion', true)
        AND completed_at IS NOT NULL
        AND consumed_at IS NULL
        AND OLD.recorded_at < cutoff_at
        AND (
          OLD.recorded_at < high_water_recorded_at
          OR (
            OLD.recorded_at = high_water_recorded_at
            AND OLD.id <= high_water_event_id
          )
        )
    ) THEN
      RAISE EXCEPTION 'Audit events are append-only.';
    END IF;

    RETURN OLD;
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

--> statement-breakpoint
CREATE TRIGGER audit_export_block_erasing_account_write
BEFORE INSERT OR UPDATE OF requested_by_user_id ON audit_export
FOR EACH ROW EXECUTE FUNCTION block_erasing_account_user_id_write('requested_by_user_id');

--> statement-breakpoint
CREATE FUNCTION "protect_terminal_catalog_manifest_application"() RETURNS trigger AS $$
BEGIN
	IF TG_OP = 'DELETE'
		OR OLD."finished_at" IS NOT NULL
		OR NEW."id" IS DISTINCT FROM OLD."id"
		OR NEW."manifest_version" IS DISTINCT FROM OLD."manifest_version"
		OR NEW."manifest_hash" IS DISTINCT FROM OLD."manifest_hash"
		OR NEW."approval_payload_hash" IS DISTINCT FROM OLD."approval_payload_hash"
		OR NEW."operation" IS DISTINCT FROM OLD."operation"
		OR NEW."environment" IS DISTINCT FROM OLD."environment"
		OR NEW."owner_clerk_id" IS DISTINCT FROM OLD."owner_clerk_id"
		OR NEW."actor_clerk_id" IS DISTINCT FROM OLD."actor_clerk_id"
		OR NEW."record_count" IS DISTINCT FROM OLD."record_count"
		OR NEW."image_count" IS DISTINCT FROM OLD."image_count"
		OR NEW."total_bytes" IS DISTINCT FROM OLD."total_bytes"
		OR NEW."started_at" IS DISTINCT FROM OLD."started_at"
		OR NEW."outcome" = 'running'
	THEN
		RAISE EXCEPTION 'catalog manifest application history is immutable';
	END IF;
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER "catalog_manifest_application_immutable"
BEFORE UPDATE OR DELETE ON "catalog_manifest_application"
FOR EACH ROW EXECUTE FUNCTION "protect_terminal_catalog_manifest_application"();
