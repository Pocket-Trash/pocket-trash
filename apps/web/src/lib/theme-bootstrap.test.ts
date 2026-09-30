import { describe, expect, it } from "vitest";
import {
  resolveServerThemeBootstrap,
  resolveThemeBootstrap,
} from "./theme-bootstrap";
import type { UserSettingsState } from "./user-settings";

const defaultSettingsState: UserSettingsState = {
  hasSavedSettings: false,
  settings: {
    currencyCode: "USD",
    dimensionUnit: "in",
    locale: null,
    theme: "system",
    weightUnit: "g",
  },
};

describe("resolveThemeBootstrap", () => {
  it("preserves and persists a local theme when the user has no saved settings", () => {
    expect(resolveThemeBootstrap(defaultSettingsState, "light")).toEqual({
      shouldPersist: true,
      theme: "light",
    });
  });

  it("uses saved settings over local theme when the user has saved settings", () => {
    expect(
      resolveThemeBootstrap(
        {
          ...defaultSettingsState,
          hasSavedSettings: true,
          settings: {
            ...defaultSettingsState.settings,
            theme: "dark",
          },
        },
        "light",
      ),
    ).toEqual({
      shouldPersist: false,
      theme: "dark",
    });
  });

  it("uses server defaults without persisting when there is no local theme", () => {
    expect(resolveThemeBootstrap(defaultSettingsState, null)).toEqual({
      shouldPersist: false,
      theme: "system",
    });
  });
});

describe("resolveServerThemeBootstrap", () => {
  it("uses the saved server theme for first paint when settings exist", () => {
    expect(
      resolveServerThemeBootstrap({
        ...defaultSettingsState,
        hasSavedSettings: true,
        settings: {
          ...defaultSettingsState.settings,
          theme: "light",
        },
      }),
    ).toEqual({
      serverTheme: "light",
      shouldUseServerTheme: true,
    });
  });

  it("falls back to browser theme bootstrap when no saved settings exist", () => {
    expect(resolveServerThemeBootstrap(defaultSettingsState)).toEqual({
      serverTheme: null,
      shouldUseServerTheme: false,
    });
  });

  it("falls back to browser theme bootstrap when signed out", () => {
    expect(resolveServerThemeBootstrap(null)).toEqual({
      serverTheme: null,
      shouldUseServerTheme: false,
    });
  });
});
