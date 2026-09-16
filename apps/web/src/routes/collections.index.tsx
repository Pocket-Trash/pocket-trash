import { createFileRoute } from "@tanstack/react-router";
import { getPublicCollectionOwners } from "@/lib/catalog-api";
import { PublicCollectionsPage } from "@/pages/catalog-pages";

export const Route = createFileRoute("/collections/")({
  loader: () => getPublicCollectionOwners(),
  component: CollectionsRoute,
});

function CollectionsRoute() {
  return <PublicCollectionsPage owners={Route.useLoaderData()} />;
}
