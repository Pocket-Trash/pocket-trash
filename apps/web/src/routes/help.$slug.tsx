import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { getHelpDocument } from "@/lib/help-content";
import { HelpTopicPage } from "@/pages/help-pages";
import { useLocale } from "@/providers/locale-provider";

export const Route = createFileRoute("/help/$slug")({
  component: HelpTopicRoute,
  loader: ({ params }) => {
    if (!getHelpDocument("en-US", params.slug)) throw notFound();
    return params.slug;
  },
});

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
