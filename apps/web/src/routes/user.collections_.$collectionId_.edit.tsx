import { createFileRoute, notFound } from "@tanstack/react-router";
import { getUserCollectionById } from "@/lib/catalog-api";
import { CollectionFormPage } from "@/pages/catalog-form-pages";

export const Route = createFileRoute("/user/collections_/$collectionId_/edit")({
  params: {
    parse: ({ collectionId }) => ({ collectionId: Number(collectionId) }),
    stringify: ({ collectionId }) => ({ collectionId: String(collectionId) }),
  },
  loader: async ({ params }) => {
    if (
      !Number.isSafeInteger(params.collectionId) ||
      params.collectionId <= 0
    ) {
      throw notFound();
    }
    const result = await getUserCollectionById({ data: params });
    if (!result) throw notFound();
    return result.collection;
  },
  component: () => <CollectionFormPage collection={Route.useLoaderData()} />,
});
