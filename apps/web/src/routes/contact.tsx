import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute } from "@tanstack/react-router";
import { PublicPlaceholderPage } from "@/pages/public-placeholder-page";

/**
 * Defines the `/contact` route and its data lifecycle.
 */
export const Route = createFileRoute("/contact")({
  /**
   * Renders the contact route.
   *
   * @returns The rendered route UI.
   */
  component: () => <PublicPlaceholderPage titleKey="web.navigation.contact" />,
  /**
   * Builds document metadata for the contact route.
   *
   * @returns Metadata emitted for the route.
   */
  head: () => ({
    meta: [{ title: formatTranslation("web.navigation.contact") }],
  }),
});
