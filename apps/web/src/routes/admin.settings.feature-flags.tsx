import { createFileRoute, notFound } from "@tanstack/react-router";
import { canManageFeatureFlags } from "@/lib/feature-flags";
import { AdminFeatureFlagsPage } from "@/pages/admin-feature-flags-page";

/**
 * Defines the `/admin/settings/feature-flags` route and its data lifecycle.
 */
export const Route = createFileRoute("/admin/settings/feature-flags")({
  /**
   * Requires feature-flag administration access before entering the route.
   *
   * @throws When the requested route data is unavailable or access is denied.
   * @rejects When the requested route data is unavailable or access is denied.
   */
  beforeLoad: async () => {
    if (!(await canManageFeatureFlags())) {
      throw notFound();
    }
  },
  component: AdminFeatureFlagsPage,
});
