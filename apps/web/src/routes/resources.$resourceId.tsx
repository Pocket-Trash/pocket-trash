import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { getResourceDetail } from "@/lib/resources";
import { ResourceDetailPage } from "@/pages/resource-detail-page";

/**
 * Shows one publicly readable resource.
 */
export const Route = createFileRoute("/resources/$resourceId")({
  component: ResourceRoute,
  /**
   * Loads a public resource detail from its identifier.
   *
   * @param context - Route callback context.
   * @param context.params - Parsed route parameters.
   * @returns The publicly readable resource detail.
   * @rejects When the public resource cannot be loaded.
   */
  loader: async ({ params }) => {
    const detail = await getResourceDetail({
      data: { resourceId: Number(params.resourceId) },
    });
    if (!detail) throw notFound();
    return detail;
  },
  /**
   * Builds document metadata for the loaded resource.
   *
   * @param context - Route callback context.
   * @param context.loaderData - Resolved route loader data.
   * @returns Metadata emitted for the route.
   */
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `${loaderData.name} · ${formatTranslation("web.resources.directory.title")}`
          : formatTranslation("web.resources.directory.title"),
      },
    ],
  }),
});

/**
 * Renders the resource route content.
 *
 * @returns The rendered route UI.
 */
function ResourceRoute() {
  return <ResourceDetailPage detail={Route.useLoaderData()} />;
}
