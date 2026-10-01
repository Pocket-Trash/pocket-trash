import { auth as clerkAuth } from "@clerk/tanstack-react-start/server";
import { redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

/** Loads Clerk authentication and blocks accounts currently being erased.
 *
 * @returns The active Clerk authentication state.
 * @rejects When Clerk authentication, service loading, or the erasure guard fails.
 */
export async function activeAuth(): Promise<
  Awaited<ReturnType<typeof clerkAuth>>
> {
  const state = await clerkAuth();
  if (state.isAuthenticated && state.userId) {
    const { s } = await import("@/lib/services");
    await s.db.erasure.assertAccountActive(state.userId);
  }
  return state;
}

/** Resolves the public auth state and redirects erasing accounts.
 *
 * @returns Authentication and Clerk user identity fields.
 * @rejects With a redirect for an erasure in progress, or the original auth failure.
 */
export async function resolveAuthState() {
  try {
    const { isAuthenticated, userId } = await activeAuth();

    return {
      isAuthenticated,
      userId,
    };
  } catch (error) {
    const { AccountErasureInProgressError } = await import("@package/services");
    if (error instanceof AccountErasureInProgressError) {
      throw redirect({ to: "/account-erasure" });
    }
    throw error;
  }
}

/** Returns the guarded authentication state to web clients.
 *
 * @returns Authentication and Clerk user identity fields.
 * @rejects With a redirect for an erasure in progress, or the original auth failure.
 */
export const getAuthState = createServerFn().handler(resolveAuthState);
