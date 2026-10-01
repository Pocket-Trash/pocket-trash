import type { Database, User, UserBan } from "@package/database";
import { schema } from "@package/database";
import { type Logger, loggerMessages } from "@package/logger";
import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import { type Actor, hasPermission } from "../../authorization.js";
import { hashLogIdentifier } from "../../logging.js";

export type EnsureUserInput = {
  clerkId: string;
};

/** User synchronization and account-access persistence operations. */
export type UsersService = {
  /**
   * Ensures a user row exists.
   *
   * @param input - Clerk identity to persist.
   * @returns Stored user row.
   */
  ensure(input: EnsureUserInput): Promise<User>;
  /**
   * Loads the durable access state for a Clerk user.
   *
   * @param clerkId - Clerk identifier to load.
   * @returns Current ban state, or null when unmanaged.
   */
  getBanState(clerkId: string): Promise<UserBanState | null>;
  /**
   * Loads a user by Clerk identifier.
   *
   * @param clerkId - Clerk identifier to load.
   * @returns Stored user, or null when absent.
   */
  getByClerkId(clerkId: string): Promise<User | null>;
  /**
   * Lists every stored Clerk identifier.
   *
   * @returns Every stored Clerk identifier.
   */
  listClerkIds(): Promise<string[]>;
  /**
   * Persists and reconciles an administrator ban decision.
   *
   * @param input - Authorized ban decision.
   * @param applyProviderState - Identity-provider reconciliation callback.
   * @returns Completed durable ban state.
   */
  setBanState(
    input: SetUserBanStateInput,
    applyProviderState: ApplyUserBanProviderState,
  ): Promise<UserBanState>;
  /**
   * Synchronizes user identity fields from Clerk.
   *
   * @param input - Current Clerk user fields.
   * @returns Synchronization outcome.
   */
  syncFromClerk(input: SyncUserFromClerkInput): Promise<UserSyncResult>;
};

/**
 * Applies the desired banned state at the identity provider.
 *
 * @param clerkId - Clerk identifier of the affected user.
 * @param banned - Desired identity-provider ban state.
 * @returns Completion after the provider matches the desired state.
 */
export type ApplyUserBanProviderState = (
  /** Clerk identifier of the affected user. */
  clerkId: string,
  /** Desired identity-provider ban state. */
  banned: boolean,
) => Promise<void>;

/** Administrator request to change or explain a user's ban state. */
export type SetUserBanStateInput = {
  /** Authorized administrator making the decision. */
  actor: Actor;
  /** Desired completed ban state. */
  banned: boolean;
  /** Nonblank decision reason retained with the current state. */
  reason: string;
  /** Clerk identifier of the affected user. */
  targetClerkId: string;
};

/** User ban state exposed to administrative callers. */
export type UserBanState = Pick<UserBan, "reason" | "status" | "updatedAt"> & {
  /** Clerk identifier of the affected user. */
  clerkId: string;
};

export type SyncUserFromClerkInput = {
  clerkId: string;
  clerkUpdatedAt: Date;
  username: string;
};

export type UserSyncResult = "inserted" | "unchanged" | "updated";

/** Rejects invalid or unauthorized user-ban state transitions. */
export class UserBanStateError extends Error {}

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

/**
 * Creates user synchronization and access-management operations.
 *
 * @param db - Application database.
 * @param logger - Structured operation logger.
 * @returns Configured user service.
 */
