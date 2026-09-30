import { createFileRoute, notFound } from "@tanstack/react-router";
import { canManageFeatureFlags } from "@/lib/feature-flags";
import { AdminFeatureFlagsPage } from "@/pages/admin-feature-flags-page";

export const Route = createFileRoute("/admin/settings/feature-flags")({
  beforeLoad: async () => {
    if (!(await canManageFeatureFlags())) {
      throw notFound();
    }
  },
  component: AdminFeatureFlagsPage,
});
