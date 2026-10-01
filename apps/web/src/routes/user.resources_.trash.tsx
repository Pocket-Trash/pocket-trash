import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute } from "@tanstack/react-router";
import { listOwnerResourceTrash } from "@/lib/resources";
import { OwnerResourceTrashPage } from "@/pages/resource-trash-page";

/**
 * Shows resources trashed by the current user.
 */
export const Route = createFileRoute("/user/resources_/trash")({
  component: OwnerResourceTrashRoute,
  /**
   * Builds document metadata for the user resources trash route.
   *
   * @returns Metadata emitted for the route.
   */
  head: () => ({
    meta: [{ title: formatTranslation("web.resources.trash.ownerTitle") }],
  }),
  /**
   * Loads the current user's trashed resources.
   *
   * @returns Resources trashed by the current user.
   * @rejects When the current user's trashed resources cannot be loaded.
   */
  loader: () => listOwnerResourceTrash(),
});

/**
 * Renders the owner resource trash route content.
 *
 * @returns The rendered route UI.
 */
function OwnerResourceTrashRoute() {
  return <OwnerResourceTrashPage initialResources={Route.useLoaderData()} />;
}
