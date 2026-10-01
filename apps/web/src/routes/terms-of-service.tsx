import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute } from "@tanstack/react-router";
import { getLegalDocument } from "@/lib/legal-content";
import { LegalDocumentPage } from "@/pages/legal-document-page";

/** English Terms of Service shown for every current UI locale. */
const termsOfService = getLegalDocument("terms-of-service");

/** Public Terms of Service route. */
export const Route = createFileRoute("/terms-of-service")({
  /**
   * Renders the public Terms of Service.
   *
   * @returns The published Terms of Service page.
   */
  component: () => <LegalDocumentPage document={termsOfService} />,
  /**
   * Defines browser metadata for the Terms of Service.
   *
   * @returns Browser metadata for the Terms of Service route.
   */
  head: () => ({
    meta: [{ title: formatTranslation("web.navigation.termsOfService") }],
  }),
});
