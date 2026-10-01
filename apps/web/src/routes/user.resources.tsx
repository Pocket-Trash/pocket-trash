import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute } from "@tanstack/react-router";
import { listOwnedResources } from "@/lib/resources";
import { ResourceManagementPage } from "@/pages/resource-management-pages";

/**
 * Defines the `/user/resources` route and its data lifecycle.
 */
export const Route = createFileRoute("/user/resources")({
  component: ResourceManagementRoute,
  /**
   * Builds document metadata for the user resources route.
   *
   * @returns Metadata emitted for the route.
   */
  head: () => ({
    meta: [{ title: formatTranslation("web.resources.management.title") }],
  }),
  /**
   * Loads resources owned by the current user.
   *
   * @returns The route's loader data.
   */
  loader: () => listOwnedResources(),
});

/**
 * Renders the resource management route content.
 *
 * @returns The rendered route UI.
 */
function ResourceManagementRoute() {
  return <ResourceManagementPage resources={Route.useLoaderData()} />;
}
