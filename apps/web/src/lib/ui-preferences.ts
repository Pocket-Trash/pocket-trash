import { persistentAtom } from "@nanostores/persistent";
import { createContext } from "react";

/** Browser-only interface preferences shared across application routes. */
export type UiPreferences = {
  /** Whether the desktop profile and admin sidebar is collapsed. */
  sidebarCollapsed: boolean;
};

/** Default interface preferences used without valid persisted state. */
export const defaultUiPreferences: UiPreferences = {
  sidebarCollapsed: false,
};

/** Shared localStorage key for browser interface preferences. */
export const uiPreferencesStorageKey = "pocket-trash.ui-preferences";

/** Shared cookie name for server-rendered interface preferences. */
export const uiPreferencesCookieName = "pocket-trash.ui-preferences";

/** Server-loaded interface preferences used for the hydration snapshot. */
export const InitialUiPreferencesContext = createContext(defaultUiPreferences);

/** Persisted application-wide interface preferences. */
export const $uiPreferences = persistentAtom<UiPreferences>(
  uiPreferencesStorageKey,
  defaultUiPreferences,
  {
    decode: parseUiPreferences,
    encode: JSON.stringify,
  },
);

/**
 * Parses untrusted serialized interface preferences.
 *
 * @param value - JSON read from localStorage or the request cookie.
 * @returns Valid preferences with defaults for missing or invalid fields.
 */
export function parseUiPreferences(
  value: string | null | undefined,
): UiPreferences {
  if (!value) return defaultUiPreferences;

  try {
    const parsed: unknown = JSON.parse(value);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return defaultUiPreferences;
    }

    const preferences = parsed as Record<string, unknown>;
    return {
      sidebarCollapsed: preferences.sidebarCollapsed === true,
    };
  } catch {
    return defaultUiPreferences;
  }
}

/**
 * Updates interface preferences in localStorage and the server-readable cookie.
 *
 * @param patch - Preference values to replace while preserving other fields.
 */
export function updateUiPreferences(patch: Partial<UiPreferences>) {
  const preferences = { ...$uiPreferences.get(), ...patch };
  $uiPreferences.set(preferences);
  writeUiPreferencesCookie(preferences);
}

/**
 * Stores the desktop sidebar's next expanded state.
 *
 * @param open - Whether the desktop sidebar should be expanded.
 */
export function setSidebarOpen(open: boolean) {
  updateUiPreferences({ sidebarCollapsed: !open });
}

/**
 * Mirrors interface preferences into a long-lived same-site browser cookie.
 *
 * @param preferences - Validated preferences to expose during server rendering.
 */
function writeUiPreferencesCookie(preferences: UiPreferences) {
  if (typeof document === "undefined") return;

  const secure = globalThis.location?.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${uiPreferencesCookieName}=${encodeURIComponent(JSON.stringify(preferences))}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
}
