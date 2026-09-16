import { createFileRoute } from "@tanstack/react-router";
import { getUserCollection } from "@/lib/catalog-api";
import { UserCollectionPage } from "@/pages/catalog-pages";

export const Route = createFileRoute("/user/collections")({
  loader: () => getUserCollection(),
  component: UserCollectionsRoute,
});

function UserCollectionsRoute() {
  return <UserCollectionPage items={Route.useLoaderData()} />;
}
