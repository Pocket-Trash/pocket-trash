import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute } from "@tanstack/react-router";
import { PublicPlaceholderPage } from "@/pages/public-placeholder-page";

export const Route = createFileRoute("/contact")({
  component: () => <PublicPlaceholderPage titleKey="web.navigation.contact" />,
  head: () => ({
    meta: [{ title: formatTranslation("web.navigation.contact") }],
  }),
});
