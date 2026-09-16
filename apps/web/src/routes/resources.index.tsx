import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute } from "@tanstack/react-router";
import { listResourceDirectory } from "@/lib/resources";
import {
  ResourceDirectoryStatusPage,
  ResourcesPage,
} from "@/pages/resources-page";

export const Route = createFileRoute("/resources/")({
  component: ResourceDirectoryRoute,
  errorComponent: () => (
    <ResourceDirectoryStatusPage messageKey="web.resources.error.loadDirectory" />
  ),
  head: () => ({
    meta: [{ title: formatTranslation("web.resources.directory.title") }],
  }),
  validateSearch: (
    search: Record<string, unknown>,
  ): { category?: string[] } => {
    const value = search.category;
    const categories = (
      Array.isArray(value) ? value : value === undefined ? [] : [value]
    ).filter((category): category is string => typeof category === "string");

    return categories.length > 0 ? { category: [...new Set(categories)] } : {};
  },
  loaderDeps: ({ search }) => ({ category: search.category ?? [] }),
  loader: ({ deps }) =>
    listResourceDirectory({ data: { categorySlugs: deps.category } }),
  pendingComponent: () => (
    <ResourceDirectoryStatusPage messageKey="web.resources.directory.loading" />
  ),
});

function ResourceDirectoryRoute() {
  const directory = Route.useLoaderData();
  const { category = [] } = Route.useSearch();
  return (
    <ResourcesPage directory={directory} selectedCategorySlugs={category} />
  );
}
