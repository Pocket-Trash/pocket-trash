import type { Actor, UserBanState } from "@package/services";
import { hasPermission } from "@package/services/authorization";
import { createServerFn } from "@tanstack/react-start";
import { getActor, requirePermission } from "@/lib/authorization";
import { localizedServerError } from "@/lib/server-errors";

/** Clerk identity fields displayed in user-access administration. */
export type AdminUserIdentity = {
  /** Whether Clerk currently prevents this user from signing in. */
  banned: boolean;
  /** Stable Clerk user identifier. */
  clerkId: string;
  /** Primary email address when available. */
  email: string | null;
  /** Best available display name. */
  name: string;
  /** Clerk username when configured. */
  username: string | null;
};

/** Selected Clerk identity with its durable local ban state. */
export type AdminUserAccess = {
  /** Durable local state, or `null` before the first managed decision. */
  banState: UserBanState | null;
  /** Current identity-provider view of the user. */
  user: AdminUserIdentity;
};

/** Minimal Clerk user API used for idempotent ban reconciliation. */
type ClerkBanUsersApi = {
  /**
   * Bans one Clerk user.
   *
   * @param clerkId - Target Clerk user identifier.
   * @returns Provider response after the user is banned.
   */
  banUser(clerkId: string): Promise<unknown>;
  /**
   * Loads the provider's current ban state.
   *
   * @param clerkId - Target Clerk user identifier.
   * @returns Current provider ban state.
   */
  getUser(clerkId: string): Promise<{
    /** Whether Clerk currently blocks sign-in. */
    banned: boolean;
  }>;
  /**
   * Unbans one Clerk user.
   *
   * @param clerkId - Target Clerk user identifier.
   * @returns Provider response after the user is unbanned.
   */
  unbanUser(clerkId: string): Promise<unknown>;
};

/** Reports whether the current actor may manage users. */
export const canManageUsers = createServerFn().handler(async () => {
  return hasPermission(await getActor(), "users.manage");
});

/** Searches Clerk users for the authorized administration screen. */
export const searchAdminUsers = createServerFn({ method: "GET" })
  .validator(parseUserSearchInput)
  .handler(async ({ data }): Promise<AdminUserIdentity[]> => {
    await requireUserAdmin();
    try {
      const { clerkClient } = await import(
        "@clerk/tanstack-react-start/server"
      );
      const result = await clerkClient().users.getUserList({
        limit: 10,
        query: data.query,
      });
      return result.data.map(adminUserIdentity);
    } catch {
      throw localizedServerError("error.generic");
    }
  });

/** Loads Clerk and durable access state for one selected user. */
export const getAdminUserAccess = createServerFn({ method: "GET" })
  .validator(parseTargetUserInput)
  .handler(async ({ data }): Promise<AdminUserAccess> => {
    await requireUserAdmin();
    try {
      const [{ clerkClient }, { s }] = await Promise.all([
        import("@clerk/tanstack-react-start/server"),
        import("@/lib/services"),
      ]);
      const [user, banState] = await Promise.all([
        clerkClient().users.getUser(data.targetClerkId),
        s.db.users.getBanState(data.targetClerkId),
      ]);
      return { banState, user: adminUserIdentity(user) };
    } catch {
      throw localizedServerError("error.generic");
    }
  });

/** Applies an authorized user ban, unban, retry, or reason edit. */
export const setAdminUserBanState = createServerFn({ method: "POST" })
  .validator(parseUserBanInput)
  .handler(async ({ data }): Promise<UserBanState> => {
    const actor = await requireUserAdmin();
    try {
      const [{ clerkClient }, { s }] = await Promise.all([
        import("@clerk/tanstack-react-start/server"),
        import("@/lib/services"),
      ]);
      const users = clerkClient().users;
      return await s.db.users.setBanState(
        { actor, ...data },
        async (clerkId, banned) =>
          await reconcileClerkBanState(users, clerkId, banned),
      );
    } catch {
      throw localizedServerError("error.generic");
    }
  });

