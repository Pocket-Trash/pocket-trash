import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute } from "@tanstack/react-router";
import { getHelpDocuments } from "@/lib/help-content";
import { HelpIndexPage } from "@/pages/help-pages";
import { useLocale } from "@/providers/locale-provider";

export const Route = createFileRoute("/help/")({
  component: HelpIndexRoute,
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
