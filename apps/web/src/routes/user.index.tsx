import { createFileRoute } from "@tanstack/react-router";
import { hasMyFeedback } from "@/lib/feedback";
import { UserIndexPage } from "@/pages/user-index-page";

/**
 * Defines the `/user/` route and its data lifecycle.
 */
export const Route = createFileRoute("/user/")({
  /**
   * Loads whether the current user has submitted feedback.
   *
   * @returns The route's loader data.
   */
  loader: async () => await hasMyFeedback(),
  component: UserIndexRoute,
});

/**
 * Renders the user index route content.
 *
 * @returns The rendered route UI.
 */
function UserIndexRoute() {
  return <UserIndexPage hasFeedback={Route.useLoaderData()} />;
}
