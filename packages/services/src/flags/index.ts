import type {
  AuditJsonObject,
  Database,
  FeatureFlag,
  FeatureFlagUserOverride,
} from "@package/database";
import { schema } from "@package/database";
import {
  assertFeatureFlagSlug,
  type FeatureFlagAudience,
} from "@package/feature-flags";
import { type Logger, loggerMessages } from "@package/logger";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { type Actor, hasPermission } from "../authorization.js";
import {
  featureFlagAudit,
  writeFeatureFlagAudit,
} from "../db/audit/feature-flags.js";
import type { AuditService } from "../db/audit/index.js";
import type { UsersService } from "../db/users/index.js";
import { hashLogIdentifier } from "../logging.js";

/** Feature flag shown in administrative lists. */
export type FeatureFlagListItem = {
  /** Time the flag was archived, or null while active. */
  archivedAt: Date | null;
  /** Audience eligible to receive the flag. */
  audience: FeatureFlagAudience;
  /** Time the flag was created. */
  createdAt: Date;
  /** Default evaluation for global flags. */
  defaultEnabled: boolean;
  /** Optional administrator-facing description. */
  description: string | null;
  /** Administrator-facing flag name. */
  name: string;
  /** Stable feature-flag slug. */
  slug: string;
  /** Time the flag was last updated. */
  updatedAt: Date;
};

/** User-managed beta feature flag and its effective state. */
export type UserBetaFeatureFlag = {
  /** Optional user-facing description. */
  description: string | null;
  /** Effective evaluation for the user. */
  enabled: boolean;
  /** User-facing flag name. */
  name: string;
  /** Stable feature-flag slug. */
  slug: string;
};

/** Administrator-targeted feature flag and its override state. */
export type AdminTargetingFeatureFlag = UserBetaFeatureFlag;

/** Input for creating a feature flag through administration. */
export type CreateFeatureFlagInput = {
  /** Authorized staff actor. */
  actor: Actor;
  /** Audience that can receive the flag. */
  audience: FeatureFlagAudience;
  /** Default evaluation for global flags. */
  defaultEnabled?: boolean;
  /** Optional administrator-facing description. */
  description?: string | null;
  /** Administrator-facing flag name. */
  name: string;
  /** Stable feature-flag slug. */
  slug: string;
};

/** Input for updating a feature flag through administration. */
export type UpdateFeatureFlagInput = {
  /** Authorized staff actor. */
  actor: Actor;
  /** Updated default evaluation for global flags. */
  defaultEnabled?: boolean;
  /** Updated administrator-facing description. */
  description?: string | null;
  /** Updated administrator-facing flag name. */
  name?: string;
  /** Stable feature-flag slug. */
  slug: string;
};

/** Input for evaluating one feature flag. */
export type EvaluateFeatureFlagInput = {
  /** Optional Clerk identifier for audience evaluation. */
  clerkId?: string;
  /** Stable feature-flag slug. */
  slug: string;
};

/** Input for a user-managed beta preference. */
export type SetUserPreferenceInput = {
  /** Clerk identifier of the preference owner. */
  actorClerkId: string;
  /** Updated preference value. */
  enabled: boolean;
  /** Target feature-flag slug. */
  slug: string;
};

/** Input for setting an administrator-owned user override. */
export type SetAdminOverrideInput = {
  /** Authorized staff actor. */
  actor: Actor;
  /** Updated override value. */
  enabled: boolean;
  /** Target feature-flag slug. */
  slug: string;
  /** Clerk identifier of the targeted user. */
  targetClerkId: string;
};

/** Input for archiving a feature flag through administration. */
export type ArchiveFeatureFlagInput = {
  /** Authorized staff actor. */
  actor: Actor;
  /** Stable feature-flag slug. */
  slug: string;
};

