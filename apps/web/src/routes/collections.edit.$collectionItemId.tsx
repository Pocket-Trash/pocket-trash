import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { getAuthState } from "@/lib/auth";
import { getCollectionEditData } from "@/lib/catalog-api";
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
    const data = await getCollectionEditData({ data: params });
    if (!data.item) throw notFound();
    return { item: data.item, ownedButtons: data.ownedButtons };
  },
  component: CollectionEditRoute,
});

function CollectionEditRoute() {
  return <CollectionEditPage {...Route.useLoaderData()} />;
}
