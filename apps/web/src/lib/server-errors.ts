import {
  formatTranslation,
  type SupportedLocale,
  type TranslationKey,
} from "@pocket-trash/localizations";

export class LocalizedServerError extends Error {
  readonly key: TranslationKey;

  constructor(key: TranslationKey, locale?: SupportedLocale | null) {
    super(formatTranslation(key, {}, locale));
    this.name = "LocalizedServerError";
    this.key = key;
  }
}

export function localizedServerError(
  key: TranslationKey,
  locale?: SupportedLocale | null,
) {
  return new LocalizedServerError(key, locale);
}