/** Feature-flag persistence and evaluation operations. */
export type FeatureFlagsService = {
  /**
   * Archives a flag and its audit event transactionally.
   *
   * @param input - Authorized actor and target slug.
   * @returns Completion after the transaction commits.
   */
  archive(input: ArchiveFeatureFlagInput): Promise<void>;
  /**
   * Creates a flag and its audit event transactionally.
   *
   * @param input - Authorized feature-flag fields.
   * @returns Created feature flag.
   */
  create(input: CreateFeatureFlagInput): Promise<FeatureFlagListItem>;
  /**
   * Evaluates one flag, failing closed when it is unavailable.
   *
   * @param input - Flag slug and optional user identity.
   * @returns Effective evaluation.
   */
  evaluate(input: EvaluateFeatureFlagInput): Promise<boolean>;
  /**
   * Evaluates multiple slugs independently.
   *
   * @param input - Flag slugs and optional user identity.
   * @returns Effective evaluations keyed by slug.
   */
  evaluateMany(input: {
    /** Optional Clerk identifier for audience evaluation. */
    clerkId?: string;
    /** Stable feature-flag slugs to evaluate. */
    slugs: readonly string[];
  }): Promise<Record<string, boolean>>;
  /**
   * Lists every flag for administration.
   *
   * @returns Administrative feature-flag list.
   */
  listAdmin(): Promise<FeatureFlagListItem[]>;
  /**
   * Lists administrator-owned targeting values for one user.
   *
   * @param targetClerkId - Target user's Clerk identifier.
   * @returns Administrator-targeted flags and stored values.
   */
  listAdminTargetingForUser(
    targetClerkId: string,
  ): Promise<AdminTargetingFeatureFlag[]>;
  /**
   * Lists user-managed beta flags and effective values.
   *
   * @param clerkId - Requesting user's Clerk identifier.
   * @returns User beta flags and effective values.
   */
  listUserBeta(clerkId: string): Promise<UserBetaFeatureFlag[]>;
  /**
   * Sets an administrator override and its audit event transactionally.
   *
   * @param input - Authorized flag, user, and override value.
   * @returns Completion after the transaction commits.
   */
  setAdminOverride(input: SetAdminOverrideInput): Promise<void>;
  /**
   * Sets a user's own beta preference without administrative auditing.
   *
   * @param input - User-owned flag and preference value.
   * @returns Completion after persistence.
   */
  setUserPreference(input: SetUserPreferenceInput): Promise<void>;
  /**
   * Updates a flag and its audit event transactionally.
   *
   * @param input - Authorized feature-flag changes.
   * @returns Updated feature flag.
   */
  update(input: UpdateFeatureFlagInput): Promise<FeatureFlagListItem>;
};

/**
 * Creates the feature-flag service.
 *
 * @param db - Application database.
 * @param usersService - User persistence dependency.
 * @param logger - Application logger.
 * @param audit - Shared audit service.
 * @returns Configured feature-flag service.
 */
