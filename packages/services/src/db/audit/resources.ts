import type { AuditJsonObject } from "@package/database";
import { schema } from "@package/database";
import { count, eq } from "drizzle-orm";
import {
  type Actor,
  hasPermission,
  type Permission,
} from "../../authorization.js";
import type {
  AuditEventDefinition,
  AuditPayload,
  AuditRedactionContext,
  AuditService,
} from "./index.js";

/** Allowlisted resource state stored in audit events. */
export type ResourceAuditData = {
  /** State after the mutation. */
  after?: AuditJsonObject;
  /** State before the mutation. */
  before?: AuditJsonObject;
};

/** Resource owner, actor, and allowlisted state used by audit writes. */
export type ResourceAuditContext = {
  /** Internal actor identity. */
  actorUser: {
    /** Internal user identifier. */
    id: number;
    /** Username captured for the event. */
    username: string | null;
  };
  /** Owner's Clerk identifier used to select owner or permission authorization. */
  ownerClerkId: string;
  /** Internal owner identity retained for erasure redaction. */
  ownerUserId: number;
  /** Allowlisted resource state. */
  state: AuditJsonObject;
};

/** Database operations needed to read and write resource audit state. */
type ResourceAuditTransaction = Parameters<AuditService["write"]>[0];

/**
 * Creates a resource audit-event definition.
 *
 * @param action - Namespaced audit action.
 * @returns Resource audit-event definition.
 */
