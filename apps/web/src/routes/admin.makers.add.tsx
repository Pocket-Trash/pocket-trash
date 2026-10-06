import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { canManageMakers } from "@/lib/catalog-api";
import { AdminMakerFormPage } from "@/pages/admin-makers-page";

/** Provides permission-gated maker profile creation. */
export const Route = createFileRoute("/admin/makers/add")({
  /**
   * Requires product-management permission before entering the route.
   *
   * @rejects When authorization cannot be checked or the requester lacks access.
   */
  beforeLoad: async () => {
    if (!(await canManageMakers())) throw notFound();
  },
  component: AdminMakerFormPage,
  /**
   * Builds localized document metadata.
   *
   * @returns Localized document metadata.
   */
  head: () => ({
    meta: [{ title: formatTranslation("web.action.addMaker") }],
  }),
});
