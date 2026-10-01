import { createFileRoute, notFound } from "@tanstack/react-router";
import { canManageFeedback } from "@/lib/feedback";
import { AdminSettingsPage } from "@/pages/admin-settings-page";

/**
 * Defines the `/admin/settings/` route and its data lifecycle.
 */
export const Route = createFileRoute("/admin/settings/")({
  /**
   * Requires feedback administration access before entering the route.
   *
   * @throws When the requested route data is unavailable or access is denied.
   * @rejects When the requested route data is unavailable or access is denied.
   */
  beforeLoad: async () => {
    if (!(await canManageFeedback())) throw notFound();
  },
  component: AdminSettingsPage,
});
