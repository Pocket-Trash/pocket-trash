import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import {
  getPublicCollection,
  listCatalogTerminologyAliases,
} from "@/lib/catalog-api";
import { parseCatalogFilterSearch } from "@/lib/catalog-filters";
import { useCatalogFilters } from "@/lib/use-catalog-filters";
import { CollectionPage } from "@/pages/catalog-pages";

/**
 * Shows one public collection and its visible items.
 */
export const Route = createFileRoute("/collections_/$userId/$collectionId")({
  params: {
    /**
     * Converts the public collection identifiers from the URL to numbers.
     *
     * @param context - Route callback context.
     * @param context.collectionId - Collection identifier.
     * @param context.userId - User identifier.
     * @returns Route parameters containing the numeric user and collection identifiers.
     */
    parse: ({ collectionId, userId }) => ({
      collectionId: Number(collectionId),
      userId: Number(userId),
    }),
    /**
     * Serializes the numeric public collection identifiers for URL generation.
     *
     * @param context - Route callback context.
     * @param context.collectionId - Collection identifier.
     * @param context.userId - User identifier.
     * @returns Route parameters containing the user and collection identifiers serialized for the URL.
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
   * @returns The public collection, owner name, and visible items.
   * @rejects When the identifiers are invalid or the public collection cannot be loaded.
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
    const [result, aliases] = await Promise.all([
      getPublicCollection({ data: params }),
      listCatalogTerminologyAliases(),
    ]);
    if (!result) throw notFound();
    return { ...result, aliases };
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
      aliases={data.aliases}
      collection={data.collection}
      filters={filters}
      items={data.items}
      onFiltersChange={setFilters}
      ownerImageUrl={data.ownerImageUrl}
      ownerUsername={data.ownerUsername}
    />
  );
}
