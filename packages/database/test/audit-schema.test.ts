import { getTableName } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { auditDelivery, auditEvent, auditExport } from "../src/schema/audit.js";

describe("audit delivery schema", () => {
  it("stores bounded retry state under a unique delivery key", () => {
    expect(getTableName(auditDelivery)).toBe("audit_delivery");
    expect(auditDelivery.deliveryKey.primary).toBe(true);
    expect(auditDelivery.payload.notNull).toBe(true);
    expect(auditDelivery.status.notNull).toBe(true);
    expect(auditDelivery.attempts.notNull).toBe(true);
    expect(auditDelivery.nextAttemptAt.notNull).toBe(true);

    const config = getTableConfig(auditDelivery);
    expect(config.checks.map(({ name }) => name)).toEqual(
      expect.arrayContaining([
        "audit_delivery_status_valid",
        "audit_delivery_attempts_valid",
        "audit_delivery_payload_size_valid",
      ]),
    );
    expect(config.indexes.map(({ config: { name } }) => name)).toContain(
      "audit_delivery_due_idx",
    );
  });
});

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

describe("audit export schema", () => {
  it("stores one bounded unconsumed export range without user foreign keys", () => {
    expect(getTableName(auditExport)).toBe("audit_export");
    expect(auditExport.id.primary).toBe(true);
    expect(auditExport.reason.notNull).toBe(true);
    expect(auditExport.cutoffAt.notNull).toBe(true);
    expect(auditExport.highWaterEventId.notNull).toBe(true);
    expect(auditExport.highWaterRecordedAt.notNull).toBe(true);
    expect(auditExport.eventCount.notNull).toBe(true);

    const config = getTableConfig(auditExport);
    expect(config.foreignKeys).toHaveLength(0);
    expect(config.checks.map(({ name }) => name)).toEqual(
      expect.arrayContaining([
        "audit_export_requester_role_valid",
        "audit_export_reason_valid",
        "audit_export_event_count_valid",
        "audit_export_checksum_valid",
        "audit_export_completion_valid",
        "audit_export_consumption_valid",
      ]),
    );
    expect(config.indexes.map(({ config: { name } }) => name)).toEqual(
      expect.arrayContaining([
        "audit_export_one_unconsumed_unique",
        "audit_export_requester_idx",
      ]),
    );
  });
});
