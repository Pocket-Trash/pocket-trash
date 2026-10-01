import { createFileRoute, notFound } from "@tanstack/react-router";
import {
  getCollectionDeletionContext,
  getUserCollectionById,
} from "@/lib/catalog-api";
import { CollectionFormPage } from "@/pages/catalog-form-pages";

/** Route configuration for editing a collection. */
export const Route = createFileRoute("/user/collections_/$collectionId_/edit")({
  params: {
    parse: ({ collectionId }) => ({ collectionId: Number(collectionId) }),
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
