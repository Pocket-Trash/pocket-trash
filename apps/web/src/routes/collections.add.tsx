import { createFileRoute, redirect } from "@tanstack/react-router";
import { getAuthState } from "@/lib/auth";
import {
  getCatalogOptions,
  getCollectionAddContext,
  listCatalogProducts,
} from "@/lib/catalog-api";
import { CollectionAddPage } from "@/pages/catalog-form-pages";

/**
 * Provides authenticated collection-item creation.
 */
export const Route = createFileRoute("/collections/add")({
  /**
   * Normalizes search parameters accepted by the route.
   *
   * @param search - Untrusted URL search parameters.
   * @returns Normalized route search state.
   */
  validateSearch: (
    search: Record<string, unknown>,
  ): {
    /**
     * Optional catalog product identifier to preselect.
     */
    product?: number;
  } => {
    const product = Number(search.product);
    return Number.isSafeInteger(product) && product > 0 ? { product } : {};
  },
  /**
   * Requires authentication before entering the collections add route.
   *
   * @rejects When authentication cannot be checked or an unauthenticated visitor is redirected to sign in.
   */
  beforeLoad: async () => {
    if (!(await getAuthState()).isAuthenticated) {
      throw redirect({ params: { _splat: "" }, to: "/sign-in/$" });
    }
  },
  /**
   * Loads catalog options, products, and collection context for adding an item.
   *
   * @returns Catalog options, products, and collection choices for the add form.
   * @rejects When collection form context or catalog data cannot be loaded.
   */
  loader: async () => {
    const [options, products, collectionContext] = await Promise.all([
      getCatalogOptions(),
      listCatalogProducts(),
      getCollectionAddContext(),
    ]);
    return {
      ...collectionContext,
      options,
      products,
    };
  },
  component: CollectionAddRoute,
});

/**
 * Renders the collection add route content.
 *
 * @returns The rendered route UI.
 */
function CollectionAddRoute() {
  return (
    <CollectionAddPage
      {...Route.useLoaderData()}
      initialProductId={Route.useSearch().product}
    />
  );
}
