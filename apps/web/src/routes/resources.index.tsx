import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute } from "@tanstack/react-router";
import { listResourceDirectory } from "@/lib/resources";
import {
  ResourceDirectoryStatusPage,
  ResourcesPage,
} from "@/pages/resources-page";

/**
 * Defines the `/resources/` route and its data lifecycle.
 */
export const Route = createFileRoute("/resources/")({
  component: ResourceDirectoryRoute,
  /**
   * Builds document metadata for the resources route.
   *
   * @returns Metadata emitted for the route.
   */
  head: () => ({
    meta: [{ title: formatTranslation("web.resources.directory.title") }],
  }),
  /**
   * Normalizes search parameters accepted by the route.
   *
   * @param search - Untrusted URL search parameters.
   * @returns Normalized route search state.
   */
  validateSearch: (
    search: Record<string, unknown>,
  ): {
    /**
     * Optional resource-category slug filters.
     */
    category?: string[];
  } => {
    const value = search.category;
    const categories = (
      Array.isArray(value) ? value : value === undefined ? [] : [value]
    ).filter((category): category is string => typeof category === "string");

    return categories.length > 0 ? { category: [...new Set(categories)] } : {};
  },
  /**
   * Selects normalized search state that invalidates the route loader.
   *
   * @param context - Route callback context.
   * @param context.search - Validated route search state.
   * @returns Normalized loader dependencies.
   */
  loaderDeps: ({ search }) => ({ category: search.category ?? [] }),
  /**
   * Loads the resource directory for the selected categories.
   *
   * @param context - Route callback context.
   * @param context.deps - Normalized loader dependencies.
   * @returns The route's loader data.
   */
  loader: ({ deps }) =>
    listResourceDirectory({ data: { categorySlugs: deps.category } }),
  /**
   * Renders the resources route while its loader is pending.
   *
   * @returns The route loading UI.
   */
  pendingComponent: () => (
    <ResourceDirectoryStatusPage messageKey="web.resources.directory.loading" />
  ),
});

/**
 * Renders the resource directory route content.
 *
 * @returns The rendered route UI.
 */
function ResourceDirectoryRoute() {
  const directory = Route.useLoaderData();
  const { category = [] } = Route.useSearch();
  return (
    <ResourcesPage directory={directory} selectedCategorySlugs={category} />
  );
}
