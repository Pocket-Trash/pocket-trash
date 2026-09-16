import { createFileRoute, redirect } from "@tanstack/react-router";
import { getAuthState } from "@/lib/auth";
import { getCatalogOptions, listCatalogProducts } from "@/lib/catalog-api";
import { CollectionAddPage } from "@/pages/catalog-form-pages";

export const Route = createFileRoute("/collections/add")({
  beforeLoad: async () => {
    if (!(await getAuthState()).isAuthenticated) {
      throw redirect({ params: { _splat: "" }, to: "/sign-in/$" });
    }
  },
  loader: async () => {
    const [options, products] = await Promise.all([
      getCatalogOptions(),
      listCatalogProducts(),
    ]);
    return { options, products };
  },
  component: CollectionAddRoute,
});

function CollectionAddRoute() {
  return <CollectionAddPage {...Route.useLoaderData()} />;
}
