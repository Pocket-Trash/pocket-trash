import {
  formatTranslation,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { UserPageShell } from "@/components/user-page-shell";
import { useLocale } from "@/providers/locale-provider";

/**
 * Renders the placeholder for the user's collections.
 *
 * @returns The user collections page.
 */
export function UserCollectionsPage() {
  const { locale } = useLocale();
  /**
   * Formats localized collection copy.
   *
   * @param key - Translation key.
   * @returns The localized message.
   */
  const t = (key: TranslationKey) => formatTranslation(key, {}, locale);

  return (
    <UserPageShell title={t("web.navigation.collections")}>
      <div className="rounded-lg border border-dashed border-border p-12 text-center text-muted-foreground">
        {t("web.page.collections.empty")}
      </div>
    </UserPageShell>
  );
}
