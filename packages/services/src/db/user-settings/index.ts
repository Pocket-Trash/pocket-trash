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
import { eq, sql } from "drizzle-orm";
import { hashLogIdentifier } from "../../logging.js";
import type { UsersService } from "../users/index.js";

/**
 * Preference values inserted or updated for a user.
 *
 * An omitted locale uses its database default on insert and remains unchanged
 * when an existing settings row is updated.
 */
export type UpsertUserSettingsInput = {
  /**
   * Currency used to display monetary values.
   */
  currencyCode: CurrencyCode;
  /**
   * Unit used to display dimensions.
   */
  dimensionUnit: DimensionUnit;
  /**
   * Explicit locale, or `null` to use negotiated preferences.
   */
  locale?: SupportedLocale | null;
  /**
   * Preferred light, dark, or system theme.
   */
  theme: ThemeMode;
  /**
   * Unit used to display weights.
   */
  weightUnit: WeightUnit;
};

/**
 * Partial preference update that leaves omitted values unchanged.
 */
export type PatchUserSettingsInput = Partial<UpsertUserSettingsInput>;

/**
 * Persistence and locale-resolution operations for user preferences.
 */
export type UserSettingsService = {
  /**
   * Loads stored preferences by Clerk user identifier.
   *
   * @param clerkId - Clerk user identifier whose preferences are loaded.
   * @returns Stored settings, or `null` when none exist.
   * @rejects When persistence or operation logging fails.
   */
  getByClerkId(clerkId: string): Promise<UserSettings | null>;
  /**
   * Patches stored settings for one Clerk user.
   *
   * @param clerkId - Clerk user identifier whose preferences are patched.
   * @param settings - Defined preference fields to update.
   * @returns Updated user settings.
   * @rejects When user creation, persistence, or operation logging fails.
   */
  patchForClerkId(
    clerkId: string,
    settings: PatchUserSettingsInput,
  ): Promise<UserSettings>;
  /**
   * Resolves a user's stored or preferred locale.
   *
   * @param clerkId - Clerk user identifier whose locale is resolved.
   * @param preferences - Ordered locale preferences used when none is stored.
   * @returns Resolved locale.
   * @rejects When loading, persisting, or operation logging fails.
   */
  resolveLocaleForClerkId(
    clerkId: string,
    preferences: readonly LocalePreference[],
  ): Promise<SupportedLocale>;
  /**
   * Stores a user's selected locale.
   *
   * @param clerkId - Clerk user identifier whose locale is updated.
   * @param locale - Explicit locale, or `null` to resume negotiation.
   * @returns Persisted locale selection.
   * @rejects When persistence or operation logging fails.
   */
  updateLocaleForClerkId(
    clerkId: string,
    locale: SupportedLocale | null,
  ): Promise<SupportedLocale | null>;
  /**
   * Creates settings or updates the provided fields for one Clerk user.
   *
   * @param clerkId - Clerk user identifier whose preferences are stored.
   * @param settings - Preference values to insert or update.
   * @returns Persisted user settings.
   * @rejects When user creation, persistence, or operation logging fails.
   */
  upsertForClerkId(
    clerkId: string,
    settings: UpsertUserSettingsInput,
  ): Promise<UserSettings>;
};

/**
 * Defaults used before a user customizes any preferences.
 */
export const defaultUserSettings: UpsertUserSettingsInput = {
  currencyCode: "USD",
  dimensionUnit: "in",
  locale: null,
  theme: "system",
  weightUnit: "g",
};

/**
 * Maps saved locale values to the currently supported locale set.
 *
 * @param locale - Stored locale from current or legacy data.
 * @returns Supported locale, or `null` when no locale is stored.
 */
function normalizeSavedLocale(locale: string | null | undefined) {
  if (locale === "en") return "en-US";
  return locale ? resolveLocale(locale) : null;
}

/**
 * Builds the conflict-update fields for a settings patch.
 *
 * @param settings - Defined preference fields included in the patch.
 * @returns Database fields updated by a settings patch.
 */
function buildPatchConflictSet(settings: PatchUserSettingsInput) {
  return Object.fromEntries(
    (Object.keys(settings) as (keyof PatchUserSettingsInput)[])
      .filter((key) => settings[key] !== undefined)
      .map((key) => [
        key,
        sql.raw(`excluded.${schema.userSettings[key].name}`),
      ]),
  );
}

/**
 * Creates persistence and locale-resolution operations for user preferences.
 *
 * @param db - Application database.
 * @param usersService - User persistence used to ensure the owner exists.
 * @param logger - Structured operation logger.
 * @returns Configured user-settings service.
 */
export function createUserSettingsService(
  db: Database,
  usersService: UsersService,
  logger: Logger,
): UserSettingsService {
  return {
    /**
     * Loads stored preferences by Clerk user identifier.
     *
     * @param clerkId - Clerk user identifier whose preferences are loaded.
     * @returns Stored settings, or `null` when none exist.
     * @rejects When persistence or operation logging fails.
     */
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
              schema.user,
              eq(schema.userSettings.userId, schema.user.id),
            )
            .where(eq(schema.user.clerkId, clerkId))
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
    /**
     * Patches stored settings for one Clerk user.
     *
     * @param clerkId - Clerk user identifier whose preferences are patched.
     * @param settings - Defined preference fields to update.
     * @returns Updated user settings.
     * @rejects When user creation, persistence, or operation logging fails.
     */
    async patchForClerkId(clerkId, settings) {
      return await logger.operation(
        loggerMessages.database.userSettings.patchForClerkId,
        async () => {
          const user = await usersService.ensure({ clerkId });

          const [userSettings] = await db
            .insert(schema.userSettings)
            .values({
              ...settings,
              userId: user.id,
            })
            .onConflictDoUpdate({
              set: buildPatchConflictSet(settings),
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
    /**
     * Resolves a user's stored or preferred locale.
     *
     * @param clerkId - Clerk user identifier whose locale is resolved.
     * @param preferences - Ordered locale preferences used when none is stored.
     * @returns Resolved locale.
     * @rejects When loading, persisting, or operation logging fails.
     */
    async resolveLocaleForClerkId(clerkId, preferences) {
      const settings = await this.getByClerkId(clerkId);
      const savedLocale = normalizeSavedLocale(settings?.locale);
      const locale = savedLocale ?? resolveLocale(...preferences);

      if (savedLocale === locale) {
        return locale;
      }

      await this.patchForClerkId(clerkId, { locale });

      return locale;
    },
    /**
     * Stores a user's selected locale.
     *
     * @param clerkId - Clerk user identifier whose locale is updated.
     * @param locale - Explicit locale, or `null` to resume negotiation.
     * @returns Persisted locale selection.
     * @rejects When persistence or operation logging fails.
     */
    async updateLocaleForClerkId(clerkId, locale) {
      await this.patchForClerkId(clerkId, { locale });

      return locale;
    },
    /**
     * Creates settings or updates the provided fields for one Clerk user.
     *
     * @param clerkId - Clerk user identifier whose preferences are stored.
     * @param settings - Preference values to insert or update.
     * @returns Persisted user settings.
     * @rejects When user creation, persistence, or operation logging fails.
     */
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
