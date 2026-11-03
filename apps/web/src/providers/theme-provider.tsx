import React from "react";
import type { ThemeMode } from "@/lib/theme";
import {
  subscribeSettingsTheme,
  useUserSettingsStore,
} from "@/lib/user-settings-store";

/** Existing theme selection and persistence contract. */
export type ThemeProviderValue = {
  /** Whether a theme save is pending. */
  saving: boolean;
  /**
   * Applies and persists the selected theme.
   * @param theme - Theme selected by the user.
   */
  setTheme: (theme: ThemeMode) => void;
  /** Current theme preference. */
  theme: ThemeMode;
};
/** Theme context, or null outside the provider. */
export const ThemeContext = React.createContext<ThemeProviderValue | null>(
  null,
);

/**
 * Exposes the shared preference owner's theme through the existing context.
 * @param props - Application content.
 * @returns Theme context around the content.
 * @throws When used outside LocaleProvider.
 */
export function ThemeProvider({
  children,
}: {
  /** Content receiving theme context. */
  children: React.ReactNode;
}) {
  const store = useUserSettingsStore();
  const snapshot = React.useSyncExternalStore(
    React.useCallback(
      (notify) => subscribeSettingsTheme(store, notify),
      [store],
    ),
    React.useCallback(() => store.state.get(), [store]),
    React.useCallback(() => store.initial, [store]),
  );
  const setTheme = React.useCallback(
    (theme: ThemeMode) => {
      void store.save({ theme });
    },
    [store],
  );
  const value = React.useMemo(
    () => ({
      saving: snapshot.themeSaving,
      theme: snapshot.settings.theme,
      setTheme,
    }),
    [snapshot.themeSaving, snapshot.settings.theme, setTheme],
  );
  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

/**
 * Reads the required theme context.
 * @returns Current theme and selection operation.
 * @throws When used outside ThemeProvider.
 */
export function useTheme() {
  const context = React.useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider.");
  return context;
}
