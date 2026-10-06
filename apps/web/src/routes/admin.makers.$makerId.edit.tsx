import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { canManageMakers, getAdminMaker } from "@/lib/catalog-api";
import { AdminMakerFormPage } from "@/pages/admin-makers-page";

/** Provides permission-gated maker profile editing. */
export const Route = createFileRoute("/admin/makers/$makerId/edit")({
  params: {
    /**
     * Validates the maker identifier route parameter.
     *
     * @param params - Serialized route parameters.
     * @returns Route parameters containing a positive maker identifier.
     * @throws When the maker identifier is invalid.
     */
    parse: (params) => {
      if (!/^\d+$/.test(params.makerId) || Number(params.makerId) < 1) {
        throw notFound();
      }
      return params;
    },
  },
  /**
   * Requires product-management permission before entering the route.
   *
   * @rejects When authorization cannot be checked or the requester lacks access.
   */
  beforeLoad: async () => {
    if (!(await canManageMakers())) throw notFound();
  },
  component: AdminMakerEditRoute,
  /**
   * Builds localized document metadata.
   *
   * @returns Localized document metadata.
   */
  head: () => ({
    meta: [{ title: formatTranslation("web.admin.makers.title") }],
  }),
  /**
   * Loads the maker profile selected by the route parameter.
   *
   * @param context - Route loader context.
   * @param context.params - Validated route parameters.
   * @returns The matching maker profile.
   * @rejects When the maker does not exist or cannot be loaded.
   */
  loader: async ({ params }) => {
    const maker = await getAdminMaker({
      data: { makerId: Number(params.makerId) },
    });
    if (!maker) throw notFound();
    return maker;
  },
});

/**
 * Renders the maker edit route content.
 *
 * @returns The maker profile form.
 */
function AdminMakerEditRoute() {
  return <AdminMakerFormPage maker={Route.useLoaderData()} />;
}
