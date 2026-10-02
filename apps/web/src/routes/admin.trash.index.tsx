import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute } from "@tanstack/react-router";
import { AdminTrashIndexPage } from "@/pages/admin-trash-index-page";

/**
 * Shows the administrator trash landing page.
 */
export const Route = createFileRoute("/admin/trash/")({
  component: AdminTrashIndexPage,
  /**
   * Builds document metadata for the admin trash route.
   *
   * @returns Metadata emitted for the route.
   */
  head: () => ({
    meta: [{ title: formatTranslation("web.admin.trash.title") }],
  }),
});