export function createFeatureFlagsService(
  db: Database,
  usersService: UsersService,
  logger: Logger,
  audit: AuditService,
): FeatureFlagsService {
  return {
    /**
     * Archives a feature flag with its audit event.
     *
     * @param root0 - Authorized actor and target slug.
     * @returns Completion after the transaction commits.
     * @rejects When authorization, persistence, or auditing fails.
     */
    async archive({ actor, slug }) {
      assertFeatureFlagSlug(slug);
      assertFeatureFlagAdmin(actor);

      await logger.operation(
        loggerMessages.database.featureFlags.archive,
        async () => {
          await db.transaction(async (tx) => {
            const [current] = await tx
              .select()
              .from(schema.featureFlags)
              .where(eq(schema.featureFlags.slug, slug))
              .limit(1)
              .for("update");
            if (!current) throw new Error("Feature flag not found.");
            const actorUser = await ensureFeatureFlagAuditUser(
              tx,
              actor.clerkId,
            );
            const archivedAt = new Date();
            const [flag] = await tx
              .update(schema.featureFlags)
              .set({
                archivedAt,
                archivedByClerkId: actor.clerkId,
                updatedAt: archivedAt,
                updatedByClerkId: actor.clerkId,
              })
              .where(eq(schema.featureFlags.slug, slug))
              .returning();
            if (!flag) throw new Error("Failed to archive feature flag.");
            await writeFeatureFlagAudit(audit, tx, {
              actor,
              actorUser,
              after: featureFlagAuditState(flag),
              before: featureFlagAuditState(current),
              definition: featureFlagAudit.archived,
              targetId: flag.id,
            });
          });
        },
        operationAttributes({ actorClerkId: actor.clerkId, slug }),
      );
    },
    /**
     * Creates a feature flag with its audit event.
     *
     * @param input - Authorized feature-flag fields.
     * @returns Created feature flag.
     * @rejects When authorization, persistence, or auditing fails.
     */
    async create(input) {
      assertFeatureFlagSlug(input.slug);
      assertFeatureFlagAdmin(input.actor);

      return await logger.operation(
        loggerMessages.database.featureFlags.create,
        async () => {
          return await db.transaction(async (tx) => {
            const actorUser = await ensureFeatureFlagAuditUser(
              tx,
              input.actor.clerkId,
            );
            const [flag] = await tx
              .insert(schema.featureFlags)
              .values({
                audience: input.audience,
                createdByClerkId: input.actor.clerkId,
                defaultEnabled: normalizedDefaultEnabled(input),
                description: input.description ?? null,
                name: input.name,
                slug: input.slug,
                updatedByClerkId: input.actor.clerkId,
              })
              .returning();

            if (!flag) {
              throw new Error("Failed to create feature flag.");
            }
            await writeFeatureFlagAudit(audit, tx, {
              actor: input.actor,
              actorUser,
              after: featureFlagAuditState(flag),
              definition: featureFlagAudit.created,
              targetId: flag.id,
            });
            return toListItem(flag);
          });
        },
        operationAttributes({
          actorClerkId: input.actor.clerkId,
          audience: input.audience,
          slug: input.slug,
        }),
      );
    },
    async evaluate({ clerkId, slug }) {
      assertFeatureFlagSlug(slug);

      return await logger.operation(
        loggerMessages.database.featureFlags.evaluate,
        async () => {
          return await evaluateFlag({
            clerkId,
            db,
            logger,
            slug,
            usersService,
          });
        },
        operationAttributes({ clerkId, slug }),
      );
    },
    async evaluateMany({ clerkId, slugs }) {
      const result: Record<string, boolean> = {};

      for (const slug of slugs) {
        result[slug] = await this.evaluate({ clerkId, slug });
      }

      return result;
    },
    async listAdmin() {
      return await logger.operation(
        loggerMessages.database.featureFlags.listAdmin,
        async () => {
          const flags = await db.select().from(schema.featureFlags);

          return flags.map(toListItem);
        },
      );
    },
    async listAdminTargetingForUser(targetClerkId) {
      return await logger.operation(
        loggerMessages.database.featureFlags.listAdminTargetingForUser,
        async () => {
          const user = await usersService.getByClerkId(targetClerkId);
          const flags = await listActiveFlagsByAudience(db, "admin");
          const overrides = user
            ? await listOverridesForUser(db, {
                flagIds: flags.map((flag) => flag.id),
                source: "admin",
                userId: user.id,
              })
            : [];

          return flags.map((flag) => ({
            description: flag.description,
            enabled:
              overrides.find((override) => override.flagId === flag.id)
                ?.enabled ?? false,
            name: flag.name,
            slug: flag.slug,
          }));
        },
        operationAttributes({ clerkId: targetClerkId }),
      );
    },
    async listUserBeta(clerkId) {
      return await logger.operation(
        loggerMessages.database.featureFlags.listUserBeta,
        async () => {
          const user = await usersService.getByClerkId(clerkId);
          const flags = await listActiveFlagsByAudience(db, "user");
          const overrides = user
            ? await listOverridesForUser(db, {
                flagIds: flags.map((flag) => flag.id),
                userId: user.id,
              })
            : [];

          return flags.map((flag) => ({
            description: flag.description,
            enabled: resolveUserFlagOverride(flag.id, overrides),
            name: flag.name,
            slug: flag.slug,
          }));
        },
        operationAttributes({ clerkId }),
      );
    },
    /**
     * Sets an administrator override with its audit event.
     *
     * @param input - Authorized flag, user, and override value.
     * @returns Completion after the transaction commits.
     * @rejects When authorization, persistence, or auditing fails.
     */
    async setAdminOverride(input) {
      assertFeatureFlagSlug(input.slug);
      assertFeatureFlagAdmin(input.actor);

      await logger.operation(
        loggerMessages.database.featureFlags.setAdminOverride,
        async () => {
          await db.transaction(async (tx) => {
            const [flag] = await tx
              .select()
              .from(schema.featureFlags)
              .where(
                and(
                  eq(schema.featureFlags.slug, input.slug),
                  isNull(schema.featureFlags.archivedAt),
                ),
              )
              .limit(1)
              .for("update");

            if (flag?.audience !== "admin") {
              await logFailedClosed(logger, input.slug, "invalid-admin-flag");
              return;
            }
            const actorUser = await ensureFeatureFlagAuditUser(
              tx,
              input.actor.clerkId,
            );
            const user =
              input.targetClerkId === input.actor.clerkId
                ? actorUser
                : await ensureFeatureFlagAuditUser(tx, input.targetClerkId);
            const [before] = await tx
              .select()
              .from(schema.featureFlagUserOverrides)
              .where(
                and(
                  eq(schema.featureFlagUserOverrides.flagId, flag.id),
                  eq(schema.featureFlagUserOverrides.userId, user.id),
                  eq(schema.featureFlagUserOverrides.source, "admin"),
                ),
              )
              .limit(1)
              .for("update");
            const override = await upsertOverride(tx, {
              actorClerkId: input.actor.clerkId,
              enabled: input.enabled,
              flagId: flag.id,
              source: "admin",
              userId: user.id,
            });
            await writeFeatureFlagAudit(audit, tx, {
              actor: input.actor,
              actorUser,
              after: overrideAuditState(flag.slug, override.enabled),
              before: before
                ? overrideAuditState(flag.slug, before.enabled)
                : undefined,
              definition: featureFlagAudit.adminOverrideSet,
              ownerUserId: user.id,
              targetId: override.id,
            });
          });
        },
        operationAttributes({
          actorClerkId: input.actor.clerkId,
          clerkId: input.targetClerkId,
          slug: input.slug,
        }),
      );
    },
    async setUserPreference(input) {
      assertFeatureFlagSlug(input.slug);

      await logger.operation(
        loggerMessages.database.featureFlags.setUserPreference,
        async () => {
          const flag = await getActiveFlagBySlug(db, input.slug);

          if (flag?.audience !== "user") {
            await logFailedClosed(logger, input.slug, "invalid-user-flag");
            return;
          }

          const user = await usersService.ensure({
            clerkId: input.actorClerkId,
          });

          await upsertOverride(db, {
            actorClerkId: input.actorClerkId,
            enabled: input.enabled,
            flagId: flag.id,
            source: "user",
            userId: user.id,
          });
        },
        operationAttributes({
          actorClerkId: input.actorClerkId,
          slug: input.slug,
        }),
      );
    },
    /**
     * Updates a feature flag with its audit event.
     *
     * @param input - Authorized feature-flag changes.
     * @returns Updated feature flag.
     * @rejects When authorization, persistence, or auditing fails.
     */
    async update(input) {
      assertFeatureFlagSlug(input.slug);
      assertFeatureFlagAdmin(input.actor);

      return await logger.operation(
        loggerMessages.database.featureFlags.update,
        async () => {
          return await db.transaction(async (tx) => {
            const [current] = await tx
              .select()
              .from(schema.featureFlags)
              .where(eq(schema.featureFlags.slug, input.slug))
              .limit(1)
              .for("update");

            if (!current) {
              throw new Error("Feature flag not found.");
            }

            const requestedAudience = requestedUpdateAudience(input);

            if (
              requestedAudience !== undefined &&
              requestedAudience !== current.audience
            ) {
              throw new Error("Feature flag audience cannot be changed.");
            }
            const actorUser = await ensureFeatureFlagAuditUser(
              tx,
              input.actor.clerkId,
            );

            const [flag] = await tx
              .update(schema.featureFlags)
              .set({
                defaultEnabled:
                  current.audience === "global"
                    ? (input.defaultEnabled ?? current.defaultEnabled)
                    : false,
                description: input.description,
                name: input.name,
                updatedAt: new Date(),
                updatedByClerkId: input.actor.clerkId,
              })
              .where(eq(schema.featureFlags.slug, input.slug))
              .returning();

            if (!flag) {
              throw new Error("Failed to update feature flag.");
            }
            await writeFeatureFlagAudit(audit, tx, {
              actor: input.actor,
              actorUser,
              after: featureFlagAuditState(flag),
              before: featureFlagAuditState(current),
              definition: featureFlagAudit.updated,
              targetId: flag.id,
            });
            return toListItem(flag);
          });
        },
        operationAttributes({
          actorClerkId: input.actor.clerkId,
          slug: input.slug,
        }),
      );
    },
  };
}

