import { createFileRoute } from "@tanstack/react-router";
import { CollectionFormPage } from "@/pages/catalog-form-pages";

export const Route = createFileRoute("/user/collections_/add")({
  component: () => <CollectionFormPage />,
});
