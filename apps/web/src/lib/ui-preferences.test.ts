/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from "vitest";

/** Storage key shared with the interface preference module. */
const storageKey = "pocket-trash.ui-preferences";
/** Cookie name shared with the interface preference module. */
const cookieName = "pocket-trash.ui-preferences";

describe("UI preferences", () => {
  beforeEach(() => {
    window.localStorage.removeItem(storageKey);
    document.cookie = `${cookieName}=; Path=/; Max-Age=0`;
    vi.resetModules();
  });

  it("restores and updates the sidebar preference in browser storage", async () => {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ sidebarCollapsed: true }),
    );
    const { $uiPreferences, setSidebarOpen } = await import("./ui-preferences");

    expect($uiPreferences.get()).toEqual({ sidebarCollapsed: true });
    expect(readPreferenceCookie()).toBeNull();

    setSidebarOpen(true);
    expect($uiPreferences.get()).toEqual({ sidebarCollapsed: false });
    expect(
      JSON.parse(window.localStorage.getItem(storageKey) ?? "null"),
    ).toEqual({ sidebarCollapsed: false });
    expect(readPreferenceCookie()).toEqual({ sidebarCollapsed: false });

    setSidebarOpen(false);
    expect($uiPreferences.get()).toEqual({ sidebarCollapsed: true });
    expect(readPreferenceCookie()).toEqual({ sidebarCollapsed: true });
  });

  it("defaults invalid and incomplete persisted values", async () => {
    const { parseUiPreferences } = await import("./ui-preferences");

    expect(parseUiPreferences("not-json")).toEqual({
      sidebarCollapsed: false,
    });
    expect(
      parseUiPreferences(JSON.stringify({ futurePreference: true })),
    ).toEqual({ sidebarCollapsed: false });
  });
});

/**
 * Reads the interface preference cookie written by the module under test.
 *
 * @returns Parsed cookie preferences, or `null` when the cookie is absent.
 */
function readPreferenceCookie() {
  const value = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${cookieName}=`))
    ?.slice(cookieName.length + 1);

  return value ? JSON.parse(decodeURIComponent(value)) : null;
}
