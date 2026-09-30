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

export type Permission = (typeof permissions)[number];
export type Role = "user" | "editor" | "admin" | "system_admin";
export type Actor = { clerkId: string; role: Role };

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

export function normalizeActor(clerkId: string, sessionClaims: unknown): Actor {
  const claimedRole = (sessionClaims as { role?: unknown } | null)?.role;
  const role =
    typeof claimedRole === "string" &&
    Object.hasOwn(permissionsByRole, claimedRole)
      ? (claimedRole as Role)
      : "user";

  return { clerkId, role };
}

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

export function hasStaffPermission(actor: Actor | null | undefined): boolean {
  return actor ? permissionsByRole[actor.role].length > 0 : false;
}
