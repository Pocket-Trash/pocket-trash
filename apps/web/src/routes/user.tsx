import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getAuthState } from "@/lib/auth";

/**
 * Defines the `/user` route and its data lifecycle.
 */
export const Route = createFileRoute("/user")({
  /**
   * Requires authentication before entering the user route.
   *
   * @throws When navigation must continue at another route.
   * @rejects When navigation must continue at another route.
   */
  beforeLoad: async () => {
    const { isAuthenticated } = await getAuthState();

    if (!isAuthenticated) {
      throw redirect({ params: { _splat: "" }, to: "/sign-in/$" });
    }
  },
  component: UserLayout,
});

/**
 * Renders the user route content.
 *
 * @returns The authenticated user layout UI.
 */
function UserLayout() {
  return <Outlet />;
}
