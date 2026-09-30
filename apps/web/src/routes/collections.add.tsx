import { createFileRoute, redirect } from "@tanstack/react-router";
import { getAuthState } from "@/lib/auth";
import {
  getCatalogOptions,
  getCollectionAddContext,
  listCatalogProducts,
} from "@/lib/catalog-api";
import { CollectionAddPage } from "@/pages/catalog-form-pages";

export const Route = createFileRoute("/collections/add")({
  validateSearch: (search: Record<string, unknown>): { product?: number } => {
    const product = Number(search.product);
    return Number.isSafeInteger(product) && product > 0 ? { product } : {};
  },
  beforeLoad: async () => {
    if (!(await getAuthState()).isAuthenticated) {
      throw redirect({ params: { _splat: "" }, to: "/sign-in/$" });
    }
  },
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

function CollectionAddRoute() {
  return (
    <CollectionAddPage
      {...Route.useLoaderData()}
      initialProductId={Route.useSearch().product}
    />
  );
}
