import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { canManageProductConfiguration } from "@/lib/catalog-api";
import { AdminConfigPage } from "@/pages/admin-config-pages";

/** Provides the permission-gated administrator configuration hub. */
export const Route = createFileRoute("/admin/config/")({
  /**
   * Requires product-management permission before entering the route.
   *
   * @rejects When authorization cannot be checked or the requester lacks access.
   */
  beforeLoad: async () => {
    if (!(await canManageProductConfiguration())) throw notFound();
  },
  component: AdminConfigPage,
  /**
   * Builds localized document metadata.
   *
   * @returns Localized document metadata.
   */
  head: () => ({
    meta: [
      {
        title: formatTranslation("web.admin.config.title"),
      },
    ],
  }),
});
