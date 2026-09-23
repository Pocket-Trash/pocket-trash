import { createFileRoute, redirect } from "@tanstack/react-router";
import { listCatalogImageTrash } from "@/lib/catalog-api";
import { isResourceAdmin } from "@/lib/resources";
import { CatalogImageTrashPage } from "@/pages/catalog-image-trash-page";

export const Route = createFileRoute("/admin/catalog-images/trash")({
  beforeLoad: async () => {
    if (!(await isResourceAdmin())) throw redirect({ to: "/" });
  },
  loader: () => listCatalogImageTrash(),
  component: () => (
    <CatalogImageTrashPage initialImages={Route.useLoaderData()} />
  ),
});
