import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute } from "@tanstack/react-router";
import { getLegalDocument } from "@/lib/legal-content";
import { LegalDocumentPage } from "@/pages/legal-document-page";

/** English Privacy Policy shown for every current UI locale. */
const privacyPolicy = getLegalDocument("privacy-policy");

/** Public Privacy Policy route. */
export const Route = createFileRoute("/privacy")({
  /**
   * Renders the public Privacy Policy.
   *
   * @returns The published Privacy Policy page.
   */
  component: () => <LegalDocumentPage document={privacyPolicy} />,
  /**
   * Defines browser metadata for the Privacy Policy.
   *
   * @returns Browser metadata for the Privacy Policy route.
   */
  head: () => ({
    meta: [{ title: formatTranslation("web.navigation.privacy") }],
  }),
});
