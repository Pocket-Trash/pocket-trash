import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { getAuthState } from "@/lib/auth";
import { ResourceUploadPage } from "@/pages/resource-upload-page";

export const Route = createFileRoute("/resources/upload")({
  beforeLoad: async () => {
    const { isAuthenticated } = await getAuthState();
    if (!isAuthenticated) {
      throw redirect({ params: { _splat: "" }, to: "/sign-in/$" });
    }
  },
  component: ResourceUploadPage,
  head: () => ({
    meta: [{ title: formatTranslation("web.resources.upload.title") }],
  }),
});
