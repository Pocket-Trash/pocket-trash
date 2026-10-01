import { createFileRoute, notFound } from "@tanstack/react-router";
import { getPublicCollectionItem } from "@/lib/catalog-api";
import { CollectionItemDetailPage } from "@/pages/catalog-pages";

/**
 * Defines the `/collections_/$userId/$collectionId_/$collectionItemId` route and its data lifecycle.
 */
export const Route = createFileRoute(
  "/collections_/$userId/$collectionId_/$collectionItemId",
)({
  params: {
    /**
     * Parses serialized route parameters into typed identifiers.
     *
     * @param context - Route callback context.
     * @param context.collectionId - Collection identifier.
     * @param context.collectionItemId - Collection item identifier.
     * @param context.userId - User identifier.
     * @returns Typed route parameters.
     */
    parse: ({ collectionId, collectionItemId, userId }) => ({
      collectionId: Number(collectionId),
      collectionItemId: Number(collectionItemId),
      userId: Number(userId),
    }),
    /**
     * Serializes typed route identifiers for URL generation.
     *
     * @param context - Route callback context.
     * @param context.collectionId - Collection identifier.
     * @param context.collectionItemId - Collection item identifier.
     * @param context.userId - User identifier.
     * @returns Serialized route parameters.
     */
    stringify: ({ collectionId, collectionItemId, userId }) => ({
      collectionId: String(collectionId),
      collectionItemId: String(collectionItemId),
      userId: String(userId),
    }),
  },
  /**
   * Loads a public collection item and its detail context.
   *
   * @param context - Route callback context.
   * @param context.params - Parsed route parameters.
   * @returns The route's loader data.
   * @throws When the requested route data is unavailable or access is denied.
   * @rejects When the requested route data is unavailable or access is denied.
   */
  loader: async ({ params }) => {
    if (
      Object.values(params).some(
        (value) => !Number.isSafeInteger(value) || value <= 0,
      )
    ) {
      throw notFound();
    }
    const detail = await getPublicCollectionItem({ data: params });
    if (!detail) throw notFound();
    return detail;
  },
  /**
   * Renders the public collection-item detail route.
   *
   * @returns The rendered route UI.
   */
  component: () => <CollectionItemDetailPage {...Route.useLoaderData()} />,
});
