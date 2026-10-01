import { createFileRoute } from "@tanstack/react-router";
import { CollectionFormPage } from "@/pages/catalog-form-pages";

/**
 * Provides collection creation for the current user.
 */
export const Route = createFileRoute("/user/collections_/add")({
  /**
   * Renders the user collections add route.
   *
   * @returns The rendered route UI.
   */
  component: () => <CollectionFormPage />,
});
