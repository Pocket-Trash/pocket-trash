import { loggerMessages } from "@package/logger";
import type { SupportedLocale } from "@pocket-trash/localizations";
import { logger } from "@/lib/logger";
import {
  getCurrentUserSettingsState,
  patchCurrentUserSettings,
} from "@/lib/user-settings";

export async function fetchLocaleSettingsState() {
  try {
    return await getCurrentUserSettingsState();
  } catch (error) {
    logger.warn(loggerMessages.web.localeSyncFailed, { error });
    throw error;
  }
}

export async function updateLocaleSetting(locale: SupportedLocale) {
  try {
    await patchCurrentUserSettings({ data: { locale } });
  } catch (error) {
    logger.warn(loggerMessages.web.localeSyncFailed, { error });
    throw error;
  }
}