/** Feature-flag override fields used for evaluation. */
type OverrideRow = {
  /** Stored override value. */
  enabled: boolean;
  /** Target feature-flag identifier. */
  flagId: string;
  /** Party that owns the override. */
  source: "admin" | "user";
};

/**
 * Evaluates one feature flag and fails closed for invalid contexts.
 *
 * @param input - Database, logger, users, slug, and optional identity.
 * @returns Effective feature-flag evaluation.
 */
async function evaluateFlag(input: {
  /** Optional Clerk identifier for audience evaluation. */
  clerkId?: string;
  /** Application database. */
  db: Database;
  /** Application logger. */
  logger: Logger;
  /** Stable feature-flag slug. */
  slug: string;
  /** User persistence dependency. */
  usersService: UsersService;
}): Promise<boolean> {
  const flag = await getFlagBySlug(input.db, input.slug);

  if (!flag) {
    await logFailedClosed(input.logger, input.slug, "unknown");
    return false;
  }

  if (flag.archivedAt) {
    await logFailedClosed(input.logger, input.slug, "archived");
    return false;
  }

  if (flag.audience === "global") {
    return flag.defaultEnabled;
  }

  if (!input.clerkId) {
    await logFailedClosed(input.logger, input.slug, "missing-user");
    return false;
  }

  const user = await input.usersService.getByClerkId(input.clerkId);

  if (!user) {
    return false;
  }

  const overrides = await listOverridesForUser(input.db, {
    flagIds: [flag.id],
    userId: user.id,
  });

  if (flag.audience === "admin") {
    return (
      overrides.find((override) => override.source === "admin")?.enabled ??
      false
    );
  }

  return resolveUserFlagOverride(flag.id, overrides);
}

