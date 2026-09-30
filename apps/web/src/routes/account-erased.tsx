import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute } from "@tanstack/react-router";
import { AccountErasedPage } from "@/pages/account-erasure-pages";

export const Route = createFileRoute("/account-erased")({
  component: AccountErasedPage,
  head: () => ({
    meta: [{ title: formatTranslation("web.erasure.status.completed") }],
  }),
});
