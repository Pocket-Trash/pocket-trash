import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { canManageMakers, listAdminMakers } from "@/lib/catalog-api";
import { AdminMakersPage } from "@/pages/admin-makers-page";

/** Provides the permission-gated maker administration directory. */
export const Route = createFileRoute("/admin/makers/")({
  /**
   * Requires product-management permission before entering the route.
   *
   * @rejects When authorization cannot be checked or the requester lacks access.
   */
  beforeLoad: async () => {
    if (!(await canManageMakers())) throw notFound();
  },
  component: AdminMakersRoute,
  /**
   * Builds localized document metadata.
   *
   * @returns Localized document metadata.
   */
  head: () => ({
    meta: [{ title: formatTranslation("web.admin.makers.title") }],
  }),
  /**
   * Loads maker profiles for the administration directory.
   *
   * @returns Name-sorted maker profiles.
   * @rejects When authorization, service loading, or persistence fails.
   */
  loader: () => listAdminMakers(),
});

/**
 * Renders the maker administration route content.
 *
 * @returns The maker administration page.
 */
function AdminMakersRoute() {
  return <AdminMakersPage makers={Route.useLoaderData()} />;
}
