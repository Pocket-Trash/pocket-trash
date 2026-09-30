import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { getPublicCollection } from "@/lib/catalog-api";
import { parseCatalogFilterSearch } from "@/lib/catalog-filters";
import { useCatalogFilters } from "@/lib/use-catalog-filters";
import { CollectionPage } from "@/pages/catalog-pages";

export const Route = createFileRoute("/collections_/$userId/$collectionId")({
  params: {
    parse: ({ collectionId, userId }) => ({
      collectionId: Number(collectionId),
      userId: Number(userId),
    }),
    stringify: ({ collectionId, userId }) => ({
      collectionId: String(collectionId),
      userId: String(userId),
    }),
  },
  validateSearch: parseCatalogFilterSearch,
  loader: async ({ params }) => {
    if (
      !Number.isSafeInteger(params.userId) ||
      !Number.isSafeInteger(params.collectionId) ||
      params.userId <= 0 ||
      params.collectionId <= 0
    ) {
      throw notFound();
    }
    const result = await getPublicCollection({ data: params });
    if (!result) throw notFound();
    return result;
  },
  component: PublicCollectionRoute,
});

function PublicCollectionRoute() {
  const navigate = useNavigate();
  const data = Route.useLoaderData();
  const [filters, setFilters] = useCatalogFilters(
    Route.useSearch(),
    (search) =>
      void navigate({
        params: {
          collectionId: data.collection.id,
          userId: data.collection.ownerUserId,
        },
        replace: true,
        search,
        to: "/collections/$userId/$collectionId",
      }),
  );
  return (
    <CollectionPage
      collection={data.collection}
      filters={filters}
      items={data.items}
      onFiltersChange={setFilters}
      ownerUsername={data.ownerUsername}
    />
  );
}
