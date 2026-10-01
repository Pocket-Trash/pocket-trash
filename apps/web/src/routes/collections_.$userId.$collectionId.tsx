import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { getPublicCollection } from "@/lib/catalog-api";
import { parseCatalogFilterSearch } from "@/lib/catalog-filters";
import { useCatalogFilters } from "@/lib/use-catalog-filters";
import { CollectionPage } from "@/pages/catalog-pages";

/**
 * Defines the `/collections_/$userId/$collectionId` route and its data lifecycle.
 */
export const Route = createFileRoute("/collections_/$userId/$collectionId")({
  params: {
    /**
     * Parses serialized route parameters into typed identifiers.
     *
     * @param context - Route callback context.
     * @param context.collectionId - Collection identifier.
     * @param context.userId - User identifier.
     * @returns Typed route parameters.
     */
    parse: ({ collectionId, userId }) => ({
      collectionId: Number(collectionId),
      userId: Number(userId),
    }),
    /**
     * Serializes typed route identifiers for URL generation.
     *
     * @param context - Route callback context.
     * @param context.collectionId - Collection identifier.
     * @param context.userId - User identifier.
     * @returns Serialized route parameters.
     */
    stringify: ({ collectionId, userId }) => ({
      collectionId: String(collectionId),
      userId: String(userId),
    }),
  },
  validateSearch: parseCatalogFilterSearch,
  /**
   * Loads a public collection and its visible items.
   *
   * @param context - Route callback context.
   * @param context.params - Parsed route parameters.
   * @returns The route's loader data.
   * @throws When the requested route data is unavailable or access is denied.
   * @rejects When the requested route data is unavailable or access is denied.
   */
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

/**
 * Renders the public collection route content.
 *
 * @returns The rendered route UI.
 */
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