/**
 * Parses an administrator user-ban request.
 *
 * @param input - Untrusted server-function input.
 * @returns Normalized bounded ban decision.
 * @throws When the target, desired state, or reason is invalid.
 */
export function parseUserBanInput(input: unknown) {
  const value = record(input);
  if (typeof value.banned !== "boolean") {
    throw localizedServerError("error.generic");
  }
  return {
    banned: value.banned,
    reason: requiredString(value.reason, 1000),
    targetClerkId: requiredString(value.targetClerkId, 120),
  };
}

/**
 * Reconciles Clerk with the requested ban state without repeating mutations.
 *
 * @param users - Clerk user API methods used by the workflow.
 * @param clerkId - Target Clerk user identifier.
 * @param banned - Desired provider ban state.
 * @returns Completion after Clerk matches the desired state.
 */
export async function reconcileClerkBanState(
  users: ClerkBanUsersApi,
  clerkId: string,
  banned: boolean,
): Promise<void> {
  const current = await users.getUser(clerkId);
  if (current.banned === banned) return;
  if (banned) await users.banUser(clerkId);
  else await users.unbanUser(clerkId);
}

/**
 * Parses a bounded administrator user search.
 *
 * @param input - Untrusted server-function input.
 * @returns Normalized search query.
 * @throws When the query is invalid.
 */
function parseUserSearchInput(input: unknown) {
  return { query: requiredString(record(input).query, 100) };
}

/**
 * Parses a target Clerk user identifier.
 *
 * @param input - Untrusted server-function input.
 * @returns Normalized target identifier.
 * @throws When the target identifier is invalid.
 */
function parseTargetUserInput(input: unknown) {
  return { targetClerkId: requiredString(record(input).targetClerkId, 120) };
}

/**
 * Requires an object-shaped input value.
 *
 * @param input - Untrusted value.
 * @returns Input as an unknown property record.
 * @throws When the input is not an object.
 */
function record(input: unknown): Record<string, unknown> {
  if (typeof input !== "object" || input === null) {
    throw localizedServerError("error.generic");
  }
  return input as Record<string, unknown>;
}

/**
 * Normalizes a required bounded string.
 *
 * @param input - Untrusted value.
 * @param maximum - Maximum accepted length.
 * @returns Trimmed nonblank string.
 * @throws When the value is missing or too long.
 */
function requiredString(input: unknown, maximum: number): string {
  if (typeof input !== "string") throw localizedServerError("error.generic");
  const value = input.trim();
  if (!value || value.length > maximum) {
    throw localizedServerError("error.generic");
  }
  return value;
}

/**
 * Requires an actor authorized to manage user access.
 *
 * @returns Normalized administrator actor.
 * @rejects When the requester lacks user-management permission.
 */
async function requireUserAdmin(): Promise<Actor> {
  return await requirePermission("users.manage");
}

/**
 * Converts a Clerk user into the fields displayed by administration.
 *
 * @param user - Clerk user identity fields.
 * @returns Display-safe administrator identity.
 */
function adminUserIdentity(user: {
  /** Whether Clerk currently blocks sign-in. */
  banned: boolean;
  /** Email addresses associated with the user. */
  emailAddresses: Array<{
    /** Email address value. */
    emailAddress: string;
  }>;
  /** Given name when available. */
  firstName: string | null;
  /** Provider-computed full name when available. */
  fullName: string | null;
  /** Stable Clerk user identifier. */
  id: string;
  /** Family name when available. */
  lastName: string | null;
  /** Primary email address when configured. */
  primaryEmailAddress: {
    /** Email address value. */
    emailAddress: string;
  } | null;
  /** Clerk username when configured. */
  username: string | null;
}): AdminUserIdentity {
  const email =
    user.primaryEmailAddress?.emailAddress ??
    user.emailAddresses[0]?.emailAddress ??
    null;
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");
  return {
    banned: user.banned,
    clerkId: user.id,
    email,
    name: user.fullName ?? (fullName || user.username || email || user.id),
    username: user.username,
  };
}
