import { createFileRoute } from "@tanstack/react-router";
import { CollectionFormPage } from "@/pages/catalog-form-pages";

/**
 * Defines the `/user/collections_/add` route and its data lifecycle.
 */
export const Route = createFileRoute("/user/collections_/add")({
  /**
   * Renders the user collections add route.
   *
   * @returns The rendered route UI.
   */
  component: () => <CollectionFormPage />,
});
