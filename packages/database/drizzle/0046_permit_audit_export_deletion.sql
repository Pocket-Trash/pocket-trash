CREATE OR REPLACE FUNCTION enforce_audit_event_append_only() RETURNS trigger
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
