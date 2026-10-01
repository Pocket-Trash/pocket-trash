import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { getHelpDocument } from "@/lib/help-content";
import { HelpTopicPage } from "@/pages/help-pages";
import { useLocale } from "@/providers/locale-provider";

/**
 * Shows one localized help document selected by slug.
 */
export const Route = createFileRoute("/help/$slug")({
  component: HelpTopicRoute,
  /**
   * Validates and returns an available help-document slug.
   *
   * @param context - Route callback context.
   * @param context.params - Parsed route parameters.
   * @returns The validated help-document slug.
   * @throws When the help topic slug is unknown.
   */
  loader: ({ params }) => {
    if (!getHelpDocument("en-US", params.slug)) throw notFound();
    return params.slug;
  },
});

/**
 * Renders the help topic route content.
 *
 * @returns The rendered route UI.
 * @throws When the localized help document is unavailable.
 */
function HelpTopicRoute() {
  const slug = Route.useLoaderData();
  const { locale } = useLocale();
  const document = getHelpDocument(locale, slug);
  if (!document) throw notFound();

  return (
    <HelpTopicPage
      dateLabel={formatTranslation("web.help.datePublished", {}, locale)}
      dateModifiedLabel={formatTranslation("web.help.dateModified", {}, locale)}
      document={document}
      helpTitle={formatTranslation("web.navigation.help", {}, locale)}
    />
  );
}
