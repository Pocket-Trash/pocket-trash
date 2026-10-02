import {
  formatTranslation,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { AppShell } from "@/components/app-shell";
import { useLocale } from "@/providers/locale-provider";

/** Translation keys supported by the public placeholder page. */
type PublicPlaceholderTitleKey =
  | "web.navigation.contact"
  | "web.navigation.privacy"
  | "web.navigation.termsOfService";

/**
 * Renders a localized placeholder for an unfinished public page.
 *
 * @param root0 - Placeholder page properties.
 * @returns The public placeholder page.
 */
export function PublicPlaceholderPage({
  titleKey,
}: {
  /** Translation key used as the page title. */
  titleKey: PublicPlaceholderTitleKey;
}) {
  const { locale } = useLocale();
  /**
   * Formats localized placeholder copy.
   *
   * @param key - Translation key.
   * @returns The localized message.
   */
  const t = (key: TranslationKey) => formatTranslation(key, {}, locale);

  return (
    <AppShell title={t(titleKey)}>
      <main className="mx-auto w-full p-3 md:p-[18px_22px_22px] lg:max-w-[75%]">
        <p className="text-sm text-muted-foreground">
          {t("web.help.comingSoon")}
        </p>
      </main>
    </AppShell>
  );
}
