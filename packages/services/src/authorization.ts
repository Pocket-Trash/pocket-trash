/** Permission identifiers recognized by service authorization checks. */
export const permissions = [
  "products.manage",
  "collections.manage",
  "resources.manage",
  "feedback.manage",
  "feature_flags.manage",
  "users.manage",
  "audit.read",
  "audit.export",
  "resources.purge",
  "accounts.erase",
  "audit.delete",
] as const;

/** Permission granted to an authenticated service actor. */
export type Permission = (typeof permissions)[number];
/** Application role used to derive service permissions. */
export type Role = "user" | "editor" | "admin" | "system_admin";
/** Authenticated identity and normalized application role. */
export type Actor = {
  /** Clerk user identifier. */
  clerkId: string;
  /** Normalized application role. */
  role: Role;
};

/** Permissions granted by each normalized application role. */
const permissionsByRole = {
  user: [],
  editor: ["products.manage", "collections.manage", "resources.manage"],
  admin: [
    "products.manage",
    "collections.manage",
    "resources.manage",
    "feedback.manage",
    "feature_flags.manage",
    "users.manage",
    "audit.read",
    "audit.export",
  ],
  system_admin: permissions,
} as const satisfies Record<Role, readonly Permission[]>;

/**
 * Normalizes Clerk session claims into a service actor.
 * Unknown or missing roles fall back to `user`.
 *
 * @param clerkId - Clerk user identifier.
 * @param sessionClaims - Untrusted Clerk session claims.
 * @returns Actor with a recognized application role.
 */
export function normalizeActor(clerkId: string, sessionClaims: unknown): Actor {
  const claimedRole = (
    sessionClaims as {
      /** Untrusted role claim supplied by Clerk. */
      role?: unknown;
    } | null
  )?.role;
  const role =
    typeof claimedRole === "string" &&
    Object.hasOwn(permissionsByRole, claimedRole)
      ? (claimedRole as Role)
      : "user";

  return { clerkId, role };
}

/**
 * Checks whether an actor has a specific service permission.
 * Missing actors never have permission.
 *
 * @param actor - Authenticated actor, when available.
 * @param permission - Permission required by the operation.
 * @returns Whether the actor's normalized role grants the permission.
 */
export function hasPermission(
  actor: Actor | null | undefined,
  permission: Permission,
): boolean {
  return actor
    ? (permissionsByRole[actor.role] as readonly Permission[]).includes(
        permission,
      )
    : false;
}

/**
 * Checks whether an actor has any staff permission.
 * Missing actors and ordinary users return `false`.
 *
 * @param actor - Authenticated actor, when available.
 * @returns Whether the actor has a staff role.
 */
export function hasStaffPermission(actor: Actor | null | undefined): boolean {
  return actor ? permissionsByRole[actor.role].length > 0 : false;
}
