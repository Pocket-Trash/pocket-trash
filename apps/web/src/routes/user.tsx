import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getAuthState } from "@/lib/auth";

/**
 * Guards the authenticated user route tree and renders its selected child route.
 */
export const Route = createFileRoute("/user")({
  /**
   * Requires authentication before entering the user route.
   *
   * @rejects When an unauthenticated visitor is redirected to sign in.
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
