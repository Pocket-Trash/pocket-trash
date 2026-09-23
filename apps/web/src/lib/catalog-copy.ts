import { loggerMessages } from "@package/logger";
import {
  formatTranslation,
  type SupportedLocale,
  type TranslationKey,
  translationKeys,
} from "@pocket-trash/localizations";
import { logger } from "@/lib/logger";
import { useLocale } from "@/providers/locale-provider";

const translationKeySet: ReadonlySet<string> = new Set(translationKeys);
const reportedMissingKeys = new Set<string>();

export function formatCatalogCopy(
  key: string,
  values: Readonly<Record<string, unknown>>,
  locale: SupportedLocale,
) {
  if (!translationKeySet.has(key)) {
    if (!reportedMissingKeys.has(key)) {
      reportedMissingKeys.add(key);
      logger.error(loggerMessages.web.localizationKeyMissing, {
        attributes: { locale, translationKey: key },
      });
    }

    return key;
  }

  return formatTranslation(key as TranslationKey, values, locale);
}

export function useCatalogCopy() {
  const { locale } = useLocale();

  return (key: string, values: Readonly<Record<string, unknown>> = {}) =>
    formatCatalogCopy(key, values, locale);
}
