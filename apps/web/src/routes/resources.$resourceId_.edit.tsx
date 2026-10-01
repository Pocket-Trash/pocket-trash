import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { getAuthState } from "@/lib/auth";
import { getEditableResourceDetail } from "@/lib/resources";
import { ResourceEditPage } from "@/pages/resource-management-pages";

/**
 * Defines the `/resources/$resourceId_/edit` route and its data lifecycle.
 */
export const Route = createFileRoute("/resources/$resourceId_/edit")({
  /**
   * Requires authentication before entering the resource edit route.
   *
   * @throws When navigation must continue at another route.
   * @rejects When navigation must continue at another route.
   */
  beforeLoad: async () => {
    const { isAuthenticated } = await getAuthState();
    if (!isAuthenticated) {
      throw redirect({ params: { _splat: "" }, to: "/sign-in/$" });
    }
  },
  component: ResourceEditPageRoute,
  /**
   * Loads a resource the current user may edit.
   *
   * @param context - Route callback context.
   * @param context.params - Parsed route parameters.
   * @returns The route's loader data.
   * @throws When the requested route data is unavailable or access is denied.
   * @rejects When the requested route data is unavailable or access is denied.
   */
  loader: async ({ params }) => {
    const detail = await getEditableResourceDetail({
      data: { resourceId: Number(params.resourceId) },
    });
    if (!detail) throw notFound();
    return detail;
  },
  /**
   * Builds document metadata for the loaded editable resource.
   *
   * @param context - Route callback context.
   * @param context.loaderData - Resolved route loader data.
   * @returns Metadata emitted for the route.
   */
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? formatTranslation("web.resources.management.editTitle", {
              name: loaderData.name,
            })
          : formatTranslation("web.resources.management.title"),
      },
    ],
  }),
});

/**
 * Renders the resource edit page route content.
 *
 * @returns The rendered route UI.
 */
function ResourceEditPageRoute() {
  return <ResourceEditPage detail={Route.useLoaderData()} />;
}
