import type { AuditJsonObject } from "@package/database";
import { type Actor, hasPermission } from "../../authorization.js";
import type {
  AuditEventDefinition,
  AuditPayload,
  AuditRedactionContext,
  AuditService,
} from "./index.js";

/** Before-and-after product state stored with an audit event. */
export type ProductAuditData = {
  /** Product state after the mutation. */
  after?: AuditJsonObject;
  /** Product state before the mutation. */
  before?: AuditJsonObject;
};

/**
 * Creates a product audit-event definition.
 *
 * @param action - Namespaced audit action.
 * @param targetType - Product entity recorded as the event target.
 * @returns Definition that serializes and redacts product state.
 */
function definition(action: string, targetType: string) {
  return {
    action,
    targetType,
    /**
     * Serializes product state for persistence.
     *
     * @param data - Product state surrounding the mutation.
     * @returns Serialized before-and-after state.
     */
    serialize: ({ after, before }: ProductAuditData) => ({ after, before }),
    /**
     * Redacts product state associated with an erased account.
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
  } satisfies AuditEventDefinition<ProductAuditData>;
}

/** Audit event definitions for product mutations. */
export const productAudit = {
  terminologyAliasCreated: definition(
    "products.terminology_alias.created",
    "products.terminology_alias",
  ),
  productApproved: definition("products.product.approved", "products.product"),
  productRejected: definition("products.product.rejected", "products.product"),
  productApprovalReversed: definition(
    "products.product.approval_reversed",
    "products.product",
  ),
  colorCreated: definition("products.color.created", "products.color"),
  finishCreated: definition("products.finish.created", "products.finish"),
  imageAdded: definition("products.image.added", "products.product"),
  imageDeleted: definition("products.image.deleted", "products.product"),
  imageRestored: definition("products.image.restored", "products.product"),
  makerCreated: definition("products.maker.created", "products.maker"),
  makerImageAdded: definition("products.maker_image.added", "products.maker"),
  makerImageDeleted: definition(
    "products.maker_image.deleted",
    "products.maker",
  ),
  makerImageRestored: definition(
    "products.maker_image.restored",
    "products.maker",
  ),
  makerUpdated: definition("products.maker.updated", "products.maker"),
  makerProductUrlValidityChanged: definition(
    "products.product.maker_url_validity_changed",
    "products.product",
  ),
  materialImageMoved: definition(
    "products.material_image.moved",
    "products.material",
  ),
  materialImagesReordered: definition(
    "products.material_images.reordered",
    "products.material",
  ),
  materialSpecificCreated: definition(
    "products.material_specific.created",
    "products.material_specific",
  ),
  materialSpecificUpdated: definition(
    "products.material_specific.updated",
    "products.material_specific",
  ),
  materialCreated: definition("products.material.created", "products.material"),
  materialImageAdded: definition(
    "products.material_image.added",
    "products.material",
  ),
  materialImageDeleted: definition(
    "products.material_image.deleted",
    "products.material",
  ),
  materialImageRestored: definition(
    "products.material_image.restored",
    "products.material",
  ),
  materialUpdated: definition("products.material.updated", "products.material"),
  patternCreated: definition("products.pattern.created", "products.pattern"),
  productCreated: definition("products.product.created", "products.product"),
  productDeleted: definition("products.product.deleted", "products.product"),
  productUpdated: definition("products.product.updated", "products.product"),
  productVisibilityChanged: definition(
    "products.product.visibility_changed",
    "products.product",
  ),
  sliderMagnetPresetCreated: definition(
    "products.slider_magnet_preset.created",
    "products.slider_magnet_preset",
  ),
  sliderMagnetPresetDeleted: definition(
    "products.slider_magnet_preset.deleted",
    "products.slider_magnet_preset",
  ),
  sliderMagnetPresetUpdated: definition(
    "products.slider_magnet_preset.updated",
    "products.slider_magnet_preset",
  ),
} as const;

/** Product audit definitions accepted by the audit service. */
export const productAuditEvents = Object.values(
  productAudit,
) as readonly AuditEventDefinition<never>[];

/**
 * Authorizes and writes an owner or moderator product audit event.
 *
 * @param audit - Audit service used to persist the event.
 * @param transaction - Transaction containing the product mutation.
 * @param input - Actor, ownership, target, and state-change details.
 * @rejects When authorization, validation, serialization, persistence, or operation logging fails.
 */
export async function writeProductAudit(
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
    /** Product state after the mutation. */
    after?: AuditJsonObject;
    /** Product state before the mutation. */
    before?: AuditJsonObject;
    /** Audit definition for the mutation. */
    definition: AuditEventDefinition<ProductAuditData>;
    /** Clerk ID of the product owner, or `null` when ownership is absent or erased. */
    ownerClerkId: string | null;
    /** Database user ID of the product owner, when present. */
    ownerUserId: number | null;
    /** Required explanation for staff moderation. */
    reason?: string;
    /** Product-related database ID. */
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

/**
 * Writes a staff-authorized product administration audit event.
 *
 * @param audit - Audit service used to persist the event.
 * @param transaction - Transaction containing the administrative mutation.
 * @param input - Administrator, target, and state-change details.
 * @rejects When authorization, validation, serialization, persistence, or operation logging fails.
 */
export async function writeProductAdminAudit(
  audit: AuditService,
  transaction: Parameters<AuditService["write"]>[0],
  input: {
    /** Authenticated administrator performing the mutation. */
    actor: Actor;
    /** Database identity recorded as the audit actor. */
    actorUser: {
      /** Internal user ID. */
      id: number;
      /** Username recorded with the event. */
      username: string | null;
    };
    /** Product state after the mutation. */
    after?: AuditJsonObject;
    /** Product state before the mutation. */
    before?: AuditJsonObject;
    /** Audit definition for the mutation. */
    definition: AuditEventDefinition<ProductAuditData>;
    /** Database user ID affected by the mutation, when present. */
    ownerUserId?: number | null;
    /** Source mutation time, defaulting to the time of the audit write. */
    occurredAt?: Date;
    /** Optional administrative reason. */
    reason?: string;
    /** Product-related database ID. */
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
    occurredAt: input.occurredAt ?? new Date(),
    ownerUserId: input.ownerUserId,
    reason: input.reason?.trim(),
    targetId: String(input.targetId),
  });
}
