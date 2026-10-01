import type { AuditJsonObject } from "@package/database";
import { type Actor, hasPermission } from "../../authorization.js";
import type {
  AuditEventDefinition,
  AuditPayload,
  AuditRedactionContext,
  AuditService,
} from "./index.js";

/** Before-and-after collection state stored with an audit event. */
export type CollectionAuditData = {
  /** Collection state after the mutation. */
  after?: AuditJsonObject;
  /** Collection state before the mutation. */
  before?: AuditJsonObject;
};

/**
 * Creates a collection audit-event definition.
 *
 * @param action - Namespaced audit action.
 * @param targetType - Collection entity recorded as the event target.
 * @returns Definition that serializes and redacts collection state.
 */
function definition(
  action: string,
  targetType: "collections.collection" | "collections.item",
) {
  return {
    action,
    targetType,
    /**
     * Serializes collection state for persistence.
     *
     * @param data - Collection state surrounding the mutation.
     * @returns Serialized before-and-after state.
     */
    serialize: ({ after, before }: CollectionAuditData) => ({ after, before }),
    /**
     * Redacts collection state associated with an erased account.
     *
     * @param payload - Stored audit payload.
     * @param context - Account-erasure relationship to the event.
     * @returns State retained for actor erasure, or a redaction marker for owner erasure.
     */
    redact(
      payload: {
        /** Stored state after the mutation. */
        afterState?: AuditJsonObject | null;
        /** Stored state before the mutation. */
        beforeState?: AuditJsonObject | null;
        /** Stored event metadata. */
        metadata?: AuditJsonObject | null;
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
  } satisfies AuditEventDefinition<CollectionAuditData>;
}

/** Audit event definitions for collection mutations. */
export const collectionAudit = {
  collectionCreated: definition(
    "collections.collection.created",
    "collections.collection",
  ),
  collectionDeleted: definition(
    "collections.collection.deleted",
    "collections.collection",
  ),
  collectionUpdated: definition(
    "collections.collection.updated",
    "collections.collection",
  ),
  collectionVisibilityChanged: definition(
    "collections.collection.visibility_changed",
    "collections.collection",
  ),
  coverAdded: definition("collections.cover.added", "collections.collection"),
  coverReplaced: definition(
    "collections.cover.replaced",
    "collections.collection",
  ),
  coverSelected: definition(
    "collections.cover.selected",
    "collections.collection",
  ),
  coverCleared: definition(
    "collections.cover.cleared",
    "collections.collection",
  ),
  coverDeleted: definition(
    "collections.cover.deleted",
    "collections.collection",
  ),
  itemCreated: definition("collections.item.created", "collections.item"),
  itemUpdated: definition("collections.item.updated", "collections.item"),
  itemMoved: definition("collections.item.moved", "collections.item"),
  itemVisibilityChanged: definition(
    "collections.item.visibility_changed",
    "collections.item",
  ),
  imageAdded: definition("collections.image.added", "collections.item"),
  imageDeleted: definition("collections.image.deleted", "collections.item"),
  imageRestored: definition("collections.image.restored", "collections.item"),
} as const;

/** Collection audit definitions accepted by the audit service. */
export const collectionAuditEvents = Object.values(
  collectionAudit,
) as readonly AuditEventDefinition<never>[];

/**
 * Authorizes and writes a collection mutation audit event.
 *
 * @param audit - Audit service used to persist the event.
 * @param transaction - Transaction containing the collection mutation.
 * @param input - Actor, ownership, target, and state-change details.
 * @rejects When authorization, validation, serialization, persistence, or operation logging fails.
 */
export async function writeCollectionAudit(
  audit: AuditService,
  transaction: Parameters<AuditService["write"]>[0],
  input: {
    /** Authenticated actor performing the mutation. */
    actor: Actor;
    /** Database identity recorded as the audit actor. */
    actorUser: {
      /** Internal user ID. */
      id: number;
      /** Username recorded with the event. */
      username: string | null;
    };
    /** Collection state after the mutation. */
    after?: AuditJsonObject;
    /** Collection state before the mutation. */
    before?: AuditJsonObject;
    /** Audit definition for the mutation. */
    definition: AuditEventDefinition<CollectionAuditData>;
    /** Database user ID that owns the collection. */
    ownerUserId: number;
    /** Required explanation for staff moderation. */
    reason?: string;
    /** Collection or collection-item database ID. */
    targetId: number;
  },
) {
  const moderating = input.actorUser.id !== input.ownerUserId;
  const reason = input.reason?.trim();
  if (moderating && !hasPermission(input.actor, "collections.manage")) {
    throw new Error("Collection does not exist.");
  }
  if (moderating && !reason)
    throw new Error("A moderation reason is required.");
  await audit.write(transaction, {
    actor: {
      role: input.actor.role,
      userId: input.actorUser.id,
      username: input.actorUser.username,
    },
    authorization: moderating
      ? { permission: "collections.manage", type: "permission" }
      : { type: "owner" },
    data: { after: input.after, before: input.before },
    definition: input.definition,
    occurredAt: new Date(),
    ownerUserId: input.ownerUserId,
    reason,
    targetId: String(input.targetId),
  });
}
