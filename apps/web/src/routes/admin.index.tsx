import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute } from "@tanstack/react-router";
import { AdminIndexPage } from "@/pages/admin-index-page";

/**
 * Shows the administrator landing page.
 */
export const Route = createFileRoute("/admin/")({
  component: AdminIndexPage,
  /**
   * Builds document metadata for the admin route.
   *
   * @returns Metadata emitted for the route.
   */
  head: () => ({
    meta: [{ title: formatTranslation("web.admin.hub.title") }],
  }),
});
