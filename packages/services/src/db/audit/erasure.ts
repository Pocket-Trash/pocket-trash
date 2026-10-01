import type {
  AuditJsonObject,
  ErasureInitiator,
  ErasureVerificationMethod,
} from "@package/database";
import type { AuditEventDefinition, AuditPayload } from "./index.js";

/** Safe request state recorded for account-erasure audit events. */
export type AccountErasureAuditData =
  | {
      /** Number of worker attempts made for the request. */
      attempts: number;
      /** Number of approved retention exceptions attached to the request. */
      exceptionCount: number;
      /** How the request was initiated. */
      initiator: ErasureInitiator;
      /** Initial request state. */
      status: "pending";
      /** Verification channel without its private reference. */
      verificationMethod: ErasureVerificationMethod;
    }
  | {
      /** Number of worker attempts made for the request. */
      attempts: number;
      /** Normalized terminal error code. */
      errorCode: string;
      /** Number of approved retention exceptions attached to the request. */
      exceptionCount: number;
      /** Initiation audit-event identifier, or null for an unexpected deletion. */
      initiationEventId: number | null;
      /** Terminal request state. */
      status: "needs_attention";
    }
  | {
      /** Number of worker attempts made for the request. */
      attempts: number;
      /** Number of approved retention exceptions attached to the request. */
      exceptionCount: number;
      /** Initiation audit-event identifier, or null for a legacy request. */
      initiationEventId: number | null;
      /** State after an administrator retry. */
      status: "pending";
    }
  | {
      /** Number of worker attempts made for the request. */
      attempts: number;
      /** Number of approved retention exceptions retained after completion. */
      exceptionCount: number;
      /** Initiation audit-event identifier, or null for a legacy request. */
      initiationEventId: number | null;
      /** Terminal request state. */
      status: "completed";
    };

/**
 * Creates an account-erasure audit definition.
 *
 * @param action - Namespaced erasure action.
 * @returns Account-erasure audit definition.
 */
function definition(action: string) {
  return {
    action,
    targetType: "account.erasure",
    /**
     * Preserves safe request state during account erasure.
     *
     * @param payload - Stored audit payload.
     * @returns Safe retained metadata.
     */
    redact(payload: {
      /** Stored safe metadata. */
      metadata?: AuditJsonObject | null;
    }): AuditPayload {
      return { metadata: payload.metadata ?? { redacted: true } };
    },
    /**
     * Serializes safe request state.
     *
     * @param data - Account-erasure state and counts.
     * @returns Audit metadata payload.
     */
    serialize(data: AccountErasureAuditData) {
      return { metadata: data };
    },
  } satisfies AuditEventDefinition<AccountErasureAuditData>;
}

/** Registered account-erasure audit-event definitions. */
export const accountErasureAudit = {
  completed: definition("account.erasure.completed"),
  needsAttention: definition("account.erasure.needs_attention"),
  requested: definition("account.erasure.requested"),
  retried: definition("account.erasure.retried"),
} as const;

/** Account-erasure definitions registered by the shared audit service. */
export const accountErasureAuditEvents = Object.values(
  accountErasureAudit,
) as readonly AuditEventDefinition<never>[];
