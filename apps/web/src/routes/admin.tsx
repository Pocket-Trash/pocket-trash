import { createFileRoute, notFound, Outlet } from "@tanstack/react-router";
import { hasAdminAccess } from "@/lib/authorization";

/**
 * Defines the `/admin` route and its data lifecycle.
 */
export const Route = createFileRoute("/admin")({
  /**
   * Requires administrator access before entering the route tree.
   *
   * @throws When the requested route data is unavailable or access is denied.
   * @rejects When the requested route data is unavailable or access is denied.
   */
  beforeLoad: async () => {
    if (!(await hasAdminAccess())) throw notFound();
  },
  component: Outlet,
});
