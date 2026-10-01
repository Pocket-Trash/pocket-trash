import { createFileRoute, redirect } from "@tanstack/react-router";
import { getAuthState } from "@/lib/auth";
import { SignUpPage } from "@/pages/sign-up-page";

/**
 * Defines the `/sign-up/$` route and its data lifecycle.
 */
export const Route = createFileRoute("/sign-up/$")({
  /**
   * Redirects authenticated visitors away from the sign-up route.
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
  component: SignUpPage,
});
