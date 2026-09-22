import { createFileRoute, redirect } from "@tanstack/react-router";
import { getAuthState } from "@/lib/auth";
import {
  getCatalogOptions,
  getUserCollectionSummary,
  listCatalogProducts,
} from "@/lib/catalog-api";
import { CollectionAddPage } from "@/pages/catalog-form-pages";

export const Route = createFileRoute("/collections/add")({
  beforeLoad: async () => {
    if (!(await getAuthState()).isAuthenticated) {
      throw redirect({ params: { _splat: "" }, to: "/sign-in/$" });
    }
  },
  loader: async () => {
    const [options, products, collection] = await Promise.all([
      getCatalogOptions(),
      listCatalogProducts(),
      getUserCollectionSummary(),
    ]);
    return {
      collectionIsPrivate: collection?.isPrivate ?? true,
      options,
      products,
    };
  },
  component: CollectionAddRoute,
});

function CollectionAddRoute() {
  return <CollectionAddPage {...Route.useLoaderData()} />;
}
