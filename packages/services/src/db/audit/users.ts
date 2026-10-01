import type { AuditJsonObject } from "@package/database";
import type {
  AuditEventDefinition,
  AuditPayload,
  AuditRedactionContext,
} from "./index.js";

/** Safe access state recorded for a user-ban decision. */
export type UserBanAuditData = {
  /** Safe completed access state. */
  after: AuditJsonObject;
  /** Safe access state before the decision. */
  before: AuditJsonObject;
};

/**
 * Creates one user-ban audit definition.
 *
 * @param action - Registered user-ban action.
 * @returns User-ban audit definition.
 */
function definition(action: string) {
  return {
    action,
    targetType: "users.user",
    /**
     * Serializes safe user access state.
     *
     * @param data - State before and after the decision.
     * @returns Audit state payload.
     */
    serialize: ({ after, before }: UserBanAuditData) => ({ after, before }),
    /**
     * Redacts target state while preserving actor-only erasures.
     *
     * @param payload - Stored safe state snapshots.
     * @param context - Erased party relationship to the event.
     * @returns Redacted audit payload.
     */
    redact(
      payload: {
        /** Stored state after the decision. */
        afterState?: AuditJsonObject | null;
        /** Stored state before the decision. */
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
  } satisfies AuditEventDefinition<UserBanAuditData>;
}

/** Audit definitions for administrator-managed user access. */
export const userBanAudit = {
  banned: definition("user.banned"),
  banUpdated: definition("user.ban_updated"),
  unbanned: definition("user.unbanned"),
} as const;

/** User-ban definitions registered by the shared audit service. */
export const userBanAuditEvents = Object.values(
  userBanAudit,
) as readonly AuditEventDefinition<never>[];
