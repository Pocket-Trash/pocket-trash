import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute } from "@tanstack/react-router";
import { PublicPlaceholderPage } from "@/pages/public-placeholder-page";

export const Route = createFileRoute("/terms-of-service")({
  component: () => (
    <PublicPlaceholderPage titleKey="web.navigation.termsOfService" />
  ),
  head: () => ({
    meta: [{ title: formatTranslation("web.navigation.termsOfService") }],
  }),
});
