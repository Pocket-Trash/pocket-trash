import type { Database, User } from "@package/database";
import { schema } from "@package/database";
import { type Logger, loggerMessages } from "@package/logger";
import { and, eq, isNull, lt, or } from "drizzle-orm";
import { hashLogIdentifier } from "../../logging.js";

export type EnsureUserInput = {
  clerkId: string;
};

export type UsersService = {
  ensure(input: EnsureUserInput): Promise<User>;
  getByClerkId(clerkId: string): Promise<User | null>;
  syncFromClerk(input: SyncUserFromClerkInput): Promise<UserSyncResult>;
};

export type SyncUserFromClerkInput = {
  clerkId: string;
  clerkUpdatedAt: Date;
  username: string;
};

export type UserSyncResult = "inserted" | "unchanged" | "updated";

function assertClerkId(clerkId: string): void {
  if (!clerkId.trim()) {
    throw new Error("clerkId is required.");
  }
}

function normalizeSyncInput(input: SyncUserFromClerkInput) {
  const clerkId = input.clerkId.trim();
  const username = input.username.trim();
  assertClerkId(clerkId);
  if (!username) throw new Error("username is required.");
  if (Number.isNaN(input.clerkUpdatedAt.getTime())) {
    throw new Error("clerkUpdatedAt is required.");
  }
  return { ...input, clerkId, username };
}

export function createUsersService(db: Database, logger: Logger): UsersService {
  return {
    async ensure({ clerkId }) {
      return await logger.operation(
        loggerMessages.database.users.ensure,
        async () => {
          assertClerkId(clerkId);

          const [user] = await db
            .insert(schema.users)
            .values({ clerkId })
            .onConflictDoUpdate({
              set: { clerkId },
              target: schema.users.clerkId,
            })
            .returning();

          if (!user) {
            throw new Error("Failed to ensure user.");
          }

          return user;
        },
        {
          attributes: {
            clerkIdHash: hashLogIdentifier(clerkId),
          },
        },
      );
    },
    async getByClerkId(clerkId) {
      return await logger.operation(
        loggerMessages.database.users.getByClerkId,
        async () => {
          assertClerkId(clerkId);

          const [user] = await db
            .select()
            .from(schema.users)
            .where(eq(schema.users.clerkId, clerkId))
            .limit(1);

          return user ?? null;
        },
        {
          attributes: {
            clerkIdHash: hashLogIdentifier(clerkId),
          },
        },
      );
    },
    async syncFromClerk(input) {
      return await logger.operation(
        loggerMessages.database.users.syncFromClerk,
        async () => {
          try {
            const normalized = normalizeSyncInput(input);
            const updated = await db
              .update(schema.users)
              .set({
                clerkUpdatedAt: normalized.clerkUpdatedAt,
                username: normalized.username,
              })
              .where(
                and(
                  eq(schema.users.clerkId, normalized.clerkId),
                  or(
                    isNull(schema.users.clerkUpdatedAt),
                    lt(schema.users.clerkUpdatedAt, normalized.clerkUpdatedAt),
                  ),
                ),
              )
              .returning({ id: schema.users.id });
            if (updated.length > 0) return "updated";

            const inserted = await db
              .insert(schema.users)
              .values(normalized)
              .onConflictDoNothing({ target: schema.users.clerkId })
              .returning({ id: schema.users.id });

            return inserted.length > 0 ? "inserted" : "unchanged";
          } catch {
            throw new Error("Failed to synchronize Clerk user.");
          }
        },
        {
          attributes: {
            clerkIdHash: hashLogIdentifier(input.clerkId),
          },
        },
      );
    },
  };
}
