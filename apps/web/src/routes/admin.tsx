import { createFileRoute, notFound, Outlet } from "@tanstack/react-router";
import { hasAdminAccess } from "@/lib/authorization";

/**
 * Guards the administrator route tree and renders its selected child route.
 */
export const Route = createFileRoute("/admin")({
  /**
   * Requires administrator access before entering the route tree.
   *
   * @rejects When the current user lacks administrator access.
   */
  beforeLoad: async () => {
    if (!(await hasAdminAccess())) throw notFound();
  },
  component: Outlet,
});
