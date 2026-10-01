import { createFileRoute, redirect } from "@tanstack/react-router";
import { getAuthState } from "@/lib/auth";
import { SignInPage } from "@/pages/sign-in-page";

/**
 * Defines the `/sign-in/$` route and its data lifecycle.
 */
export const Route = createFileRoute("/sign-in/$")({
  /**
   * Redirects authenticated visitors away from the sign-in route.
   *
   * @throws When navigation must continue at another route.
   * @rejects When navigation must continue at another route.
   */
  beforeLoad: async () => {
    const { isAuthenticated } = await getAuthState();

    if (isAuthenticated) {
      throw redirect({ to: "/" });
    }
  },
  component: SignInPage,
});
