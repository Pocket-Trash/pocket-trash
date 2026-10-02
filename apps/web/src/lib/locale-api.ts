import { loggerMessages } from "@package/logger";
import type { SupportedLocale } from "@pocket-trash/localizations";
import { logger } from "@/lib/logger";
import {
  getCurrentUserSettingsState,
  patchCurrentUserSettings,
} from "@/lib/user-settings";

/** Loads the current user's persisted locale settings.
 * Logs and rethrows settings lookup failures.
 *
 * @returns The current user-settings state.
 * @rejects When settings lookup fails.
 */
export async function fetchLocaleSettingsState() {
  try {
    return await getCurrentUserSettingsState();
  } catch (error) {
    logger.warn(loggerMessages.web.localeSyncFailed, { error });
    throw error;
  }
}

/** Persists the current user's selected locale.
 * Logs and rethrows settings update failures.
 *
 * @param locale - Locale to persist.
 * @rejects When settings persistence fails.
 */
export async function updateLocaleSetting(locale: SupportedLocale) {
  try {
    await patchCurrentUserSettings({ data: { locale } });
  } catch (error) {
    logger.warn(loggerMessages.web.localeSyncFailed, { error });
    throw error;
  }
}