export function createUsersService(db: Database, logger: Logger): UsersService {
  return {
    async ensure({ clerkId }) {
      return await logger.operation(
        loggerMessages.database.users.ensure,
        async () => {
          assertClerkId(clerkId);

          const [user] = await db
            .insert(schema.user)
            .values({ clerkId })
            .onConflictDoUpdate({
              set: { clerkId },
              target: schema.user.clerkId,
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
    /**
     * Loads the durable access state for a Clerk user.
     *
     * @param clerkId - Clerk identifier to load.
     * @returns Current ban state, or null when unmanaged.
     */
    async getBanState(clerkId) {
      assertClerkId(clerkId);
      const [state] = await db
        .select({
          clerkId: schema.user.clerkId,
          reason: schema.userBan.reason,
          status: schema.userBan.status,
          updatedAt: schema.userBan.updatedAt,
        })
        .from(schema.userBan)
        .innerJoin(schema.user, eq(schema.user.id, schema.userBan.userId))
        .where(eq(schema.user.clerkId, clerkId.trim()))
        .limit(1);
      return state ?? null;
    },
    async getByClerkId(clerkId) {
      return await logger.operation(
        loggerMessages.database.users.getByClerkId,
        async () => {
          assertClerkId(clerkId);

          const [user] = await db
            .select()
            .from(schema.user)
            .where(eq(schema.user.clerkId, clerkId))
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
    async listClerkIds() {
      const users = await db
        .select({ clerkId: schema.user.clerkId })
        .from(schema.user);
      return users.map(({ clerkId }) => clerkId);
    },
    /**
     * Persists and reconciles an administrator ban decision.
     *
     * @param input - Authorized ban decision.
     * @param applyProviderState - Identity-provider reconciliation callback.
     * @returns Completed durable ban state.
     * @rejects When authorization, validation, or reconciliation fails.
     */
    async setBanState(input, applyProviderState) {
      if (!hasPermission(input.actor, "users.manage")) {
        throw new UserBanStateError("User management permission is required.");
      }
      const targetClerkId = input.targetClerkId.trim();
      const reason = input.reason.trim();
      assertClerkId(targetClerkId);
      if (!reason || reason.length > 1000) {
        throw new UserBanStateError("A bounded decision reason is required.");
      }

      const pendingStatus = input.banned ? "pending_ban" : "pending_unban";
      const completedStatus = input.banned ? "banned" : "unbanned";
      const start = await db.transaction(async (tx) => {
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtextextended(${`user-ban:${targetClerkId}`}, 0))`,
        );
        let [target] = await tx
          .select({ id: schema.user.id })
          .from(schema.user)
          .where(eq(schema.user.clerkId, targetClerkId))
          .limit(1);
        if (!target) {
          [target] = await tx
            .insert(schema.user)
            .values({ clerkId: targetClerkId })
            .returning({ id: schema.user.id });
        }
        if (!target) throw new Error("Failed to ensure ban target.");

        const [current] = await tx
          .select()
          .from(schema.userBan)
          .where(eq(schema.userBan.userId, target.id))
          .limit(1);
        if (current?.status === completedStatus && !input.banned) {
          throw new UserBanStateError("The user is already unbanned.");
        }
        if (
          current &&
          (current.status === "pending_ban" ||
            current.status === "pending_unban") &&
          current.status !== pendingStatus
        ) {
          throw new UserBanStateError(
            "The previous user-ban operation must be reconciled first.",
          );
        }
        if (current?.status === "unbanned" && !input.banned) {
          throw new UserBanStateError("Only banned users can be unbanned.");
        }

        const [state] = await tx
          .insert(schema.userBan)
          .values({ reason, status: pendingStatus, userId: target.id })
          .onConflictDoUpdate({
            set: { reason, status: pendingStatus, updatedAt: new Date() },
            target: schema.userBan.userId,
          })
          .returning();
        if (!state) throw new Error("Failed to record pending ban state.");
        return { userId: target.id };
      });

      await applyProviderState(targetClerkId, input.banned);

      const [completed] = await db
        .update(schema.userBan)
        .set({ status: completedStatus, updatedAt: new Date() })
        .where(
          and(
            eq(schema.userBan.userId, start.userId),
            eq(schema.userBan.status, pendingStatus),
          ),
        )
        .returning();
      if (!completed) throw new Error("Failed to complete user-ban operation.");
      return banState(targetClerkId, completed);
    },
    async syncFromClerk(input) {
      return await logger.operation(
        loggerMessages.database.users.syncFromClerk,
        async () => {
          try {
            const normalized = normalizeSyncInput(input);
            const updated = await db
              .update(schema.user)
              .set({
                clerkUpdatedAt: normalized.clerkUpdatedAt,
                username: normalized.username,
              })
              .where(
                and(
                  eq(schema.user.clerkId, normalized.clerkId),
                  or(
                    isNull(schema.user.clerkUpdatedAt),
                    lt(schema.user.clerkUpdatedAt, normalized.clerkUpdatedAt),
                  ),
                ),
              )
              .returning({ id: schema.user.id });
            if (updated.length > 0) return "updated";

            const inserted = await db
              .insert(schema.user)
              .values(normalized)
              .onConflictDoNothing({ target: schema.user.clerkId })
              .returning({ id: schema.user.id });

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

/**
 * Adds a Clerk identifier to a stored user-ban row.
 *
 * @param clerkId - Clerk identifier for the affected user.
 * @param state - Stored durable ban state.
 * @returns Administrative user-ban view.
 */
function banState(clerkId: string, state: UserBan): UserBanState {
  return {
    clerkId,
    reason: state.reason,
    status: state.status,
    updatedAt: state.updatedAt,
  };
}
