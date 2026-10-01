import type { AuditJsonObject } from "@package/database";
import { type Actor, hasPermission } from "../../authorization.js";
import type {
  AuditEventDefinition,
  AuditPayload,
  AuditRedactionContext,
  AuditService,
} from "./index.js";

export type CollectionAuditData = {
  after?: AuditJsonObject;
  before?: AuditJsonObject;
};

function definition(
  action: string,
  targetType: "collections.collection" | "collections.item",
) {
  return {
    action,
    targetType,
    serialize: ({ after, before }: CollectionAuditData) => ({ after, before }),
    redact(
      payload: {
        afterState?: AuditJsonObject | null;
        beforeState?: AuditJsonObject | null;
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

export const collectionAuditEvents = Object.values(
  collectionAudit,
) as readonly AuditEventDefinition<never>[];

export async function writeCollectionAudit(
  audit: AuditService,
  transaction: Parameters<AuditService["write"]>[0],
  input: {
    actor: Actor;
    actorUser: { id: number; username: string | null };
    after?: AuditJsonObject;
    before?: AuditJsonObject;
    definition: AuditEventDefinition<CollectionAuditData>;
    ownerUserId: number;
    reason?: string;
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
