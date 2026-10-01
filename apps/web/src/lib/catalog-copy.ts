import { loggerMessages } from "@package/logger";
import {
  formatTranslation,
  type SupportedLocale,
  type TranslationKey,
  translationKeys,
} from "@pocket-trash/localizations";
import { logger } from "@/lib/logger";
import { useLocale } from "@/providers/locale-provider";

/**
 * Known localization keys used to validate dynamic catalog copy requests.
 */
const translationKeySet: ReadonlySet<string> = new Set(translationKeys);
/**
 * Unknown localization keys already logged during this process.
 */
const reportedMissingKeys = new Set<string>();

/**
 * Formats catalog copy, logging each unknown key once and returning that key unchanged.
 *
 * @param key - Requested localization key.
 * @param values - Translation interpolation values.
 * @param locale - Locale used to format catalog copy.
 * @returns Localized copy, or the unknown key unchanged.
 */
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

/**
 * Returns a catalog-copy formatter bound to the active locale.
 *
 * @returns A formatter bound to the active locale.
 * @throws If used outside the locale provider.
 */
export function useCatalogCopy() {
  const { locale } = useLocale();

  return (key: string, values: Readonly<Record<string, unknown>> = {}) =>
    formatCatalogCopy(key, values, locale);
}
