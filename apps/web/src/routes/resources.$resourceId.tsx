import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { getResourceDetail } from "@/lib/resources";
import { ResourceDetailPage } from "@/pages/resource-detail-page";

export const Route = createFileRoute("/resources/$resourceId")({
  component: ResourceRoute,
  loader: async ({ params }) => {
    const detail = await getResourceDetail({
      data: { resourceId: Number(params.resourceId) },
    });
    if (!detail) throw notFound();
    return detail;
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `${loaderData.name} · ${formatTranslation("web.resources.directory.title")}`
          : formatTranslation("web.resources.directory.title"),
      },
    ],
  }),
});

function ResourceRoute() {
  return <ResourceDetailPage detail={Route.useLoaderData()} />;
}
