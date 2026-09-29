import { auth as clerkAuth } from "@clerk/tanstack-react-start/server";
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

export const getAuthState = createServerFn().handler(async () => {
  const { isAuthenticated, userId } = await activeAuth();

  return {
    isAuthenticated,
    userId,
  };
});
