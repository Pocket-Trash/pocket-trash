import { auth as clerkAuth } from "@clerk/tanstack-react-start/server";
import { redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

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

export const getAuthState = createServerFn().handler(resolveAuthState);
