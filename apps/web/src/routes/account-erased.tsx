import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute } from "@tanstack/react-router";
import { AccountErasedPage } from "@/pages/account-erasure-pages";

/**
 * Shows confirmation after an account erasure finishes.
 */
export const Route = createFileRoute("/account-erased")({
  component: AccountErasedPage,
  /**
   * Builds document metadata for the account erased route.
   *
   * @returns Metadata emitted for the route.
   */
  head: () => ({
    meta: [{ title: formatTranslation("web.erasure.status.completed") }],
  }),
});
