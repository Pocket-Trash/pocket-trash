import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { getAuthState } from "@/lib/auth";
import { getCatalogOptions, getCollectionEditData } from "@/lib/catalog-api";
import { CollectionEditPage } from "@/pages/catalog-form-pages";

export const Route = createFileRoute("/collections/edit/$collectionItemId")({
  params: {
    parse: ({ collectionItemId }) => ({
      collectionItemId: Number(collectionItemId),
    }),
    stringify: ({ collectionItemId }) => ({
      collectionItemId: String(collectionItemId),
    }),
  },
  beforeLoad: async () => {
    if (!(await getAuthState()).isAuthenticated) {
      throw redirect({ params: { _splat: "" }, to: "/sign-in/$" });
    }
  },
  loader: async ({ params }) => {
    if (!Number.isInteger(params.collectionItemId)) throw notFound();
    const [data, options] = await Promise.all([
      getCollectionEditData({ data: params }),
      getCatalogOptions(),
    ]);
    if (!data.item || !data.product) throw notFound();
    return {
      buttonProducts: data.buttonProducts,
      item: data.item,
      ownedButtons: data.ownedButtons,
      options,
      product: data.product,
    };
  },
  component: CollectionEditRoute,
});

function CollectionEditRoute() {
  return <CollectionEditPage {...Route.useLoaderData()} />;
}
