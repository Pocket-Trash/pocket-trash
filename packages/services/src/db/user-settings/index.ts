import type {
  CurrencyCode,
  Database,
  DimensionUnit,
  ThemeMode,
  UserSettings,
  WeightUnit,
} from "@package/database";
import { schema } from "@package/database";
import { type Logger, loggerMessages } from "@package/logger";
import {
  type LocalePreference,
  resolveLocale,
  type SupportedLocale,
} from "@pocket-trash/localizations";
import { eq } from "drizzle-orm";
import { hashLogIdentifier } from "../../logging.js";
import type { UsersService } from "../users/index.js";

export type UpsertUserSettingsInput = {
  currencyCode: CurrencyCode;
  dimensionUnit: DimensionUnit;
  locale?: SupportedLocale | null;
  theme: ThemeMode;
  weightUnit: WeightUnit;
};

export type PatchUserSettingsInput = Partial<UpsertUserSettingsInput>;

export type UserSettingsService = {
  getByClerkId(clerkId: string): Promise<UserSettings | null>;
  patchForClerkId(
    clerkId: string,
    settings: PatchUserSettingsInput,
  ): Promise<UserSettings>;
  resolveLocaleForClerkId(
    clerkId: string,
    preferences: readonly LocalePreference[],
  ): Promise<SupportedLocale>;
  updateLocaleForClerkId(
    clerkId: string,
    locale: SupportedLocale | null,
  ): Promise<SupportedLocale | null>;
  upsertForClerkId(
    clerkId: string,
    settings: UpsertUserSettingsInput,
  ): Promise<UserSettings>;
};

export const defaultUserSettings: UpsertUserSettingsInput = {
  currencyCode: "USD",
  dimensionUnit: "in",
  locale: null,
  theme: "system",
  weightUnit: "g",
};

function mergeLocaleSettings(
  settings: UserSettings | null,
  locale: SupportedLocale | null,
): UpsertUserSettingsInput {
  return {
    currencyCode: settings?.currencyCode ?? defaultUserSettings.currencyCode,
    dimensionUnit: settings?.dimensionUnit ?? defaultUserSettings.dimensionUnit,
    locale,
    theme: settings?.theme ?? defaultUserSettings.theme,
    weightUnit: settings?.weightUnit ?? defaultUserSettings.weightUnit,
  };
}

function normalizeSavedLocale(locale: string | null | undefined) {
  if (locale === "en") return "en-US";
  return locale ? resolveLocale(locale) : null;
}

export function createUserSettingsService(
  db: Database,
  usersService: UsersService,
  logger: Logger,
): UserSettingsService {
  return {
    async getByClerkId(clerkId) {
      return await logger.operation(
        loggerMessages.database.userSettings.getByClerkId,
        async () => {
          const [row] = await db
            .select({
              currencyCode: schema.userSettings.currencyCode,
              dimensionUnit: schema.userSettings.dimensionUnit,
              locale: schema.userSettings.locale,
              theme: schema.userSettings.theme,
              userId: schema.userSettings.userId,
              weightUnit: schema.userSettings.weightUnit,
            })
            .from(schema.userSettings)
            .innerJoin(
              schema.users,
              eq(schema.userSettings.userId, schema.users.id),
            )
            .where(eq(schema.users.clerkId, clerkId))
            .limit(1);

          return row ?? null;
        },
        {
          attributes: {
            clerkIdHash: hashLogIdentifier(clerkId),
          },
        },
      );
    },
    async patchForClerkId(clerkId, settings) {
      return await logger.operation(
        loggerMessages.database.userSettings.patchForClerkId,
        async () => {
          const existing = await this.getByClerkId(clerkId);
          const mergedSettings: UpsertUserSettingsInput = {
            currencyCode:
              settings.currencyCode ??
              existing?.currencyCode ??
              defaultUserSettings.currencyCode,
            dimensionUnit:
              settings.dimensionUnit ??
              existing?.dimensionUnit ??
              defaultUserSettings.dimensionUnit,
            locale:
              settings.locale !== undefined
                ? settings.locale
                : (normalizeSavedLocale(existing?.locale) ??
                  defaultUserSettings.locale),
            theme:
              settings.theme ?? existing?.theme ?? defaultUserSettings.theme,
            weightUnit:
              settings.weightUnit ??
              existing?.weightUnit ??
              defaultUserSettings.weightUnit,
          };

          const user = await usersService.ensure({ clerkId });

          const [userSettings] = await db
            .insert(schema.userSettings)
            .values({
              ...mergedSettings,
              userId: user.id,
            })
            .onConflictDoUpdate({
              set: mergedSettings,
              target: schema.userSettings.userId,
            })
            .returning();

          if (!userSettings) {
            throw new Error("Failed to patch user settings.");
          }

          return userSettings;
        },
        {
          attributes: {
            clerkIdHash: hashLogIdentifier(clerkId),
            settingKeys: Object.keys(settings),
            settings,
          },
        },
      );
    },
    async resolveLocaleForClerkId(clerkId, preferences) {
      const settings = await this.getByClerkId(clerkId);
      const savedLocale = normalizeSavedLocale(settings?.locale);
      const locale = savedLocale ?? resolveLocale(...preferences);

      if (savedLocale === locale) {
        return locale;
      }

      await this.upsertForClerkId(
        clerkId,
        mergeLocaleSettings(settings, locale),
      );

      return locale;
    },
    async updateLocaleForClerkId(clerkId, locale) {
      const settings = await this.getByClerkId(clerkId);

      await this.upsertForClerkId(
        clerkId,
        mergeLocaleSettings(settings, locale),
      );

      return locale;
    },
    async upsertForClerkId(clerkId, settings) {
      return await logger.operation(
        loggerMessages.database.userSettings.upsertForClerkId,
        async () => {
          const user = await usersService.ensure({ clerkId });

          const [userSettings] = await db
            .insert(schema.userSettings)
            .values({
              ...settings,
              userId: user.id,
            })
            .onConflictDoUpdate({
              set: settings,
              target: schema.userSettings.userId,
            })
            .returning();

          if (!userSettings) {
            throw new Error("Failed to upsert user settings.");
          }

          return userSettings;
        },
        {
          attributes: {
            clerkIdHash: hashLogIdentifier(clerkId),
            settingKeys: Object.keys(settings),
            settings,
          },
        },
      );
    },
  };
}
