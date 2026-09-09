import {
  DEFAULT_LOCALE,
  formatTranslation,
  type LocalePreference,
  resolveLocale,
  SUPPORTED_LOCALES,
  type SupportedLocale,
  type TranslationKey,
} from "@pocket-trash/localizations";

export const localeStorageKey = "field-log.locale";
export const supportedLocales = SUPPORTED_LOCALES;

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

export function browserLocalePreferences(): readonly LocalePreference[] {
  if (typeof navigator === "undefined") return [];

  return navigator.languages?.length
    ? navigator.languages
    : [navigator.language];
}

export function readStoredLocale(): SupportedLocale | null {
  if (typeof window === "undefined") return null;

  const stored = window.localStorage.getItem(localeStorageKey);
  return normalizeSavedLocale(stored);
}

export function writeStoredLocale(locale: SupportedLocale) {
  window.localStorage.setItem(localeStorageKey, locale);
}

export function resolveBrowserLocale() {
  return resolveWebLocale(readStoredLocale(), browserLocalePreferences());
}

export function resolveWebLocale(
  storedLocale: LocalePreference,
  preferences: readonly LocalePreference[],
) {
  return normalizeSavedLocale(storedLocale) ?? resolveLocale(...preferences);
}
