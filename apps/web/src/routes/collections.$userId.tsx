import { createFileRoute, notFound } from "@tanstack/react-router";
import { getPublicCollectionOwner } from "@/lib/catalog-api";
import { PublicCollectionPage } from "@/pages/catalog-pages";

/**
 * Shows the public collection profile for one user.
 */
export const Route = createFileRoute("/collections/$userId")({
  params: {
    /**
     * Parses serialized route parameters into typed identifiers.
     *
     * @param context - Route callback context.
     * @param context.userId - User identifier.
     * @returns Typed route parameters.
     */
    parse: ({ userId }) => ({ userId: Number(userId) }),
    /**
     * Serializes typed route identifiers for URL generation.
     *
     * @param context - Route callback context.
     * @param context.userId - User identifier.
     * @returns Serialized route parameters.
     */
    stringify: ({ userId }) => ({ userId: String(userId) }),
  },
  /**
   * Loads a public collection owner from a numeric user identifier.
   *
   * @param context - Route callback context.
   * @param context.params - Parsed route parameters.
   * @returns The public collection owner.
   * @rejects When the user identifier is invalid or its public owner cannot be loaded.
   */
  loader: async ({ params }) => {
    if (!Number.isSafeInteger(params.userId) || params.userId <= 0) {
      throw notFound();
    }
    const owner = await getPublicCollectionOwner({ data: params });
    if (!owner) throw notFound();
    return owner;
  },
  component: PublicCollectionRoute,
});

/**
 * Renders the public collection route content.
 *
 * @returns The rendered route UI.
 */
function PublicCollectionRoute() {
  return <PublicCollectionPage owner={Route.useLoaderData()} />;
}
