/** @vitest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { localeStorageKey } from "@/lib/locale";
import { AuthenticatedLocaleSync, LocaleProvider } from "./locale-provider";

const api = vi.hoisted(() => ({
  fetch: vi.fn(),
  update: vi.fn(),
}));
const notifications = vi.hoisted(() => ({ error: vi.fn() }));

vi.mock("@clerk/tanstack-react-start", () => ({
  useAuth: () => ({ isLoaded: true, isSignedIn: true }),
}));

vi.mock("@/lib/locale-api", () => ({
  fetchLocaleSettingsState: api.fetch,
  updateLocaleSetting: api.update,
}));

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
    api.fetch.mockResolvedValue({ settings: { locale: null } });
    api.update.mockRejectedValue(new Error("offline"));

    await act(async () => {
      root.render(
        <LocaleProvider initialSettingsState={null}>
          <AuthenticatedLocaleSync initialSettingsState={null} />
        </LocaleProvider>,
      );
    });

    await vi.waitFor(() => expect(api.update).toHaveBeenCalledWith("es-MX"));
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
