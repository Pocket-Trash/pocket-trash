import { createFileRoute, notFound } from "@tanstack/react-router";
import { canManageFeatureFlags } from "@/lib/feature-flags";
import { AdminFeatureFlagsPage } from "@/pages/admin-feature-flags-page";

/**
 * Provides feature-flag controls to authorized administrators.
 */
export const Route = createFileRoute("/admin/settings/feature-flags")({
  /**
   * Requires feature-flag administration access before entering the route.
   *
   * @rejects When the current user lacks feature-flag administration access.
   */
  beforeLoad: async () => {
    if (!(await canManageFeatureFlags())) {
      throw notFound();
    }
  },
  component: AdminFeatureFlagsPage,
});
