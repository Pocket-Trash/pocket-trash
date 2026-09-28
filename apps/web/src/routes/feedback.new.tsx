import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute } from "@tanstack/react-router";
import { SubmitFeedbackPage } from "@/pages/feedback-pages";

export const Route = createFileRoute("/feedback/new")({
  component: SubmitFeedbackPage,
  head: () => ({
    meta: [{ title: formatTranslation("web.feedback.new.title") }],
  }),
});
