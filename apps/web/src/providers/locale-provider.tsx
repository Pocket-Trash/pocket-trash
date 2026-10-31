import type { SupportedLocale } from "@pocket-trash/localizations";
import * as React from "react";
import type { MeasurementSystem } from "@/lib/pen-formatters";
import type { UserSettingsState } from "@/lib/user-settings";
import {
  createUserSettingsStore,
  subscribeSettingsDocument,
  UserSettingsContext,
  type UserSettingsStore,
} from "@/lib/user-settings-store";

import { UserSettingsProvider } from "./user-settings-provider";

/** Compatibility name for the former locale-only bootstrap component. */
export const AuthenticatedLocaleSync: React.ComponentType<{
  /** Initial preferences owned by the surrounding LocaleProvider. */
  initialSettingsState: UserSettingsState | null;
}> = UserSettingsProvider;

/** Active locale and local preference update operations. */
type LocaleProviderValue = {
  /** Active supported locale. */
  locale: SupportedLocale;
  /** Active measurement display preference. */
  measurementSystem: MeasurementSystem;
  /**
   * Applies the locale and persists the active account preference.
   * @param locale - Selected supported locale.
   */
  setLocale: (locale: SupportedLocale) => void;
  /**
   * Updates and locally persists the measurement display preference.
   * @param system - Selected measurement system.
   */
  setMeasurementSystem: (system: MeasurementSystem) => void;
};
/** Locale context, or null outside the provider. */
const LocaleContext = React.createContext<LocaleProviderValue | null>(null);

/**
 * Owns one request-isolated settings store and binds document preferences.
 *
 * @param props - Content and server-loaded initial settings.
 * @returns Existing locale context around the isolated settings owner.
 */
export function LocaleProvider({
  children,
  initialSettingsState,
}: {
  /** Application content. */
  children: React.ReactNode;
  /** Server-loaded preferences for this request. */
  initialSettingsState: UserSettingsState | null;
}) {
  const owner = React.useRef<UserSettingsStore | null>(null);
  if (!owner.current)
    owner.current = createUserSettingsStore(initialSettingsState);
  const store = owner.current;
  const snapshot = React.useSyncExternalStore(
    React.useCallback(
      (notify) => subscribeSettingsDocument(store, notify),
      [store],
    ),
    React.useCallback(() => store.state.get(), [store]),
    React.useCallback(() => store.initial, [store]),
  );
  const setLocale = React.useCallback(
    (locale: SupportedLocale) => {
      void store.save({ locale });
    },
    [store],
  );
  const setMeasurementSystem = React.useCallback(
    (measurementSystem: MeasurementSystem) =>
      store.select({ measurementSystem }),
    [store],
  );
  const value = React.useMemo(
    () => ({
      locale: snapshot.locale,
      measurementSystem: snapshot.settings.measurementSystem,
      setLocale,
      setMeasurementSystem,
    }),
    [
      snapshot.locale,
      snapshot.settings.measurementSystem,
      setLocale,
      setMeasurementSystem,
    ],
  );
  return (
    <UserSettingsContext.Provider value={store}>
      <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
    </UserSettingsContext.Provider>
  );
}

/**
 * Reads the required locale context.
 * @returns Active locale and preference operations.
 * @throws When used outside LocaleProvider.
 */
export function useLocale() {
  const context = React.useContext(LocaleContext);
  if (!context)
    throw new Error("useLocale must be used within LocaleProvider.");
  return context;
}

/**
 * Reads the locale without requiring a provider.
 * @returns Active locale, or null outside LocaleProvider.
 */
export function useOptionalLocale() {
  return React.useContext(LocaleContext)?.locale ?? null;
}
