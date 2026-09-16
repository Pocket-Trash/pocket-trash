import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { getAuthState } from "@/lib/auth";
import { getEditableResourceDetail } from "@/lib/resources";
import { ResourceEditPage } from "@/pages/resource-management-pages";

export const Route = createFileRoute("/resources/$resourceId/edit")({
  beforeLoad: async () => {
    const { isAuthenticated } = await getAuthState();
    if (!isAuthenticated) {
      throw redirect({ params: { _splat: "" }, to: "/sign-in/$" });
    }
  },
  component: ResourceEditRoute,
  loader: async ({ params }) => {
    const detail = await getEditableResourceDetail({
      data: { resourceId: Number(params.resourceId) },
    });
    if (!detail) throw notFound();
    return detail;
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? formatTranslation("web.resources.management.editTitle", {
              name: loaderData.name,
            })
          : formatTranslation("web.resources.management.title"),
      },
    ],
  }),
});

function ResourceEditRoute() {
  return <ResourceEditPage detail={Route.useLoaderData()} />;
}
