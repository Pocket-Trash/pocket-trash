import type { Database, FeatureFlag } from "@package/database";
import { schema } from "@package/database";
import {
  assertFeatureFlagSlug,
  type FeatureFlagAudience,
} from "@package/feature-flags";
import { type Logger, loggerMessages } from "@package/logger";
import { and, eq, inArray, isNull } from "drizzle-orm";
import type { UsersService } from "../db/users/index.js";
import { hashLogIdentifier } from "../logging.js";

export type FeatureFlagListItem = {
  archivedAt: Date | null;
  audience: FeatureFlagAudience;
  createdAt: Date;
  defaultEnabled: boolean;
  description: string | null;
  name: string;
  slug: string;
  updatedAt: Date;
};

export type UserBetaFeatureFlag = {
  description: string | null;
  enabled: boolean;
  name: string;
  slug: string;
};

export type AdminTargetingFeatureFlag = UserBetaFeatureFlag;

export type CreateFeatureFlagInput = {
  actorClerkId: string;
  audience: FeatureFlagAudience;
  defaultEnabled?: boolean;
  description?: string | null;
  name: string;
  slug: string;
};

export type UpdateFeatureFlagInput = {
  actorClerkId: string;
  defaultEnabled?: boolean;
  description?: string | null;
  name?: string;
  slug: string;
};

export type EvaluateFeatureFlagInput = {
  clerkId?: string;
  slug: string;
};

export type SetUserPreferenceInput = {
  actorClerkId: string;
  enabled: boolean;
  slug: string;
};

export type SetAdminOverrideInput = {
  actorClerkId: string;
  enabled: boolean;
  slug: string;
  targetClerkId: string;
};

export type FeatureFlagsService = {
  archive(input: { actorClerkId: string; slug: string }): Promise<void>;
  create(input: CreateFeatureFlagInput): Promise<FeatureFlagListItem>;
  evaluate(input: EvaluateFeatureFlagInput): Promise<boolean>;
  evaluateMany(input: {
    clerkId?: string;
    slugs: readonly string[];
  }): Promise<Record<string, boolean>>;
  listAdmin(): Promise<FeatureFlagListItem[]>;
  listAdminTargetingForUser(
    targetClerkId: string,
  ): Promise<AdminTargetingFeatureFlag[]>;
  listUserBeta(clerkId: string): Promise<UserBetaFeatureFlag[]>;
  setAdminOverride(input: SetAdminOverrideInput): Promise<void>;
  setUserPreference(input: SetUserPreferenceInput): Promise<void>;
  update(input: UpdateFeatureFlagInput): Promise<FeatureFlagListItem>;
};

export function createFeatureFlagsService(
  db: Database,
  usersService: UsersService,
  logger: Logger,
): FeatureFlagsService {
  return {
    async archive({ actorClerkId, slug }) {
      assertFeatureFlagSlug(slug);

      await logger.operation(
        loggerMessages.database.featureFlags.archive,
        async () => {
          await db
            .update(schema.featureFlags)
            .set({
              archivedAt: new Date(),
              archivedByClerkId: actorClerkId,
              updatedAt: new Date(),
              updatedByClerkId: actorClerkId,
            })
            .where(eq(schema.featureFlags.slug, slug));
        },
        operationAttributes({ actorClerkId, slug }),
      );
    },
    async create(input) {
      assertFeatureFlagSlug(input.slug);

      return await logger.operation(
        loggerMessages.database.featureFlags.create,
        async () => {
          const [flag] = await db
            .insert(schema.featureFlags)
            .values({
              audience: input.audience,
              createdByClerkId: input.actorClerkId,
              defaultEnabled: normalizedDefaultEnabled(input),
              description: input.description ?? null,
              name: input.name,
              slug: input.slug,
              updatedByClerkId: input.actorClerkId,
            })
            .returning();

          if (!flag) {
            throw new Error("Failed to create feature flag.");
          }

          return toListItem(flag);
        },
        operationAttributes({
          actorClerkId: input.actorClerkId,
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
    async setAdminOverride(input) {
      assertFeatureFlagSlug(input.slug);

      await logger.operation(
        loggerMessages.database.featureFlags.setAdminOverride,
        async () => {
          const flag = await getActiveFlagBySlug(db, input.slug);

          if (flag?.audience !== "admin") {
            await logFailedClosed(logger, input.slug, "invalid-admin-flag");
            return;
          }

          const user = await usersService.ensure({
            clerkId: input.targetClerkId,
          });

          await upsertOverride(db, {
            actorClerkId: input.actorClerkId,
            enabled: input.enabled,
            flagId: flag.id,
            source: "admin",
            userId: user.id,
          });
        },
        operationAttributes({
          actorClerkId: input.actorClerkId,
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
    async update(input) {
      assertFeatureFlagSlug(input.slug);

      return await logger.operation(
        loggerMessages.database.featureFlags.update,
        async () => {
          const current = await getFlagBySlug(db, input.slug);

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

          const [flag] = await db
            .update(schema.featureFlags)
            .set({
              defaultEnabled:
                current.audience === "global"
                  ? (input.defaultEnabled ?? current.defaultEnabled)
                  : false,
              description: input.description,
              name: input.name,
              updatedAt: new Date(),
              updatedByClerkId: input.actorClerkId,
            })
            .where(eq(schema.featureFlags.slug, input.slug))
            .returning();

          if (!flag) {
            throw new Error("Failed to update feature flag.");
          }

          return toListItem(flag);
        },
        operationAttributes({
          actorClerkId: input.actorClerkId,
          slug: input.slug,
        }),
      );
    },
  };
}

type OverrideRow = {
  enabled: boolean;
  flagId: string;
  source: "admin" | "user";
};

async function evaluateFlag(input: {
  clerkId?: string;
  db: Database;
  logger: Logger;
  slug: string;
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

async function upsertOverride(
  db: Database,
  input: {
    actorClerkId: string;
    enabled: boolean;
    flagId: string;
    source: "admin" | "user";
    userId: number;
  },
) {
  await db
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
    });
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

function operationAttributes(input: {
  actorClerkId?: string;
  audience?: FeatureFlagAudience;
  clerkId?: string;
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
