import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { getUserCollectionById } from "@/lib/catalog-api";
import { parseCatalogFilterSearch } from "@/lib/catalog-filters";
import { useCatalogFilters } from "@/lib/use-catalog-filters";
import { CollectionPage } from "@/pages/catalog-pages";

/**
 * Shows one collection owned by the current user.
 */
export const Route = createFileRoute("/user/collections_/$collectionId")({
  params: {
    /**
     * Parses serialized route parameters into typed identifiers.
     *
     * @param context - Route callback context.
     * @param context.collectionId - Collection identifier.
     * @returns Typed route parameters.
     */
    parse: ({ collectionId }) => ({ collectionId: Number(collectionId) }),
    /**
     * Serializes typed route identifiers for URL generation.
     *
     * @param context - Route callback context.
     * @param context.collectionId - Collection identifier.
     * @returns Serialized route parameters.
     */
    stringify: ({ collectionId }) => ({ collectionId: String(collectionId) }),
  },
  validateSearch: parseCatalogFilterSearch,
  /**
   * Loads one of the current user's collections and its items.
   *
   * @param context - Route callback context.
   * @param context.params - Parsed route parameters.
   * @returns The owned collection and its items.
   * @rejects When the identifier is invalid or the owned collection cannot be loaded.
   */
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

/**
 * Renders the user collection route content.
 *
 * @returns The rendered route UI.
 */
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
