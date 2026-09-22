import { createFileRoute, notFound } from "@tanstack/react-router";
import { getPublicCollectionItem } from "@/lib/catalog-api";
import { CollectionItemDetailPage } from "@/pages/catalog-pages";

export const Route = createFileRoute("/collections/$userId/$collectionItemId")({
  params: {
    parse: ({ collectionItemId }) => ({
      collectionItemId: Number(collectionItemId),
    }),
    stringify: ({ collectionItemId }) => ({
      collectionItemId: String(collectionItemId),
    }),
  },
  loader: async ({ params }) => {
    if (
      !Number.isSafeInteger(params.userId) ||
      !Number.isSafeInteger(params.collectionItemId) ||
      params.userId <= 0 ||
      params.collectionItemId <= 0
    )
      throw notFound();
    const item = await getPublicCollectionItem({ data: params });
    if (!item) throw notFound();
    return item;
  },
  component: () => <CollectionItemDetailPage item={Route.useLoaderData()} />,
});
