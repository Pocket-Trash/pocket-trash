import { loggerMessages } from "@package/logger";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSettings: vi.fn(),
  warn: vi.fn(),
}));

vi.mock("@/lib/user-settings", () => ({
  defaultUserSettings: {
    currencyCode: "USD",
    dimensionUnit: "in",
    locale: null,
    theme: "system",
    weightUnit: "g",
  },
  getCurrentUserSettingsState: mocks.getSettings,
  patchCurrentUserSettings: vi.fn(),
  userSettingsStorageKey: "pocket-trash.settings",
}));

vi.mock("@/lib/services", () => ({
  s: { logger: { warn: mocks.warn } },
}));

vi.mock("@/lib/logger", () => ({
  logger: { warn: mocks.warn },
}));

import { Route } from "./__root";

describe("root route loader", () => {
  it("fails open when optional user settings cannot load", async () => {
    const error = new Error("settings unavailable");
    mocks.getSettings.mockRejectedValue(error);
    const loader = Route.options.loader;

    expect(typeof loader).toBe("function");
    if (typeof loader !== "function")
      throw new Error("Root loader is missing.");

    await expect(loader({} as never)).resolves.toMatchObject({
      settingsState: null,
      themeBootstrap: {
        serverTheme: null,
        shouldUseServerTheme: false,
      },
    });
    expect(mocks.warn).toHaveBeenCalledWith(
      loggerMessages.web.userSettingsFetchFailed,
      { error },
    );
  });
});
