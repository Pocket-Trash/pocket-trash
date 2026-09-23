import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { getUserCollectionById } from "@/lib/catalog-api";
import { parseCatalogFilterSearch } from "@/lib/catalog-filters";
import { useCatalogFilters } from "@/lib/use-catalog-filters";
import { CollectionPage } from "@/pages/catalog-pages";

export const Route = createFileRoute("/user/collections_/$collectionId")({
  params: {
    parse: ({ collectionId }) => ({ collectionId: Number(collectionId) }),
    stringify: ({ collectionId }) => ({ collectionId: String(collectionId) }),
  },
  validateSearch: parseCatalogFilterSearch,
  loader: async ({ params }) => {
    if (
      !Number.isSafeInteger(params.collectionId) ||
      params.collectionId <= 0
    ) {
      throw notFound();
    }
    const result = await getUserCollectionById({ data: params });
    if (!result) throw notFound();
    return result;
  },
  component: UserCollectionRoute,
});

function UserCollectionRoute() {
  const navigate = useNavigate();
  const data = Route.useLoaderData();
  const [filters, setFilters] = useCatalogFilters(
    Route.useSearch(),
    (search) =>
      void navigate({
        params: { collectionId: data.collection.id },
        replace: true,
        search,
        to: "/user/collections/$collectionId",
      }),
  );
  return (
    <CollectionPage
      collection={data.collection}
      filters={filters}
      items={data.items}
      onFiltersChange={setFilters}
    />
  );
}
