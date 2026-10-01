import {
  type Actor,
  hasPermission,
  hasStaffPermission,
  normalizeActor,
  type Permission,
} from "@package/services/authorization";
import { createServerFn } from "@tanstack/react-start";
import { activeAuth as auth } from "@/lib/auth";
import { localizedServerError } from "@/lib/server-errors";

export async function getActor(getAuth: typeof auth = auth) {
  const { isAuthenticated, sessionClaims, userId } = await getAuth();
  return isAuthenticated && userId
    ? normalizeActor(userId, sessionClaims)
    : undefined;
}

export async function requireActor(
  getAuth: typeof auth = auth,
): Promise<Actor> {
  const actor = await getActor(getAuth);
  if (!actor) throw localizedServerError("error.generic");
  return actor;
}

export async function requirePermission(
  permission: Permission,
  getAuth: typeof auth = auth,
): Promise<Actor> {
  const actor = await getActor(getAuth);
  if (!actor || !hasPermission(actor, permission)) {
    throw localizedServerError("error.generic");
  }
  return actor;
}

export const hasAdminAccess = createServerFn().handler(async () => {
  return hasStaffPermission(await getActor());
});
