import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getAuthState } from "@/lib/auth";

/**
 * Defines the `/feedback` route and its data lifecycle.
 */
export const Route = createFileRoute("/feedback")({
  /**
   * Requires authentication before entering the feedback route.
   *
   * @throws When navigation must continue at another route.
   * @rejects When navigation must continue at another route.
   */
  beforeLoad: async () => {
    if (!(await getAuthState()).isAuthenticated) {
      throw redirect({ params: { _splat: "" }, to: "/sign-in/$" });
    }
  },
  component: Outlet,
});
