import { fn } from "storybook/test";

/** Storybook mock that reports no persisted locale settings.
 *
 * @returns A promise resolving to no settings state.
 */
export const fetchLocaleSettingsState = fn(async () => null).mockName(
  "fetchLocaleSettingsState",
);
/** Storybook mock that accepts a locale-setting update.
 *
 * @returns A promise resolving after the mock records the update.
 */
export const updateLocaleSetting = fn(async () => undefined).mockName(
  "updateLocaleSetting",
);
