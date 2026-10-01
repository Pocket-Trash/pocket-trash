import { createFileRoute, notFound } from "@tanstack/react-router";
import { canManageFeedback } from "@/lib/feedback";
import { AdminSettingsPage } from "@/pages/admin-settings-page";

/**
 * Shows administrator settings to feedback administrators.
 */
export const Route = createFileRoute("/admin/settings/")({
  /**
   * Requires feedback administration access before entering the route.
   *
   * @rejects When authorization cannot be checked or the current user lacks feedback administration access.
   */
  beforeLoad: async () => {
    if (!(await canManageFeedback())) throw notFound();
  },
  component: AdminSettingsPage,
});
