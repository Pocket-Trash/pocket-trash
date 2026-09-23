import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute } from "@tanstack/react-router";
import { getHelpDocument } from "@/lib/help-content";
import { HelpIndexPage } from "@/pages/help-pages";
import { useLocale } from "@/providers/locale-provider";

export const Route = createFileRoute("/help/")({
  component: HelpIndexRoute,
  head: () => ({
    meta: [{ title: formatTranslation("web.navigation.help") }],
  }),
});

function HelpIndexRoute() {
  const { locale } = useLocale();
  const guide = getHelpDocument(locale, "image-size-and-resolution-guide");
  if (!guide) throw new Error("The image help guide is missing.");

  return <HelpIndexPage guideTitle={guide.metadata.title} />;
}
