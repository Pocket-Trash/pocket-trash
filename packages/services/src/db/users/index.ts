import type { Database, User, UserBan } from "@package/database";
import { schema } from "@package/database";
import { type Logger, loggerMessages } from "@package/logger";
import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import { type Actor, hasPermission } from "../../authorization.js";
import { hashLogIdentifier } from "../../logging.js";
import type { AuditService, AuditWriteInput } from "../audit/index.js";
import { type UserBanAuditData, userBanAudit } from "../audit/users.js";

/**
 * Clerk identity required to ensure a database user exists.
 */
export type EnsureUserInput = {
  /** Clerk identity used as the user upsert key. */
  clerkId: string;
};

/** User synchronization and account-access persistence operations. */
export type UsersService = {
  /**
   * Ensures a user row exists.
   *
   * @param input - Clerk identity to persist.
   * @returns Stored user row.
   * @rejects When validation, persistence, or operation logging fails.
   */
  ensure(input: EnsureUserInput): Promise<User>;
  /**
   * Loads the durable access state for a Clerk user.
   *
   * @param clerkId - Clerk identifier to load.
   * @returns Current ban state, or null when unmanaged.
   * @rejects When validation or persistence fails.
   */
  getBanState(clerkId: string): Promise<UserBanState | null>;
  /**
   * Loads a user by Clerk identifier.
   *
   * @param clerkId - Clerk identifier to load.
   * @returns Stored user, or null when absent.
   * @rejects When validation, persistence, or operation logging fails.
   */
  getByClerkId(clerkId: string): Promise<User | null>;
  /**
   * Lists every stored Clerk identifier.
   *
   * @returns Every stored Clerk identifier.
   * @rejects When persistence fails.
   */
  listClerkIds(): Promise<string[]>;
  /**
   * Persists and reconciles an administrator ban decision.
   *
   * @param input - Authorized ban decision.
   * @param applyProviderState - Identity-provider reconciliation callback.
   * @returns Completed durable ban state.
   * @rejects When authorization, validation, persistence, or provider reconciliation fails.
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
   * @rejects When validation, persistence, or operation logging fails.
   */
  syncFromClerk(input: SyncUserFromClerkInput): Promise<UserSyncResult>;
};

/**
 * Applies the desired banned state at the identity provider.
 *
 * @param clerkId - Clerk identifier of the affected user.
 * @param banned - Desired identity-provider ban state.
 * @returns Completion after the provider matches the desired state.
 * @rejects When provider reconciliation fails.
 */
export type ApplyUserBanProviderState = (
  /** Clerk identifier of the affected user. */
  clerkId: string,
  /** Desired identity-provider ban state. */
  banned: boolean,
) => Promise<void>;

/** Audit outcome persisted with a completed user-ban state. */
type RecordUserBanAudit = {
  /**
   * Persists the direct event or its durable delivery.
   *
   * @param transaction - Caller-owned completion transaction.
   * @returns Completion after the audit outcome is durable.
   */
  (transaction: Parameters<AuditService["write"]>[0]): Promise<unknown>;
};

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

/**
 * Current Clerk identity fields used for idempotent synchronization.
 */
export type SyncUserFromClerkInput = {
  /** Clerk identity used to locate or insert the user. */
  clerkId: string;
  /** Provider update time used to ignore stale synchronization events. */
  clerkUpdatedAt: Date;
  /** Selected Clerk picture URL; null for generated avatars or removal. */
  imageUrl: string | null;
  /** Current provider username persisted for newer events. */
  username: string;
};

/**
 * Outcome of comparing a Clerk update with the stored user record.
 */
export type UserSyncResult = "inserted" | "unchanged" | "updated";

/** Rejects invalid or unauthorized user-ban state transitions. */
export class UserBanStateError extends Error {}

/**
 * Validates a Clerk user identifier.
 *
 * @param clerkId - Clerk user identifier to validate.
 * @throws When the identifier is blank.
 */
function assertClerkId(clerkId: string): void {
  if (!clerkId.trim()) {
    throw new Error("clerkId is required.");
  }
}

/**
 * Validates and trims Clerk synchronization input.
 *
 * @param input - Clerk identity fields and provider update timestamp.
 * @returns Input with trimmed Clerk identifier and username.
 * @throws When an identity field or timestamp is invalid.
 */
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
 * @param audit - Shared audit persistence and retry service.
 * @returns Configured user service.
 */
