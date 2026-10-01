import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute } from "@tanstack/react-router";
import { AdminIndexPage } from "@/pages/admin-index-page";

/**
 * Defines the `/admin/` route and its data lifecycle.
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