function normalizedDefaultEnabled(input: {
  audience: FeatureFlagAudience;
  defaultEnabled?: boolean;
}) {
  return input.audience === "global" ? (input.defaultEnabled ?? false) : false;
}

function requestedUpdateAudience(
  input: UpdateFeatureFlagInput,
): FeatureFlagAudience | undefined {
  const value = (input as { audience?: unknown }).audience;

  return value === "global" || value === "admin" || value === "user"
    ? value
    : undefined;
}

async function getFlagBySlug(db: Database, slug: string) {
  const [flag] = await db
    .select()
    .from(schema.featureFlags)
    .where(eq(schema.featureFlags.slug, slug))
    .limit(1);

  return flag ?? null;
}

async function getActiveFlagBySlug(db: Database, slug: string) {
  const [flag] = await db
    .select()
    .from(schema.featureFlags)
    .where(
      and(
        eq(schema.featureFlags.slug, slug),
        isNull(schema.featureFlags.archivedAt),
      ),
    )
    .limit(1);

  return flag ?? null;
}

async function listActiveFlagsByAudience(
  db: Database,
  audience: FeatureFlagAudience,
) {
  return await db
    .select()
    .from(schema.featureFlags)
    .where(
      and(
        eq(schema.featureFlags.audience, audience),
        isNull(schema.featureFlags.archivedAt),
      ),
    );
}

async function listOverridesForUser(
  db: Database,
  input: {
    flagIds: string[];
    source?: "admin" | "user";
    userId: number;
  },
): Promise<OverrideRow[]> {
  if (input.flagIds.length === 0) {
    return [];
  }

  const conditions = [
    eq(schema.featureFlagUserOverrides.userId, input.userId),
    inArray(schema.featureFlagUserOverrides.flagId, input.flagIds),
  ];

  if (input.source) {
    conditions.push(eq(schema.featureFlagUserOverrides.source, input.source));
  }

  return await db
    .select({
      enabled: schema.featureFlagUserOverrides.enabled,
      flagId: schema.featureFlagUserOverrides.flagId,
      source: schema.featureFlagUserOverrides.source,
    })
    .from(schema.featureFlagUserOverrides)
    .where(and(...conditions));
}

/**
 * Inserts or updates a feature-flag override.
 *
 * @param db - Database or caller-owned transaction.
 * @param input - Actor, target, source, and override value.
 * @returns Persisted override row.
 * @rejects When the override cannot be persisted.
 */
async function upsertOverride(
  db: Parameters<AuditService["write"]>[0],
  input: {
    /** Clerk identifier recorded in mutable source columns. */
    actorClerkId: string;
    /** Updated override value. */
    enabled: boolean;
    /** Target feature-flag identifier. */
    flagId: string;
    /** Party that owns the override. */
    source: "admin" | "user";
    /** Internal targeted-user identifier. */
    userId: number;
  },
): Promise<FeatureFlagUserOverride> {
  const [override] = await db
    .insert(schema.featureFlagUserOverrides)
    .values({
      createdByClerkId: input.actorClerkId,
      enabled: input.enabled,
      flagId: input.flagId,
      source: input.source,
      updatedByClerkId: input.actorClerkId,
      userId: input.userId,
    })
    .onConflictDoUpdate({
      set: {
        enabled: input.enabled,
        updatedAt: new Date(),
        updatedByClerkId: input.actorClerkId,
      },
      target: [
        schema.featureFlagUserOverrides.flagId,
        schema.featureFlagUserOverrides.userId,
        schema.featureFlagUserOverrides.source,
      ],
    })
    .returning();
  if (!override) throw new Error("Failed to set feature flag override.");
  return override;
}

