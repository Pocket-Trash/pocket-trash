import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getAuthState } from "@/lib/auth";

/**
 * Guards the authenticated feedback route tree.
 */
export const Route = createFileRoute("/feedback")({
  /**
   * Requires authentication before entering the feedback route.
   *
   * @rejects When authentication cannot be checked or an unauthenticated visitor is redirected to sign in.
   */
  beforeLoad: async () => {
    if (!(await getAuthState()).isAuthenticated) {
      throw redirect({ params: { _splat: "" }, to: "/sign-in/$" });
    }
  },
  component: Outlet,
});
