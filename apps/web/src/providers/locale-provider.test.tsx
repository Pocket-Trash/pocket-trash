/** @vitest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { localeStorageKey } from "@/lib/locale";
import { AuthenticatedLocaleSync, LocaleProvider } from "./locale-provider";

/** Locale API mocks shared by synchronization tests. */
const api = vi.hoisted(() => ({
  fetch: vi.fn(),
  update: vi.fn(),
}));
/** Toast notification mock used to assert failed synchronization. */
const notifications = vi.hoisted(() => ({ error: vi.fn() }));

vi.mock("@clerk/tanstack-react-start", () => ({
  /**
   * Returns a loaded, signed-in Clerk session for provider tests.
   *
   * @returns Authenticated session state.
   */
  useAuth: () => ({ isLoaded: true, isSignedIn: true, userId: "locale-user" }),
}));

vi.mock("@/lib/user-settings", () => ({
  defaultUserSettings: {
    currencyCode: "USD",
    isProfilePublic: false,
    locale: null,
    measurementSystem: "metric",
    publishTrends: false,
    theme: "system",
  },
  getCurrentUserSettingsState: api.fetch,
  patchCurrentUserSettings: api.update,
  userSettingsStorageKey: "pocket-trash.settings",
}));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn() } }));

vi.mock("sonner", () => ({ toast: notifications }));

describe("AuthenticatedLocaleSync", () => {
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    const container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.replaceChildren();
  });

  it("keeps the anonymous locale and reports a failed promotion", async () => {
    window.localStorage.setItem(localeStorageKey, "es-MX");
    api.fetch.mockResolvedValue({
      hasSavedSettings: false,
      settings: {
        currencyCode: "USD",
        isProfilePublic: false,
        locale: null,
        measurementSystem: "metric",
        publishTrends: false,
        theme: "system",
      },
    });
    api.update.mockRejectedValue(new Error("offline"));

    await act(async () => {
      root.render(
        <LocaleProvider initialSettingsState={null}>
          <AuthenticatedLocaleSync initialSettingsState={null} />
        </LocaleProvider>,
      );
    });

    await vi.waitFor(() =>
      expect(api.update).toHaveBeenCalledWith({
        data: { locale: "es-MX" },
        signal: expect.any(AbortSignal),
      }),
    );
    expect(window.localStorage.getItem(localeStorageKey)).toBe("es-MX");
    expect(notifications.error).toHaveBeenCalledOnce();
  });

  it("reports a failed authenticated settings load", async () => {
    window.localStorage.setItem(localeStorageKey, "es-MX");
    api.fetch.mockRejectedValue(new Error("offline"));

    await act(async () => {
      root.render(
        <LocaleProvider initialSettingsState={null}>
          <AuthenticatedLocaleSync initialSettingsState={null} />
        </LocaleProvider>,
      );
    });

    await vi.waitFor(() => expect(notifications.error).toHaveBeenCalledOnce());
    expect(window.localStorage.getItem(localeStorageKey)).toBe("es-MX");
  });
});
