import { fn } from "storybook/test";

export const fetchLocaleSettingsState = fn(async () => null).mockName(
  "fetchLocaleSettingsState",
);
export const updateLocaleSetting = fn(async () => undefined).mockName(
  "updateLocaleSetting",
);
