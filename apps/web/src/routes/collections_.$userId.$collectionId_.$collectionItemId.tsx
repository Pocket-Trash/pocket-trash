import { createFileRoute, notFound } from "@tanstack/react-router";
import { getPublicCollectionItem } from "@/lib/catalog-api";
import { CollectionItemDetailPage } from "@/pages/catalog-pages";

export const Route = createFileRoute(
  "/collections_/$userId/$collectionId_/$collectionItemId",
)({
  params: {
    parse: ({ collectionId, collectionItemId, userId }) => ({
      collectionId: Number(collectionId),
      collectionItemId: Number(collectionItemId),
      userId: Number(userId),
    }),
    stringify: ({ collectionId, collectionItemId, userId }) => ({
      collectionId: String(collectionId),
      collectionItemId: String(collectionItemId),
      userId: String(userId),
    }),
  },
  loader: async ({ params }) => {
    if (
      Object.values(params).some(
        (value) => !Number.isSafeInteger(value) || value <= 0,
      )
    ) {
      throw notFound();
    }
    const item = await getPublicCollectionItem({ data: params });
    if (!item) throw notFound();
    return item;
  },
  component: () => <CollectionItemDetailPage item={Route.useLoaderData()} />,
});
