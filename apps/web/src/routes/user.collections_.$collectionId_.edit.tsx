import { createFileRoute, notFound } from "@tanstack/react-router";
import {
  getCollectionDeletionContext,
  getUserCollectionById,
} from "@/lib/catalog-api";
import { CollectionFormPage } from "@/pages/catalog-form-pages";

/** Provides collection editing for the current user. */
export const Route = createFileRoute("/user/collections_/$collectionId_/edit")({
  params: {
    /**
     * Converts the editable collection identifier from the URL to a number.
     *
     * @param context - Route callback context.
     * @param context.collectionId - Collection identifier.
     * @returns The numeric collection identifier.
     */
    parse: ({ collectionId }) => ({ collectionId: Number(collectionId) }),
    /**
     * Serializes the numeric collection identifier for URL generation.
     *
     * @param context - Route callback context.
     * @param context.collectionId - Collection identifier.
     * @returns The collection identifier serialized for the URL.
     */
    stringify: ({ collectionId }) => ({ collectionId: String(collectionId) }),
  },
  /**
   * Loads the editable collection and its deletion choices.
   *
   * @param context - Route loader context.
   * @param context.params - Parsed route parameters.
   * @returns Collection edit data.
   * @rejects When the collection cannot be edited.
   */
  loader: async ({ params }) => {
    if (
      !Number.isSafeInteger(params.collectionId) ||
      params.collectionId <= 0
    ) {
      throw notFound();
    }
    const [result, deletion] = await Promise.all([
      getUserCollectionById({ data: params }),
      getCollectionDeletionContext({ data: params }),
    ]);
    if (!result || !deletion) throw notFound();
    return {
      collection: result.collection,
      deletion,
    };
  },
  component: CollectionEditRoute,
});

/**
 * Renders the collection edit page.
 *
 * @returns The collection edit page.
 */
function CollectionEditRoute() {
  const { collection, deletion } = Route.useLoaderData();
  return <CollectionFormPage collection={collection} deletion={deletion} />;
}
