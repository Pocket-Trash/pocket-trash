import { createFileRoute, notFound } from "@tanstack/react-router";
import { getPublicCollectionOwner } from "@/lib/catalog-api";
import { PublicCollectionPage } from "@/pages/catalog-pages";

export const Route = createFileRoute("/collections/$userId")({
  params: {
    parse: ({ userId }) => ({ userId: Number(userId) }),
    stringify: ({ userId }) => ({ userId: String(userId) }),
  },
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

function PublicCollectionRoute() {
  return <PublicCollectionPage owner={Route.useLoaderData()} />;
}
