import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute } from "@tanstack/react-router";
import { listCompletedFeedback } from "@/lib/feedback";
import { CompletedFeedbackPage } from "@/pages/feedback-pages";

export const Route = createFileRoute("/feedback/completed")({
  loader: async () =>
    await listCompletedFeedback({ data: { offset: 0, search: "" } }),
  component: CompletedFeedbackRoute,
  head: () => ({
    meta: [{ title: formatTranslation("web.feedback.status.completed") }],
  }),
});

function CompletedFeedbackRoute() {
  return <CompletedFeedbackPage initialItems={Route.useLoaderData()} />;
}
