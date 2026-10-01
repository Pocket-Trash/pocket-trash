import type { ThemeMode } from "@/lib/theme";
import type { UserSettingsState } from "@/lib/user-settings";

/** Server-provided theme state used during the initial render. */
export type ThemeBootstrapState = {
  /** Persisted server theme, or `null` when the browser should decide. */
  serverTheme: ThemeMode | null;
  /** Whether the initial render should apply the server theme. */
  shouldUseServerTheme: boolean;
};

/** Reconciles persisted user settings with a local browser theme.
 *
 * @param settingsState - Current user settings and persistence state.
 * @param localTheme - Theme stored in the browser, or `null` when absent.
 * @returns The selected theme and whether it should be persisted to user settings.
 */
export function resolveThemeBootstrap(
  settingsState: UserSettingsState,
  localTheme: ThemeMode | null,
) {
  if (settingsState.hasSavedSettings) {
    return {
      shouldPersist: false,
      theme: settingsState.settings.theme,
    };
  }

  return {
    shouldPersist: Boolean(localTheme),
    theme: localTheme ?? settingsState.settings.theme,
  };
}

/** Selects the persisted theme suitable for the initial server render.
 *
 * @param settingsState - Current user settings, or `null` for signed-out requests.
 * @returns The server theme and whether the initial render should use it.
 */
export function resolveServerThemeBootstrap(
  settingsState: UserSettingsState | null,
): ThemeBootstrapState {
  if (!settingsState?.hasSavedSettings) {
    return {
      serverTheme: null,
      shouldUseServerTheme: false,
    };
  }

  return {
    serverTheme: settingsState.settings.theme,
    shouldUseServerTheme: true,
  };
}