/**
 * Ensures an audit-linked user in the caller's source transaction.
 *
 * @param transaction - Caller-owned source transaction.
 * @param clerkId - Clerk identifier to retain only through the user link.
 * @returns Internal user identity used by audit persistence.
 * @rejects When the identity cannot be persisted.
 */
async function ensureFeatureFlagAuditUser(
  transaction: Parameters<AuditService["write"]>[0],
  clerkId: string,
) {
  const [user] = await transaction
    .insert(schema.user)
    .values({ clerkId })
    .onConflictDoUpdate({ set: { clerkId }, target: schema.user.clerkId })
    .returning({ id: schema.user.id, username: schema.user.username });
  if (!user) throw new Error("Feature flag user does not exist.");
  return user;
}

/**
 * Rejects feature-flag administration by an actor without its permission.
 *
 * @param actor - Actor requesting an administrative mutation.
 * @returns Nothing after authorization succeeds.
 * @throws When the actor lacks feature-flag management permission.
 */
function assertFeatureFlagAdmin(actor: Actor): void {
  if (!hasPermission(actor, "feature_flags.manage")) {
    throw new Error("Feature flag does not exist.");
  }
}

/**
 * Serializes allowlisted feature-flag state.
 *
 * @param flag - Persisted feature flag.
 * @returns State suitable for audit persistence.
 */
function featureFlagAuditState(flag: FeatureFlag): AuditJsonObject {
  return {
    archivedAt: flag.archivedAt?.toISOString() ?? null,
    audience: flag.audience,
    defaultEnabled: flag.defaultEnabled,
    description: flag.description,
    name: flag.name,
    slug: flag.slug,
  };
}

/**
 * Serializes a targeted administrator override without personal identifiers.
 *
 * @param slug - Target feature-flag slug.
 * @param enabled - Stored override value.
 * @returns State suitable for audit persistence.
 */
function overrideAuditState(slug: string, enabled: boolean): AuditJsonObject {
  return { enabled, slug, source: "admin" };
}

function resolveUserFlagOverride(
  flagId: string,
  overrides: readonly OverrideRow[],
) {
  return (
    overrides.find(
      (override) => override.flagId === flagId && override.source === "user",
    )?.enabled ??
    overrides.find(
      (override) => override.flagId === flagId && override.source === "admin",
    )?.enabled ??
    false
  );
}

async function logFailedClosed(
  logger: Logger,
  slug: string,
  reason: string,
): Promise<void> {
  logger.error(loggerMessages.featureFlags.evaluationFailedClosed, {
    attributes: {
      reason,
      slug,
    },
  });
  await logger.flush();
}

/**
 * Hashes identifiers and builds structured feature-flag log attributes.
 *
 * @param input - Optional identifiers and audience for one operation.
 * @returns Structured logger attributes without raw user identifiers.
 */
function operationAttributes(input: {
  /** Optional acting Clerk identifier. */
  actorClerkId?: string;
  /** Optional feature-flag audience. */
  audience?: FeatureFlagAudience;
  /** Optional targeted Clerk identifier. */
  clerkId?: string;
  /** Optional feature-flag slug. */
  slug?: string;
}) {
  return {
    attributes: {
      ...(input.actorClerkId
        ? { actorClerkIdHash: hashLogIdentifier(input.actorClerkId) }
        : {}),
      ...(input.audience ? { audience: input.audience } : {}),
      ...(input.clerkId
        ? { clerkIdHash: hashLogIdentifier(input.clerkId) }
        : {}),
      ...(input.slug ? { slug: input.slug } : {}),
    },
  };
}

function toListItem(flag: FeatureFlag): FeatureFlagListItem {
  return {
    archivedAt: flag.archivedAt,
    audience: flag.audience,
    createdAt: flag.createdAt,
    defaultEnabled: flag.defaultEnabled,
    description: flag.description,
    name: flag.name,
    slug: flag.slug,
    updatedAt: flag.updatedAt,
  };
}
