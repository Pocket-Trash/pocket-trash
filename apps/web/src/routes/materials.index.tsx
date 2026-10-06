import { createFileRoute } from "@tanstack/react-router";
import { listPublicMaterials } from "@/lib/catalog-api";
import { MaterialsPage } from "@/pages/material-pages";

/** Shows the public A-Z materials directory. */
export const Route = createFileRoute("/materials/")({
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
  return <MaterialsPage materials={Route.useLoaderData()} />;
}