export function createUsersService(
  db: Database,
  logger: Logger,
  audit?: AuditService,
): UsersService {
  return {
    /**
     * Ensures a database user exists for a Clerk identity.
     *
     * @param input - Clerk identity to ensure exists.
     * @returns Persisted user record.
     * @rejects When validation, persistence, or operation logging fails.
     */
    async ensure(input) {
      const { clerkId } = input;
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
     * @rejects When validation or persistence fails.
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
    /**
     * Loads a user by Clerk identifier.
     *
     * @param clerkId - Clerk user identifier to load.
     * @returns Stored user, or `null` when absent.
     * @rejects When validation, persistence, or operation logging fails.
     */
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
    /**
     * Lists every stored Clerk user identifier.
     *
     * @returns Stored Clerk identifiers in unspecified order.
     * @rejects When persistence fails.
     */
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
     * @rejects When authorization, validation, persistence, or provider reconciliation fails.
     */
    async setBanState(input, applyProviderState) {
      if (!audit) throw new Error("User-ban auditing is not configured.");
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
        const target = await ensureAuditUser(tx, targetClerkId);
        const actorUser = await ensureAuditUser(tx, input.actor.clerkId);

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

        const retrying = current?.status === pendingStatus;
        const pendingRequestId = retrying
          ? current.pendingRequestId
          : crypto.randomUUID();
        if (!pendingRequestId) {
          throw new Error("Pending user-ban request is invalid.");
        }
        const pendingBeforeStatus = retrying
          ? current.pendingBeforeStatus
          : current?.status === "banned" || current?.status === "unbanned"
            ? current.status
            : null;
        const [state] = await tx
          .insert(schema.userBan)
          .values({
            pendingBeforeStatus,
            pendingRequestId,
            reason,
            status: pendingStatus,
            userId: target.id,
          })
          .onConflictDoUpdate({
            set: {
              pendingBeforeStatus,
              pendingRequestId,
              reason,
              status: pendingStatus,
              updatedAt: new Date(),
            },
            target: schema.userBan.userId,
          })
          .returning();
        if (!state) throw new Error("Failed to record pending ban state.");
        return {
          actorUser,
          beforeStatus: pendingBeforeStatus,
          requestId: pendingRequestId,
          userId: target.id,
        };
      });

      await applyProviderState(targetClerkId, input.banned);
      const occurredAt = new Date();
      const definition = !input.banned
        ? userBanAudit.unbanned
        : start.beforeStatus
          ? userBanAudit.banUpdated
          : userBanAudit.banned;
      const auditInput: AuditWriteInput<UserBanAuditData> = {
        actor: {
          role: input.actor.role,
          userId: start.actorUser.id,
          username: start.actorUser.username,
        },
        authorization: { permission: "users.manage", type: "permission" },
        data: {
          after: { banned: input.banned, status: completedStatus },
          before: {
            banned: start.beforeStatus === "banned" || !input.banned,
            status:
              start.beforeStatus ?? (input.banned ? "unmanaged" : "banned"),
          },
        },
        definition,
        occurredAt,
        ownerUserId: start.userId,
        reason,
        requestId: start.requestId,
        targetId: String(start.userId),
      };

      try {
        const completed = await completeBanState(
          db,
          start,
          pendingStatus,
          completedStatus,
          async (tx) => await audit.write(tx, auditInput),
        );
        return banState(targetClerkId, completed);
      } catch {
        const completed = await completeBanState(
          db,
          start,
          pendingStatus,
          completedStatus,
          async (tx) => await audit.enqueue(tx, start.requestId, auditInput),
        );
        return banState(targetClerkId, completed);
      }
    },
    /**
     * Synchronizes a Clerk user into the application database.
     *
     * @param input - Current Clerk user fields.
     * @returns Synchronization outcome.
     * @rejects When validation, persistence, or operation logging fails.
     */
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
                imageUrl: normalized.imageUrl,
                username: normalized.username,
              })
              .where(
                and(
                  eq(schema.user.clerkId, normalized.clerkId),
                  or(
                    isNull(schema.user.clerkUpdatedAt),
                    lt(schema.user.clerkUpdatedAt, normalized.clerkUpdatedAt),
                    // Reconciliation backfills the new field without a provider timestamp change.
                    and(
                      eq(schema.user.clerkUpdatedAt, normalized.clerkUpdatedAt),
                      sql`${schema.user.imageUrl} is distinct from ${normalized.imageUrl}`,
                    ),
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
 * Ensures a user identity inside an audit source transaction.
 *
 * @param transaction - Caller-owned source transaction.
 * @param clerkId - Clerk identity to ensure.
 * @returns Internal audit actor or target identity.
 * @rejects When the user cannot be persisted.
 */
async function ensureAuditUser(
  transaction: Parameters<AuditService["write"]>[0],
  clerkId: string,
) {
  const [user] = await transaction
    .insert(schema.user)
    .values({ clerkId })
    .onConflictDoUpdate({ set: { clerkId }, target: schema.user.clerkId })
    .returning({ id: schema.user.id, username: schema.user.username });
  if (!user) throw new Error("Failed to ensure audit user.");
  return user;
}

/**
 * Completes one pending ban operation with its audit outcome atomically.
 *
 * @param db - User-ban database.
 * @param start - Pending operation identity.
 * @param pendingStatus - Expected pending state.
 * @param completedStatus - Desired completed state.
 * @param recordAudit - Direct write or durable enqueue callback.
 * @returns Completed user-ban row.
 */
async function completeBanState(
  db: Database,
  start: Pick<PendingBanOperation, "requestId" | "userId">,
  pendingStatus: "pending_ban" | "pending_unban",
  completedStatus: "banned" | "unbanned",
  recordAudit: RecordUserBanAudit,
) {
  return await db.transaction(async (transaction) => {
    const [completed] = await transaction
      .update(schema.userBan)
      .set({
        pendingBeforeStatus: null,
        pendingRequestId: null,
        status: completedStatus,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.userBan.userId, start.userId),
          eq(schema.userBan.status, pendingStatus),
          eq(schema.userBan.pendingRequestId, start.requestId),
        ),
      )
      .returning();
    if (!completed) throw new Error("Failed to complete user-ban operation.");
    await recordAudit(transaction);
    return completed;
  });
}

/** Pending ban operation fields required after provider reconciliation. */
type PendingBanOperation = {
  /** Durable source request identifier. */
  requestId: string;
  /** Internal target user identifier. */
  userId: number;
};

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
