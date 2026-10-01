import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { getAuthState } from "@/lib/auth";
import { getCatalogOptions, getCollectionEditData } from "@/lib/catalog-api";
import { CollectionEditPage } from "@/pages/catalog-form-pages";

/**
 * Provides authenticated collection-item editing.
 */
export const Route = createFileRoute("/collections/edit/$collectionItemId")({
  params: {
    /**
     * Parses serialized route parameters into typed identifiers.
     *
     * @param context - Route callback context.
     * @param context.collectionItemId - Collection item identifier.
     * @returns Typed route parameters.
     */
    parse: ({ collectionItemId }) => ({
      collectionItemId: Number(collectionItemId),
    }),
    /**
     * Serializes typed route identifiers for URL generation.
     *
     * @param context - Route callback context.
     * @param context.collectionItemId - Collection item identifier.
     * @returns Serialized route parameters.
     */
    stringify: ({ collectionItemId }) => ({
      collectionItemId: String(collectionItemId),
    }),
  },
  /**
   * Requires authentication before entering the collection-item edit route.
   *
   * @rejects When an unauthenticated visitor is redirected to sign in.
   */
  beforeLoad: async () => {
    if (!(await getAuthState()).isAuthenticated) {
      throw redirect({ params: { _splat: "" }, to: "/sign-in/$" });
    }
  },
  /**
   * Loads an editable collection item, product, ownership data, and form options.
   *
   * @param context - Route callback context.
   * @param context.params - Parsed route parameters.
   * @returns The editable item, product, ownership data, and form options.
   * @rejects When the item is unavailable or its edit context cannot be loaded.
   */
  loader: async ({ params }) => {
    if (!Number.isInteger(params.collectionItemId)) throw notFound();
    const [data, options] = await Promise.all([
      getCollectionEditData({ data: params }),
      getCatalogOptions(),
    ]);
    if (!data.item || !data.product) throw notFound();
    return {
      buttonProducts: data.buttonProducts,
      collections: data.collections,
      item: data.item,
      ownedButtons: data.ownedButtons,
      options,
      product: data.product,
    };
  },
  component: CollectionEditRoute,
});

/**
 * Renders the collection edit route content.
 *
 * @returns The rendered route UI.
 */
function CollectionEditRoute() {
  return <CollectionEditPage {...Route.useLoaderData()} />;
}
