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

/**
 * Explains the actuator type consistently while retaining other catalog names.
 * @param t - Active-locale catalog formatter.
 * @param slug - Canonical product-type slug.
 * @param fallback - Existing type or maker-preferred label.
 * @returns Type label with actuator examples when relevant.
 */
export function catalogProductTypeLabel(
  t: ReturnType<typeof useCatalogCopy>,
  slug: string | null | undefined,
  fallback: string,
) {
  // Trends responses expose only the canonical English type name.
  return slug === "pen-actuator" ||
    (!slug && /^pen actuators?$/i.test(fallback))
    ? t("catalog.productTypes.pen-actuator")
    : fallback;
}

/**
 * Names a complete creation action independently of the type's display label.
 * @param t - Active-locale catalog formatter.
 * @param slug - Canonical product-type slug, when selected.
 * @returns Localized creation action or the unselected product fallback.
 */
export function catalogProductCreateLabel(
  t: ReturnType<typeof useCatalogCopy>,
  slug?: string,
) {
  const key = `web.catalog.addProductType.${slug}`;
  return translationKeySet.has(key) ? t(key) : t("web.action.addProduct");
}