function definition(action: string) {
  return {
    action,
    targetType: "resources.resource",
    /**
     * Serializes allowlisted resource state.
     *
     * @param data - Resource state around the mutation.
     * @returns Audit before and after payload.
     */
    serialize: ({ after, before }: ResourceAuditData) => ({ after, before }),
    /**
     * Redacts resource state when an associated account is erased.
     *
     * @param payload - Stored audit payload.
     * @param context - Erased account relationship to the event.
     * @returns Redacted audit payload.
     */
    redact(
      payload: {
        /** Stored after state. */
        afterState?: AuditJsonObject | null;
        /** Stored before state. */
        beforeState?: AuditJsonObject | null;
        /** Stored metadata. */
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
  } satisfies AuditEventDefinition<ResourceAuditData>;
}

/** Registered resource audit-event definitions. */
export const resourceAudit = {
  created: definition("resources.resource.created"),
  purged: definition("resources.resource.purged"),
  restored: definition("resources.resource.restored"),
  softDeleted: definition("resources.resource.soft_deleted"),
  updated: definition("resources.resource.updated"),
  versionAdded: definition("resources.version.added"),
  visibilityChanged: definition("resources.resource.visibility_changed"),
} as const;

/** Resource definitions registered by the shared audit service. */
export const resourceAuditEvents = Object.values(
  resourceAudit,
) as readonly AuditEventDefinition<never>[];

/**
 * Validates owner or staff authorization for a resource audit event.
 *
 * @param actor - Actor performing the mutation.
 * @param context - Resource ownership context.
 * @param reason - Staff reason, when required.
 * @param explicitPermission - Permission required regardless of ownership.
 * @returns The permission and normalized reason used by audit provenance.
 * @throws When staff authorization or its required reason is missing.
 */
export function resourceAuditAuthorization(
  actor: Actor,
  context: ResourceAuditContext,
  reason?: string,
  explicitPermission?: Extract<
    Permission,
    "resources.manage" | "resources.purge"
  >,
) {
  const permission =
    explicitPermission ??
    (context.ownerClerkId !== actor.clerkId ? "resources.manage" : undefined);
  const normalizedReason = reason?.trim();
  if (permission && !hasPermission(actor, permission)) {
    throw new Error("Resource does not exist.");
  }
  if (permission && !normalizedReason) {
    throw new Error("A moderation reason is required.");
  }
  return { normalizedReason, permission };
}

/**
 * Loads the identities and allowlisted state required for a resource audit.
 *
 * @param transaction - Caller-owned database transaction.
 * @param actor - Actor performing the resource mutation.
 * @param resourceId - Resource being mutated.
 * @returns Resource audit context.
 * @rejects When the actor or resource does not exist, or the database query fails.
 */
export async function loadResourceAuditContext(
  transaction: ResourceAuditTransaction,
  actor: Actor,
  resourceId: number,
): Promise<ResourceAuditContext> {
  const [resource] = await transaction
    .select({
      createdAt: schema.resources.createdAt,
      deletedAt: schema.resources.deletedAt,
      deletedByRole: schema.resources.deletedByRole,
      description: schema.resources.description,
      id: schema.resources.id,
      isPrivate: schema.resources.isPrivate,
      name: schema.resources.name,
      ownerClerkId: schema.resources.uploaderClerkId,
      ownerUserId: schema.user.id,
      privateReason: schema.resources.privateReason,
      privatedAt: schema.resources.privatedAt,
    })
    .from(schema.resources)
    .innerJoin(
      schema.user,
      eq(schema.user.clerkId, schema.resources.uploaderClerkId),
    )
    .where(eq(schema.resources.id, resourceId))
    .limit(1);
  const [actorUser] = await transaction
    .select({ id: schema.user.id, username: schema.user.username })
    .from(schema.user)
    .where(eq(schema.user.clerkId, actor.clerkId))
    .limit(1);
  if (!resource || !actorUser) throw new Error("Resource does not exist.");

  const categories = await transaction
    .select({ id: schema.resourceCategories.id })
    .from(schema.resourcesToCategories)
    .innerJoin(
      schema.resourceCategories,
      eq(schema.resourceCategories.id, schema.resourcesToCategories.categoryId),
    )
    .where(eq(schema.resourcesToCategories.resourceId, resourceId))
    .orderBy(schema.resourceCategories.id);
  const images = await transaction
    .select({ id: schema.resourceImages.id })
    .from(schema.resourceImages)
    .where(eq(schema.resourceImages.resourceId, resourceId))
    .orderBy(schema.resourceImages.position, schema.resourceImages.id);
  const versions = await transaction
    .select({
      fileCount: count(schema.resourceFiles.id),
      id: schema.resourceVersions.id,
      version: schema.resourceVersions.version,
    })
    .from(schema.resourceVersions)
    .leftJoin(
      schema.resourceFiles,
      eq(schema.resourceFiles.versionId, schema.resourceVersions.id),
    )
    .where(eq(schema.resourceVersions.resourceId, resourceId))
    .groupBy(schema.resourceVersions.id)
    .orderBy(schema.resourceVersions.version);

  return {
    actorUser,
    ownerClerkId: resource.ownerClerkId,
    ownerUserId: resource.ownerUserId,
    state: {
      categoryIds: categories.map(({ id }) => id),
      createdAt: resource.createdAt.toISOString(),
      deletedAt: resource.deletedAt?.toISOString() ?? null,
      deletedByRole: resource.deletedByRole,
      description: resource.description,
      id: resource.id,
      imageIds: images.map(({ id }) => id),
      isPrivate: resource.isPrivate,
      name: resource.name,
      privateReason: resource.privateReason,
      privatedAt: resource.privatedAt?.toISOString() ?? null,
      versions: versions.map(({ fileCount, id, version }) => ({
        fileCount,
        id,
        version,
      })),
    },
  };
}

/**
 * Writes a resource audit event with owner or staff authorization provenance.
 *
 * @param audit - Shared audit service.
 * @param transaction - Caller-owned source transaction.
 * @param input - Resource event and identity context.
 * @returns Completion after the event is stored.
 * @rejects When authorization, validation, serialization, persistence, or operation logging fails.
 */
export async function writeResourceAudit(
  audit: AuditService,
  transaction: ResourceAuditTransaction,
  input: {
    /** Actor performing the mutation. */
    actor: Actor;
    /** Allowlisted state after the mutation. */
    after?: AuditJsonObject;
    /** Allowlisted state before the mutation. */
    before?: AuditJsonObject;
    /** Resource ownership and actor context. */
    context: ResourceAuditContext;
    /** Registered event definition. */
    definition: AuditEventDefinition<ResourceAuditData>;
    /** Explicit permission required for the operation. */
    permission?: Extract<Permission, "resources.manage" | "resources.purge">;
    /** Staff reason for the operation. */
    reason?: string;
    /** Resource identifier. */
    targetId: number;
  },
): Promise<void> {
  const { normalizedReason: reason, permission } = resourceAuditAuthorization(
    input.actor,
    input.context,
    input.reason,
    input.permission,
  );

  await audit.write(transaction, {
    actor: {
      role: input.actor.role,
      userId: input.context.actorUser.id,
      username: input.context.actorUser.username,
    },
    authorization: permission
      ? { permission, type: "permission" }
      : { type: "owner" },
    data: { after: input.after, before: input.before },
    definition: input.definition,
    occurredAt: new Date(),
    ownerUserId: input.context.ownerUserId,
    reason,
    targetId: String(input.targetId),
  });
}
