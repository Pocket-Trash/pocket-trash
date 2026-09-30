import { createFileRoute, notFound } from "@tanstack/react-router";
import { canManageFeedback } from "@/lib/feedback";
import { AdminSettingsPage } from "@/pages/admin-settings-page";

export const Route = createFileRoute("/admin/settings/")({
  beforeLoad: async () => {
    if (!(await canManageFeedback())) throw notFound();
  },
  component: AdminSettingsPage,
});
