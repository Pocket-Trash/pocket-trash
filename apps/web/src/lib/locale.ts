import {
  DEFAULT_LOCALE,
  formatTranslation,
  type LocalePreference,
  resolveLocale,
  SUPPORTED_LOCALES,
  type SupportedLocale,
  type TranslationKey,
} from "@pocket-trash/localizations";

/** Browser storage key for the anonymous locale preference. */
export const localeStorageKey = "field-log.locale";
/** Locales available in the web locale selector. */
export const supportedLocales = SUPPORTED_LOCALES;

/** Normalizes a saved locale without accepting unsupported fallback values.
 *
 * @param locale - Persisted or legacy locale preference.
 * @returns A supported locale, or `null` when the preference is absent or unsupported.
 */
export function normalizeSavedLocale(
  locale: LocalePreference,
): SupportedLocale | null {
  if (locale === "en") return "en-US";
  if (typeof locale !== "string") return null;

  const resolved = resolveLocale(locale);
  return resolved === DEFAULT_LOCALE && locale !== DEFAULT_LOCALE
    ? null
    : resolved;
}

/** Formats the display label for a supported locale.
 *
 * @param locale - Locale whose name is requested.
 * @param t - Translation lookup used to format the label.
 * @returns The localized locale label.
 */
export function localeLabel(
  locale: SupportedLocale,
  t: (key: TranslationKey) => string = (key) => formatTranslation(key),
) {
  switch (locale) {
    case "en-US":
      return t("web.locale.enUS");
    case "es-MX":
      return t("web.locale.esMX");
  }
}

/** Reads the browser's ordered locale preferences.
 *
 * @returns Browser locale preferences, or an empty list during server rendering.
 */
export function browserLocalePreferences(): readonly LocalePreference[] {
  if (typeof navigator === "undefined") return [];

  return navigator.languages?.length
    ? navigator.languages
    : [navigator.language];
}

/** Reads and normalizes the anonymous locale preference.
 *
 * @returns The stored supported locale, or `null` when unavailable or invalid.
 */
export function readStoredLocale(): SupportedLocale | null {
  if (typeof window === "undefined") return null;

  const stored = window.localStorage.getItem(localeStorageKey);
  return normalizeSavedLocale(stored);
}

/** Stores the anonymous locale preference in browser storage.
 *
 * @param locale - Supported locale to persist.
 */
export function writeStoredLocale(locale: SupportedLocale) {
  window.localStorage.setItem(localeStorageKey, locale);
}

/** Resolves the active browser locale from storage and browser preferences.
 *
 * @returns The supported locale selected for the browser.
 */
export function resolveBrowserLocale() {
  return resolveWebLocale(readStoredLocale(), browserLocalePreferences());
}

/** Resolves a web locale, preferring an explicit stored selection.
 *
 * @param storedLocale - Persisted anonymous locale preference.
 * @param preferences - Ordered browser locale preferences.
 * @returns The selected supported locale.
 */
export function resolveWebLocale(
  storedLocale: LocalePreference,
  preferences: readonly LocalePreference[],
) {
  return normalizeSavedLocale(storedLocale) ?? resolveLocale(...preferences);
}

/** Reconciles authenticated and anonymous locale preferences.
 *
 * @param settingsState - Persisted user settings, or `null` when unavailable.
 * @param storedLocale - Explicit anonymous locale, or `null` when browser-derived.
 * @returns The selected locale and whether it should be persisted to user settings.
 */
export function resolveAuthenticatedLocale(
  settingsState: {
    /** Persisted user settings. */
    settings: {
      /** Persisted locale, or `null` when no preference is saved. */
      locale: SupportedLocale | null;
    };
  } | null,
  storedLocale: SupportedLocale | null,
) {
  const serverLocale = settingsState?.settings.locale ?? null;

  if (serverLocale) {
    return { locale: serverLocale, shouldPersist: false } as const;
  }

  return {
    locale: storedLocale,
    shouldPersist: storedLocale !== null,
  } as const;
}
