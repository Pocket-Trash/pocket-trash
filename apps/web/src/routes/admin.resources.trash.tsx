import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { isResourceAdmin, listAdminResourceTrash } from "@/lib/resources";
import { AdminResourceTrashPage } from "@/pages/resource-trash-page";

export const Route = createFileRoute("/admin/resources/trash")({
  beforeLoad: async () => {
    if (!(await isResourceAdmin())) throw notFound();
  },
  component: AdminResourceTrashRoute,
  head: () => ({
    meta: [{ title: formatTranslation("web.resources.trash.adminTitle") }],
  }),
  loader: () => listAdminResourceTrash(),
});

function AdminResourceTrashRoute() {
  return <AdminResourceTrashPage initialResources={Route.useLoaderData()} />;
}
