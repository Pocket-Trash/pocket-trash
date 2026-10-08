import type { UpsertUserSettingsInput } from "@package/services";
import {
  formatTranslation,
  type LocalePreference,
  resolveLocale,
  type SupportedLocale,
} from "@pocket-trash/localizations";
import { createServerFn } from "@tanstack/react-start";
import { activeAuth as auth } from "@/lib/auth";
import {
  type CurrencyCode,
  currencies,
  type MeasurementSystem,
} from "@/lib/pen-formatters";
import { isThemeMode, type ThemeMode } from "@/lib/theme";

/** Fully resolved preferences used by the web client. */
export type UserSettingsPreferences = UpsertUserSettingsInput & {
  /** Preferred ISO currency code. */
  currencyCode: CurrencyCode;
  /** App-wide system used for secondary measurement displays. */
  measurementSystem: MeasurementSystem;
  /** Explicit supported locale, or `null` for automatic selection. */
  locale: SupportedLocale | null;
  /** Preferred light, dark, or system theme. */
  theme: ThemeMode;
};

/** Validated preference fields that may participate in an update. */
export type UserSettingsPatch = Partial<UserSettingsPreferences>;

/** Current preference values and whether they were persisted. */
export type UserSettingsState = {
  /** Whether the user has saved a settings record. */
  hasSavedSettings: boolean;
  /** Resolved preferences, including defaults when no record exists. */
  settings: UserSettingsPreferences;
};

/** Default preferences for users without saved settings. */
export const defaultUserSettings: UserSettingsPreferences = {
  currencyCode: "USD",
  locale: null,
  measurementSystem: "metric",
  theme: "system",
};

/** Browser storage key for local user-setting state. */
export const userSettingsStorageKey = "pocket-trash.settings";

/** Returns resolved settings for the current user, or `null` when signed out.
 *
 * @returns Saved or default settings, or `null` for an anonymous request.
 * @rejects When authentication, service loading, or settings lookup fails.
 */
export const getCurrentUserSettingsState = createServerFn({
  method: "GET",
}).handler(async (): Promise<UserSettingsState | null> => {
  const { isAuthenticated, userId } = await auth();

  if (!isAuthenticated || !userId) {
    return null;
  }

  const { s } = await import("@/lib/services");
  const settings = await s.db.userSettings.getByClerkId(userId);

  return {
    hasSavedSettings: Boolean(settings),
    settings: toUserSettingsPreferences(settings ?? defaultUserSettings),
  };
});

/** Patches persisted settings, returning `null` when the request is signed out.
 *
 * @returns The updated resolved settings, or `null` for an anonymous request.
 * @rejects When validation, authentication, service loading, or persistence fails.
 */
export const patchCurrentUserSettings = createServerFn({ method: "POST" })
  .validator(parseUserSettingsPatch)
  .handler(async ({ data }): Promise<UserSettingsPreferences | null> => {
    const { isAuthenticated, userId } = await auth();

    if (!isAuthenticated || !userId) {
      return null;
    }

    const { s } = await import("@/lib/services");
    const settings = await s.db.userSettings.patchForClerkId(userId, data);

    return toUserSettingsPreferences(settings);
  });

/** Validates a non-empty patch of supported user preferences.
 *
 * @param input - Untrusted request payload.
 * @returns The validated settings patch.
 * @throws When the payload is empty, malformed, or contains an invalid supplied setting.
 */
function parseUserSettingsPatch(input: unknown): UserSettingsPatch {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new Error(formatTranslation("web.error.userSettingsObject"));
  }

  const value = input as Record<string, unknown>;
  const patch: UserSettingsPatch = {};

  if ("currencyCode" in value) {
    if (!currencies.includes(value.currencyCode as CurrencyCode)) {
      throw new Error(formatTranslation("web.error.invalidCurrencyCode"));
    }
    patch.currencyCode = value.currencyCode as CurrencyCode;
  }

  if ("measurementSystem" in value) {
    if (!isMeasurementSystem(value.measurementSystem)) {
      throw new Error(formatTranslation("web.error.invalidMeasurementSystem"));
    }
    patch.measurementSystem = value.measurementSystem;
  }

  if ("theme" in value) {
    if (typeof value.theme !== "string" || !isThemeMode(value.theme)) {
      throw new Error(formatTranslation("web.error.invalidTheme"));
    }
    patch.theme = value.theme;
  }

  if ("locale" in value) {
    if (value.locale !== null && !isSupportedLocale(value.locale)) {
      throw new Error(formatTranslation("web.error.invalidLocale"));
    }
    patch.locale = value.locale;
  }

  if (Object.keys(patch).length === 0) {
    throw new Error(formatTranslation("web.error.missingSetting"));
  }

  return patch;
}

/** Tests whether a value is a supported measurement system.
 *
 * @param value - Value to inspect.
 * @returns Whether the value selects metric or imperial display.
 */
function isMeasurementSystem(value: unknown): value is MeasurementSystem {
  return value === "metric" || value === "imperial";
}

/** Tests whether a value is already a canonical supported locale.
 *
 * @param value - Value to inspect.
 * @returns Whether locale resolution preserves the value exactly.
 */
function isSupportedLocale(value: unknown): value is SupportedLocale {
  return resolveLocale(value as LocalePreference) === value;
}

/** Resolves persisted settings into client preference values.
 *
 * @param settings - Stored or default settings values.
 * @returns Preferences with a canonical locale or the automatic `null` sentinel.
 */
function toUserSettingsPreferences(settings: {
  /** Preferred ISO currency code. */
  currencyCode: CurrencyCode;
  /** App-wide measurement display system. */
  measurementSystem: MeasurementSystem;
  /** Stored locale preference, or automatic selection when absent. */
  locale?: LocalePreference | null;
  /** Preferred light, dark, or system theme. */
  theme: ThemeMode;
}) {
  return {
    currencyCode: settings.currencyCode,
    locale: settings.locale ? resolveLocale(settings.locale) : null,
    measurementSystem: settings.measurementSystem,
    theme: settings.theme,
  };
}
