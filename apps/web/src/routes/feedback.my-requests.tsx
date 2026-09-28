import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute } from "@tanstack/react-router";
import { listMyFeedback } from "@/lib/feedback";
import { MyFeedbackPage } from "@/pages/feedback-pages";

export const Route = createFileRoute("/feedback/my-requests")({
  loader: async () => await listMyFeedback(),
  component: MyFeedbackRoute,
  head: () => ({
    meta: [{ title: formatTranslation("web.feedback.myRequests.title") }],
  }),
});

function MyFeedbackRoute() {
  return <MyFeedbackPage items={Route.useLoaderData()} />;
}
