import { createFileRoute } from "@tanstack/react-router";
import { hasMyFeedback } from "@/lib/feedback";
import { UserIndexPage } from "@/pages/user-index-page";

export const Route = createFileRoute("/user/")({
  loader: async () => await hasMyFeedback(),
  component: UserIndexRoute,
});

function UserIndexRoute() {
  return <UserIndexPage hasFeedback={Route.useLoaderData()} />;
}
