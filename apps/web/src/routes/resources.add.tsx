import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { getAuthState } from "@/lib/auth";
import { ResourceUploadPage } from "@/pages/resource-upload-page";

/**
 * Provides authenticated resource uploads.
 */
export const Route = createFileRoute("/resources/add")({
  /**
   * Requires authentication before entering the resource upload route.
   *
   * @rejects When authentication cannot be checked or an unauthenticated visitor is redirected to sign in.
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
