import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute } from "@tanstack/react-router";
import { getLegalDocument } from "@/lib/legal-content";
import { LegalDocumentPage } from "@/pages/legal-document-page";

const privacyPolicy = getLegalDocument("privacy-policy");

export const Route = createFileRoute("/privacy")({
  component: () => <LegalDocumentPage document={privacyPolicy} />,
  head: () => ({
    meta: [{ title: formatTranslation("web.navigation.privacy") }],
  }),
});
