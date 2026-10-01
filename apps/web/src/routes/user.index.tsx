import { createFileRoute } from "@tanstack/react-router";
import { hasMyFeedback } from "@/lib/feedback";
import { UserIndexPage } from "@/pages/user-index-page";

/**
 * Shows the current user's account landing page.
 */
export const Route = createFileRoute("/user/")({
  /**
   * Loads whether the current user has submitted feedback.
   *
   * @returns Whether the current user has submitted feedback.
   * @rejects When the current user's feedback state cannot be loaded.
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
