import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { getAuthState } from "@/lib/auth";
import { getOwnedResourceDetail } from "@/lib/resources";
import { ResourceVersionUploadPage } from "@/pages/resource-management-pages";

export const Route = createFileRoute("/resources/$resourceId/versions/new")({
  beforeLoad: async () => {
    const { isAuthenticated } = await getAuthState();
    if (!isAuthenticated) {
      throw redirect({ params: { _splat: "" }, to: "/sign-in/$" });
    }
  },
  component: ResourceVersionRoute,
  loader: async ({ params }) => {
    const detail = await getOwnedResourceDetail({
      data: { resourceId: Number(params.resourceId) },
    });
    if (!detail) throw notFound();
    return detail;
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? formatTranslation("web.resources.upload.newVersionTitle", {
              name: loaderData.name,
            })
          : formatTranslation("web.resources.management.title"),
      },
    ],
  }),
});

function ResourceVersionRoute() {
  return <ResourceVersionUploadPage detail={Route.useLoaderData()} />;
}
