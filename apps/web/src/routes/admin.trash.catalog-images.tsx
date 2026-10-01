import { createFileRoute, redirect } from "@tanstack/react-router";
import { isCatalogAdmin, listCatalogImageTrash } from "@/lib/catalog-api";
import { CatalogImageTrashPage } from "@/pages/catalog-image-trash-page";

export const Route = createFileRoute("/admin/trash/catalog-images")({
  beforeLoad: async () => {
    if (!(await isCatalogAdmin())) throw redirect({ to: "/" });
  },
  loader: () => listCatalogImageTrash(),
  component: () => (
    <CatalogImageTrashPage initialImages={Route.useLoaderData()} />
  ),
});
