import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute } from "@tanstack/react-router";
import { PublicPlaceholderPage } from "@/pages/public-placeholder-page";

export const Route = createFileRoute("/privacy")({
  component: () => <PublicPlaceholderPage titleKey="web.navigation.privacy" />,
  head: () => ({
    meta: [{ title: formatTranslation("web.navigation.privacy") }],
  }),
});
