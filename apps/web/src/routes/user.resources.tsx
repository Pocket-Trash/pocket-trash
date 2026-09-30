import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute } from "@tanstack/react-router";
import { listOwnedResources } from "@/lib/resources";
import { ResourceManagementPage } from "@/pages/resource-management-pages";

export const Route = createFileRoute("/user/resources")({
  component: ResourceManagementRoute,
  head: () => ({
    meta: [{ title: formatTranslation("web.resources.management.title") }],
  }),
  loader: () => listOwnedResources(),
});

function ResourceManagementRoute() {
  return <ResourceManagementPage resources={Route.useLoaderData()} />;
}
