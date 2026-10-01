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

/** Normalizes the current authenticated user into a service actor.
 *
 * @param getAuth - Authentication resolver, injectable for callers and tests.
 * @returns The normalized actor, or `undefined` for an anonymous request.
 * @rejects When authentication resolution fails.
 */
export async function getActor(getAuth: typeof auth = auth) {
  const { isAuthenticated, sessionClaims, userId } = await getAuth();
  return isAuthenticated && userId
    ? normalizeActor(userId, sessionClaims)
    : undefined;
}

/** Requires an authenticated service actor.
 *
 * @param getAuth - Authentication resolver, injectable for callers and tests.
 * @returns The normalized authenticated actor.
 * @rejects When authentication fails or the request is anonymous.
 */
export async function requireActor(
  getAuth: typeof auth = auth,
): Promise<Actor> {
  const actor = await getActor(getAuth);
  if (!actor) throw localizedServerError("error.generic");
  return actor;
}

/** Requires the current actor to hold a service permission.
 *
 * @param permission - Permission the actor must hold.
 * @param getAuth - Authentication resolver, injectable for callers and tests.
 * @returns The normalized authorized actor.
 * @rejects When authentication fails, the request is anonymous, or the permission is absent.
 */
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

/** Reports whether the current actor has any staff permission.
 *
 * @returns Whether the actor has administrator access.
 * @rejects When authentication or actor resolution fails.
 */
export const hasAdminAccess = createServerFn().handler(async () => {
  return hasStaffPermission(await getActor());
});
