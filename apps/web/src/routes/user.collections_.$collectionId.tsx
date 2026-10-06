import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import {
  getUserCollectionById,
  listCatalogTerminologyAliases,
} from "@/lib/catalog-api";
import { parseCatalogFilterSearch } from "@/lib/catalog-filters";
import { useCatalogFilters } from "@/lib/use-catalog-filters";
import { CollectionPage } from "@/pages/catalog-pages";

/**
 * Shows one collection owned by the current user.
 */
export const Route = createFileRoute("/user/collections_/$collectionId")({
  params: {
    /**
     * Converts the collection identifier from the URL to a number.
     *
     * @param context - Route callback context.
     * @param context.collectionId - Collection identifier.
     * @returns Route parameters containing the numeric collection identifier.
     */
    parse: ({ collectionId }) => ({ collectionId: Number(collectionId) }),
    /**
     * Serializes the numeric collection identifier for URL generation.
     *
     * @param context - Route callback context.
     * @param context.collectionId - Collection identifier.
     * @returns Route parameters containing the collection identifier serialized for the URL.
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
    const [result, aliases] = await Promise.all([
      getUserCollectionById({ data: params }),
      listCatalogTerminologyAliases(),
    ]);
    if (!result) throw notFound();
    return { ...result, aliases };
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
      aliases={data.aliases}
      collection={data.collection}
      filters={filters}
      items={data.items}
      onFiltersChange={setFilters}
      userArea
    />
  );
}
