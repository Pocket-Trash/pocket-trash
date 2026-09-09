import { auth } from "@clerk/tanstack-react-start/server";
import type { UpsertUserSettingsInput } from "@package/services";
import {
  formatTranslation,
  type LocalePreference,
  resolveLocale,
  type SupportedLocale,
} from "@pocket-trash/localizations";
import { createServerFn } from "@tanstack/react-start";
import {
  type CurrencyCode,
  currencies,
  type DimensionUnit,
  type WeightUnit,
} from "@/lib/pen-formatters";
import { isThemeMode, type ThemeMode } from "@/lib/theme";

export type UserSettingsPreferences = UpsertUserSettingsInput & {
  currencyCode: CurrencyCode;
  dimensionUnit: DimensionUnit;
  locale: SupportedLocale | null;
  theme: ThemeMode;
  weightUnit: WeightUnit;
};

export type UserSettingsPatch = Partial<UserSettingsPreferences>;

export type UserSettingsState = {
  hasSavedSettings: boolean;
  settings: UserSettingsPreferences;
};

export const defaultUserSettings: UserSettingsPreferences = {
  currencyCode: "USD",
  dimensionUnit: "in",
  locale: null,
  theme: "system",
  weightUnit: "g",
};

export const userSettingsStorageKey = "pocket-trash.settings";

export const getCurrentUserSettings = createServerFn({ method: "GET" }).handler(
  async (): Promise<UserSettingsPreferences | null> => {
    const { isAuthenticated, userId } = await auth();

    if (!isAuthenticated || !userId) {
      return null;
    }

    const { s } = await import("@/lib/services");
    const settings = await s.db.userSettings.getByClerkId(userId);

    return toUserSettingsPreferences(settings ?? defaultUserSettings);
  },
);

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

  if ("dimensionUnit" in value) {
    if (!isDimensionUnit(value.dimensionUnit)) {
      throw new Error(formatTranslation("web.error.invalidDimensionUnit"));
    }
    patch.dimensionUnit = value.dimensionUnit;
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

  if ("weightUnit" in value) {
    if (!isWeightUnit(value.weightUnit)) {
      throw new Error(formatTranslation("web.error.invalidWeightUnit"));
    }
    patch.weightUnit = value.weightUnit;
  }

  if (Object.keys(patch).length === 0) {
    throw new Error(formatTranslation("web.error.missingSetting"));
  }

  return patch;
}

function isDimensionUnit(value: unknown): value is DimensionUnit {
  return value === "in" || value === "mm";
}

function isWeightUnit(value: unknown): value is WeightUnit {
  return value === "g" || value === "oz";
}

function isSupportedLocale(value: unknown): value is SupportedLocale {
  return resolveLocale(value as LocalePreference) === value;
}

function toUserSettingsPreferences(settings: {
  currencyCode: CurrencyCode;
  dimensionUnit: DimensionUnit;
  locale?: LocalePreference | null;
  theme: ThemeMode;
  weightUnit: WeightUnit;
}) {
  return {
    currencyCode: settings.currencyCode,
    dimensionUnit: settings.dimensionUnit,
    locale: settings.locale ? resolveLocale(settings.locale) : null,
    theme: settings.theme,
    weightUnit: settings.weightUnit,
  };
}
