import { getTableName } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { auditEvent } from "../src/schema/audit.js";

describe("audit event schema", () => {
  it("stores append-only event snapshots without mutable foreign keys", () => {
    expect(getTableName(auditEvent)).toBe("audit_event");
    expect(auditEvent.id.primary).toBe(true);
    expect(auditEvent.action.notNull).toBe(true);
    expect(auditEvent.targetType.notNull).toBe(true);
    expect(auditEvent.targetId.notNull).toBe(true);
    expect(auditEvent.actorUserId.notNull).toBe(false);
    expect(auditEvent.ownerUserId.notNull).toBe(false);
    expect(auditEvent.actorRole.notNull).toBe(true);
    expect(auditEvent.authorizationType.notNull).toBe(true);
    expect(auditEvent.occurredAt.notNull).toBe(true);
    expect(auditEvent.recordedAt.notNull).toBe(true);

    const config = getTableConfig(auditEvent);
    expect(config.foreignKeys).toHaveLength(0);
    expect(config.checks.map(({ name }) => name)).toEqual(
      expect.arrayContaining([
        "audit_event_actor_role_valid",
        "audit_event_authorization_valid",
        "audit_event_authorization_metadata_consistent",
        "audit_event_payload_shape_valid",
        "audit_event_payload_size_valid",
        "audit_event_reason_nonblank",
      ]),
    );
    expect(config.indexes.map(({ config: { name } }) => name)).toEqual(
      expect.arrayContaining([
        "audit_event_recorded_at_id_idx",
        "audit_event_actor_recorded_at_id_idx",
        "audit_event_owner_user_id_idx",
        "audit_event_action_recorded_at_id_idx",
        "audit_event_target_recorded_at_id_idx",
      ]),
    );
  });
});
