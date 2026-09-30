import type { AuditJsonObject } from "@package/database";
import { type Actor, hasPermission } from "../../authorization.js";
import type {
  AuditEventDefinition,
  AuditPayload,
  AuditRedactionContext,
  AuditService,
} from "./index.js";

export type ProductAuditData = {
  after?: AuditJsonObject;
  before?: AuditJsonObject;
};

function definition(action: string, targetType: string) {
  return {
    action,
    targetType,
    serialize: ({ after, before }: ProductAuditData) => ({ after, before }),
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
  } satisfies AuditEventDefinition<ProductAuditData>;
}

export const productAudit = {
  colorCreated: definition("products.color.created", "products.color"),
  finishCreated: definition("products.finish.created", "products.finish"),
  imageAdded: definition("products.image.added", "products.product"),
  imageDeleted: definition("products.image.deleted", "products.product"),
  imageRestored: definition("products.image.restored", "products.product"),
  makerCreated: definition("products.maker.created", "products.maker"),
  makerProductUrlValidityChanged: definition(
    "products.product.maker_url_validity_changed",
    "products.product",
  ),
  materialCreated: definition("products.material.created", "products.material"),
  productCreated: definition("products.product.created", "products.product"),
  productUpdated: definition("products.product.updated", "products.product"),
  productVisibilityChanged: definition(
    "products.product.visibility_changed",
    "products.product",
  ),
} as const;

export const productAuditEvents = Object.values(
  productAudit,
) as readonly AuditEventDefinition<never>[];

export async function writeProductAudit(
  audit: AuditService,
  transaction: Parameters<AuditService["write"]>[0],
  input: {
    actor: Actor;
    actorUser: { id: number; username: string | null };
    after?: AuditJsonObject;
    before?: AuditJsonObject;
    definition: AuditEventDefinition<ProductAuditData>;
    ownerClerkId: string | null;
    ownerUserId: number | null;
    reason?: string;
    targetId: number;
  },
) {
  const moderating = input.ownerClerkId !== input.actor.clerkId;
  const reason = input.reason?.trim();
  if (moderating && !hasPermission(input.actor, "products.manage")) {
    throw new Error("Product does not exist.");
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
      ? { permission: "products.manage", type: "permission" }
      : { type: "owner" },
    data: { after: input.after, before: input.before },
    definition: input.definition,
    occurredAt: new Date(),
    ownerUserId: input.ownerUserId,
    reason,
    targetId: String(input.targetId),
  });
}

export async function writeProductAdminAudit(
  audit: AuditService,
  transaction: Parameters<AuditService["write"]>[0],
  input: {
    actor: Actor;
    actorUser: { id: number; username: string | null };
    after?: AuditJsonObject;
    before?: AuditJsonObject;
    definition: AuditEventDefinition<ProductAuditData>;
    ownerUserId?: number | null;
    reason?: string;
    targetId: number;
  },
) {
  if (!hasPermission(input.actor, "products.manage")) {
    throw new Error("Product does not exist.");
  }
  await audit.write(transaction, {
    actor: {
      role: input.actor.role,
      userId: input.actorUser.id,
      username: input.actorUser.username,
    },
    authorization: { permission: "products.manage", type: "permission" },
    data: { after: input.after, before: input.before },
    definition: input.definition,
    occurredAt: new Date(),
    ownerUserId: input.ownerUserId,
    reason: input.reason?.trim(),
    targetId: String(input.targetId),
  });
}
