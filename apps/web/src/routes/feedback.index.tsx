import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute } from "@tanstack/react-router";
import { listActiveFeedback } from "@/lib/feedback";
import { FeedbackBoardPage } from "@/pages/feedback-pages";

export const Route = createFileRoute("/feedback/")({
  loader: async () =>
    await listActiveFeedback({ data: { offset: 0, search: "" } }),
  component: FeedbackBoardRoute,
  head: () => ({
    meta: [{ title: formatTranslation("web.feedback.title") }],
  }),
});

function FeedbackBoardRoute() {
  return <FeedbackBoardPage initialItems={Route.useLoaderData()} />;
}
