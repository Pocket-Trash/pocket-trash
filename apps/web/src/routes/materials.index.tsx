import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { listPublicMaterials } from "@/lib/catalog-api";
import { parseDirectorySearch } from "@/lib/directory-search";
import { MaterialsPage } from "@/pages/material-pages";

/** Shows the public A-Z materials directory. */
export const Route = createFileRoute("/materials/")({
  validateSearch: parseDirectorySearch,
  /**
   * Loads every public material summary.
   *
   * @returns Every public material summary.
   */
  loader: () => listPublicMaterials(),
  component: MaterialsRoute,
});

/**
 * Renders the public materials directory route.
 *
 * @returns The public materials directory route.
 */
function MaterialsRoute() {
  const navigate = useNavigate();
  const { q = "" } = Route.useSearch();
  return (
    <MaterialsPage
      materials={Route.useLoaderData()}
      onQueryChange={(query) =>
        void navigate({
          replace: true,
          search: query ? { q: query } : {},
          to: "/materials",
        })
      }
      query={q}
    />
  );
}
