import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { getAuthState } from "@/lib/auth";
import { getOwnedResourceDetail } from "@/lib/resources";
import { ResourceVersionUploadPage } from "@/pages/resource-management-pages";

/**
 * Defines the `/resources/$resourceId_/versions/new` route and its data lifecycle.
 */
export const Route = createFileRoute("/resources/$resourceId_/versions/new")({
  /**
   * Requires authentication before entering the resource-version upload route.
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
  component: ResourceVersionUploadRoute,
  /**
   * Loads an owned resource for a new version upload.
   *
   * @param context - Route callback context.
   * @param context.params - Parsed route parameters.
   * @returns The route's loader data.
   * @throws When the requested route data is unavailable or access is denied.
   * @rejects When the requested route data is unavailable or access is denied.
   */
  loader: async ({ params }) => {
    const detail = await getOwnedResourceDetail({
      data: { resourceId: Number(params.resourceId) },
    });
    if (!detail) throw notFound();
    return detail;
  },
  /**
   * Builds document metadata for the loaded resource version upload.
   *
   * @param context - Route callback context.
   * @param context.loaderData - Resolved route loader data.
   * @returns Metadata emitted for the route.
   */
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? formatTranslation("web.resources.upload.newVersionTitle", {
              name: loaderData.name,
            })
          : formatTranslation("web.resources.management.title"),
      },
    ],
  }),
});

/**
 * Renders the resource version upload route content.
 *
 * @returns The rendered route UI.
 */
function ResourceVersionUploadRoute() {
  return <ResourceVersionUploadPage detail={Route.useLoaderData()} />;
}
