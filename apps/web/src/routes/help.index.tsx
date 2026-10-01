import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute } from "@tanstack/react-router";
import { getHelpDocuments } from "@/lib/help-content";
import { HelpIndexPage } from "@/pages/help-pages";
import { useLocale } from "@/providers/locale-provider";

/**
 * Defines the `/help/` route and its data lifecycle.
 */
export const Route = createFileRoute("/help/")({
  component: HelpIndexRoute,
  /**
   * Builds document metadata for the help route.
   *
   * @returns Metadata emitted for the route.
   */
  head: () => ({
    meta: [{ title: formatTranslation("web.navigation.help") }],
  }),
});

/**
 * Renders the help index for the active locale.
 *
 * @returns The localized help index route.
 */
function HelpIndexRoute() {
  const { locale } = useLocale();
  return <HelpIndexPage documents={getHelpDocuments(locale)} />;
}
