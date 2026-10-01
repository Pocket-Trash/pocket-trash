import { createFileRoute, redirect } from "@tanstack/react-router";
import { getAuthState } from "@/lib/auth";
import { SignInPage } from "@/pages/sign-in-page";

/**
 * Provides sign-in to unauthenticated visitors.
 */
export const Route = createFileRoute("/sign-in/$")({
  /**
   * Redirects authenticated visitors away from the sign-in route.
   *
   * @rejects When an authenticated visitor is redirected home.
   */
  beforeLoad: async () => {
    const { isAuthenticated } = await getAuthState();

    if (isAuthenticated) {
      throw redirect({ to: "/" });
    }
  },
  component: SignInPage,
});
