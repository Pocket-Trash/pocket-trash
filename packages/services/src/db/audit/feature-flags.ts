import type { AuditJsonObject } from "@package/database";
import { type Actor, hasPermission } from "../../authorization.js";
import type {
  AuditEventDefinition,
  AuditPayload,
  AuditRedactionContext,
  AuditService,
} from "./index.js";

/** Allowlisted feature-flag state stored around an administrative mutation. */
export type FeatureFlagAuditData = {
  /** State after the mutation. */
  after?: AuditJsonObject;
  /** State before the mutation. */
  before?: AuditJsonObject;
};

/**
 * Creates a feature-flag audit-event definition.
 *
 * @param action - Namespaced feature-flag action.
 * @param targetType - Stable feature-flag target type.
 * @returns Feature-flag audit-event definition.
 */
function definition(action: string, targetType: string) {
  return {
    action,
    targetType,
    /**
     * Removes targeted-user state while preserving unrelated staff actions.
     *
     * @param payload - Stored feature-flag state.
     * @param context - Erased account relationship to the event.
     * @returns Redacted audit payload.
     */
    redact(
      payload: {
        /** Stored after state. */
        afterState?: AuditJsonObject | null;
        /** Stored before state. */
        beforeState?: AuditJsonObject | null;
      },
      context: AuditRedactionContext,
    ): AuditPayload {
      return context.erasedParty === "actor"
        ? {
            ...(payload.afterState ? { after: payload.afterState } : {}),
            ...(payload.beforeState ? { before: payload.beforeState } : {}),
          }
        : { metadata: { redacted: true } };
    },
    /**
     * Serializes allowlisted feature-flag state.
     *
     * @param data - Feature-flag state around the mutation.
     * @returns Audit before and after payload.
     */
    serialize(data: FeatureFlagAuditData) {
      return { after: data.after, before: data.before };
    },
  } satisfies AuditEventDefinition<FeatureFlagAuditData>;
}

/** Registered feature-flag administration audit events. */
export const featureFlagAudit = {
  adminOverrideSet: definition(
    "feature_flags.user_override.set",
    "feature_flags.user_override",
  ),
  archived: definition("feature_flags.flag.archived", "feature_flags.flag"),
  created: definition("feature_flags.flag.created", "feature_flags.flag"),
  updated: definition("feature_flags.flag.updated", "feature_flags.flag"),
} as const;

/** Feature-flag definitions registered by the shared audit service. */
export const featureFlagAuditEvents = Object.values(
  featureFlagAudit,
) as readonly AuditEventDefinition<never>[];

/**
 * Writes an authorized feature-flag administration event.
 *
 * @param audit - Shared audit service.
 * @param transaction - Caller-owned source transaction.
 * @param input - Actor, optional target owner, and allowlisted state.
 * @returns Completion after the event is stored.
 * @rejects When authorization, validation, serialization, persistence, or operation logging fails.
 */
export async function writeFeatureFlagAudit(
  audit: AuditService,
  transaction: Parameters<AuditService["write"]>[0],
  input: {
    /** Authorized staff actor. */
    actor: Actor;
    /** Internal actor identity. */
    actorUser: {
      /** Internal user identifier. */
      id: number;
      /** Username captured for the event. */
      username: string | null;
    };
    /** Allowlisted state after the mutation. */
    after?: AuditJsonObject;
    /** Allowlisted state before the mutation. */
    before?: AuditJsonObject;
    /** Registered feature-flag event definition. */
    definition: AuditEventDefinition<FeatureFlagAuditData>;
    /** Internal targeted-user identifier used for erasure redaction. */
    ownerUserId?: number;
    /** Stable flag or override identifier. */
    targetId: string;
  },
): Promise<void> {
  if (!hasPermission(input.actor, "feature_flags.manage")) {
    throw new Error("Feature flag does not exist.");
  }
  await audit.write(transaction, {
    actor: {
      role: input.actor.role,
      userId: input.actorUser.id,
      username: input.actorUser.username,
    },
    authorization: {
      permission: "feature_flags.manage",
      type: "permission",
    },
    data: { after: input.after, before: input.before },
    definition: input.definition,
    occurredAt: new Date(),
    ownerUserId: input.ownerUserId,
    targetId: input.targetId,
  });
}
