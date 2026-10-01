import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { getHelpDocument } from "@/lib/help-content";
import { HelpTopicPage } from "@/pages/help-pages";
import { useLocale } from "@/providers/locale-provider";

/**
 * Defines the `/help/$slug` route and its data lifecycle.
 */
export const Route = createFileRoute("/help/$slug")({
  component: HelpTopicRoute,
  /**
   * Validates and returns an available help-document slug.
   *
   * @param context - Route callback context.
   * @param context.params - Parsed route parameters.
   * @returns The route's loader data.
   * @throws When the requested route data is unavailable or access is denied.
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
 * @throws When the requested route data is unavailable or access is denied.
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
