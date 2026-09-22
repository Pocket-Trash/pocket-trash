import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute } from "@tanstack/react-router";
import { listOwnerResourceTrash } from "@/lib/resources";
import { OwnerResourceTrashPage } from "@/pages/resource-trash-page";

export const Route = createFileRoute("/user/resources_/trash")({
  component: OwnerResourceTrashRoute,
  head: () => ({
    meta: [{ title: formatTranslation("web.resources.trash.ownerTitle") }],
  }),
  loader: () => listOwnerResourceTrash(),
});

function OwnerResourceTrashRoute() {
  return <OwnerResourceTrashPage initialResources={Route.useLoaderData()} />;
}
