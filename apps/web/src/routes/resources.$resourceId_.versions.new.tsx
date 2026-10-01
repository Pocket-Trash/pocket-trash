import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { getAuthState } from "@/lib/auth";
import { getOwnedResourceDetail } from "@/lib/resources";
import { ResourceVersionUploadPage } from "@/pages/resource-management-pages";

/**
 * Provides a new-version upload for an owned resource.
 */
export const Route = createFileRoute("/resources/$resourceId_/versions/new")({
  /**
   * Requires authentication before entering the resource-version upload route.
   *
   * @rejects When authentication cannot be checked or an unauthenticated visitor is redirected to sign in.
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
   * @returns The owned resource detail.
   * @rejects When an owned resource cannot be loaded.
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
