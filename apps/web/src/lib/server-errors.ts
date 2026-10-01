import {
  formatTranslation,
  type SupportedLocale,
  type TranslationKey,
} from "@pocket-trash/localizations";

/** Error carrying both localized fallback text and its stable translation key. */
export class LocalizedServerError extends Error {
  /** Translation key used to produce the error message. */
  readonly key: TranslationKey;

  /** Creates a localized server error.
   *
   * @param key - Translation key for the caller-visible fallback message.
   * @param locale - Preferred message locale.
   */
  constructor(key: TranslationKey, locale?: SupportedLocale | null) {
    super(formatTranslation(key, {}, locale));
    this.name = "LocalizedServerError";
    this.key = key;
  }
}

/** Creates an error with a stable translation key and localized message.
 *
 * @param key - Translation key for the caller-visible fallback message.
 * @param locale - Preferred message locale.
 * @returns The localized server error.
 */
export function localizedServerError(
  key: TranslationKey,
  locale?: SupportedLocale | null,
) {
  return new LocalizedServerError(key, locale);
}
