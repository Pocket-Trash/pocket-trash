import { fn } from "storybook/test";

export const fetchLocaleSetting = fn(async () => null).mockName(
  "fetchLocaleSetting",
);
export const updateLocaleSetting = fn(async () => undefined).mockName(
  "updateLocaleSetting",
);
