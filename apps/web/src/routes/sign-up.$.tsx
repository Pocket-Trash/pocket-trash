import { createFileRoute, redirect } from "@tanstack/react-router";
import { getAuthState } from "@/lib/auth";
import { SignUpPage } from "@/pages/sign-up-page";

/**
 * Provides account registration to unauthenticated visitors.
 */
export const Route = createFileRoute("/sign-up/$")({
  /**
   * Redirects authenticated visitors away from the sign-up route.
   *
   * @rejects When an authenticated visitor is redirected home.
   */
  beforeLoad: async () => {
    const { isAuthenticated } = await getAuthState();

    if (isAuthenticated) {
      throw redirect({ to: "/" });
    }
  },
  component: SignUpPage,
});
