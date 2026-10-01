import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { getAuthState } from "@/lib/auth";
import { ResourceUploadPage } from "@/pages/resource-upload-page";

/**
 * Defines the `/resources/add` route and its data lifecycle.
 */
export const Route = createFileRoute("/resources/add")({
  /**
   * Requires authentication before entering the resource upload route.
   *
   * @throws When navigation must continue at another route.
   * @rejects When navigation must continue at another route.
   */
  beforeLoad: async () => {
    const { isAuthenticated } = await getAuthState();
    if (!isAuthenticated) {
      throw redirect({ params: { _splat: "" }, to: "/sign-in/$" });
    }
  },
  component: ResourceUploadPage,
  /**
   * Builds document metadata for the resource upload route.
   *
   * @returns Metadata emitted for the route.
   */
  head: () => ({
    meta: [
      {
        title: formatTranslation("web.resources.add.title"),
      },
    ],
  }),
});
