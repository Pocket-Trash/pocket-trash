import { loggerMessages } from "@package/logger";
import type { SupportedLocale } from "@pocket-trash/localizations";
import { logger } from "@/lib/logger";
import {
  getCurrentUserSettings,
  patchCurrentUserSettings,
} from "@/lib/user-settings";

export async function fetchLocaleSetting() {
  try {
    return (await getCurrentUserSettings())?.locale ?? null;
  } catch (error) {
    logger.warn(loggerMessages.web.localeSyncFailed, { error });
    return null;
  }
}

export async function updateLocaleSetting(locale: SupportedLocale) {
  try {
    await patchCurrentUserSettings({ data: { locale } });
  } catch (error) {
    logger.warn(loggerMessages.web.localeSyncFailed, { error });
  }
}
