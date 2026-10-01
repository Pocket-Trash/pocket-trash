import type { AuditJsonObject } from "@package/database";
import { type Actor, hasPermission } from "../../authorization.js";
import type {
  AuditEventDefinition,
  AuditPayload,
  AuditRedactionContext,
  AuditService,
} from "./index.js";

/** Allowlisted feedback state stored around an administrative mutation. */
export type FeedbackAuditData = {
  /** State after the mutation. */
  after?: AuditJsonObject;
  /** State before the mutation. */
  before?: AuditJsonObject;
};

/**
 * Creates a feedback audit-event definition.
 *
 * @param action - Namespaced feedback action.
 * @returns Feedback audit-event definition.
 */
function definition(action: string) {
  return {
    action,
    targetType: "feedback.request",
    /**
     * Removes submitter-owned state while preserving unrelated staff actions.
     *
     * @param payload - Stored feedback state.
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
     * Serializes allowlisted feedback state.
     *
     * @param data - Feedback state around the mutation.
     * @returns Audit before and after payload.
     */
    serialize(data: FeedbackAuditData) {
      return { after: data.after, before: data.before };
    },
  } satisfies AuditEventDefinition<FeedbackAuditData>;
}

/** Registered feedback administration audit events. */
export const feedbackAudit = {
  approved: definition("feedback.request.approved"),
  denied: definition("feedback.request.denied"),
  merged: definition("feedback.request.merged"),
  updated: definition("feedback.request.updated"),
} as const;

/** Feedback definitions registered by the shared audit service. */
export const feedbackAuditEvents = Object.values(
  feedbackAudit,
) as readonly AuditEventDefinition<never>[];

/**
 * Writes an authorized feedback administration event.
 *
 * @param audit - Shared audit service.
 * @param transaction - Caller-owned source transaction.
 * @param input - Actor, owner, target, and allowlisted state.
 * @returns Completion after the event is stored.
 * @rejects When authorization, validation, serialization, persistence, or operation logging fails.
 */
export async function writeFeedbackAudit(
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
    /** Registered feedback event definition. */
    definition: AuditEventDefinition<FeedbackAuditData>;
    /** Internal submitter identifier used for erasure redaction. */
    ownerUserId: number;
    /** Feedback identifier. */
    targetId: number;
  },
): Promise<void> {
  if (!hasPermission(input.actor, "feedback.manage")) {
    throw new Error("Feedback does not exist.");
  }
  await audit.write(transaction, {
    actor: {
      role: input.actor.role,
      userId: input.actorUser.id,
      username: input.actorUser.username,
    },
    authorization: { permission: "feedback.manage", type: "permission" },
    data: { after: input.after, before: input.before },
    definition: input.definition,
    occurredAt: new Date(),
    ownerUserId: input.ownerUserId,
    targetId: String(input.targetId),
  });
}
