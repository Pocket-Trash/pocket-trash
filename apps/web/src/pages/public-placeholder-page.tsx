import {
  formatTranslation,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { AppShell } from "@/components/app-shell";
import { useLocale } from "@/providers/locale-provider";

type PublicPlaceholderTitleKey =
  | "web.navigation.contact"
  | "web.navigation.privacy"
  | "web.navigation.termsOfService";

export function PublicPlaceholderPage({
  titleKey,
}: {
  titleKey: PublicPlaceholderTitleKey;
}) {
  const { locale } = useLocale();
  const t = (key: TranslationKey) => formatTranslation(key, {}, locale);

  return (
    <AppShell title={t(titleKey)}>
      <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
        <p className="text-sm text-muted-foreground">
          {t("web.help.comingSoon")}
        </p>
      </main>
    </AppShell>
  );
}
