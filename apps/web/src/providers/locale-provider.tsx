import { useAuth } from "@clerk/tanstack-react-start";
import {
  formatTranslation,
  type SupportedLocale,
} from "@pocket-trash/localizations";
import * as React from "react";
import { toast } from "sonner";
import {
  readStoredLocale,
  resolveAuthenticatedLocale,
  resolveBrowserLocale,
  writeStoredLocale,
} from "@/lib/locale";
import {
  fetchLocaleSettingsState,
  updateLocaleSetting,
} from "@/lib/locale-api";
import type { MeasurementSystem } from "@/lib/pen-formatters";
import type { UserSettingsState } from "@/lib/user-settings";

/** Active locale and local preference update operation. */
type LocaleProviderValue = {
  /** Active supported locale. */
  locale: SupportedLocale;
  /** Active app-wide measurement display preference. */
  measurementSystem: MeasurementSystem;
  /**
   * Updates and locally persists the active locale.
   *
   * @param locale - Supported locale selected by the user.
   */
  setLocale: (locale: SupportedLocale) => void;
  /**
   * Updates the active measurement display preference.
   *
   * @param system - Metric or imperial display preference.
   */
  setMeasurementSystem: (system: MeasurementSystem) => void;
};

/** Locale context, or `null` outside the provider. */
const LocaleContext = React.createContext<LocaleProviderValue | null>(null);

/**
 * Initializes locale state and keeps the document language synchronized.
 *
 * @param props - Application content and server-loaded settings.
 * @returns Locale context provider around the application content.
 */
export function LocaleProvider({
  children,
  initialSettingsState,
}: {
  /** Application content. */
  children: React.ReactNode;
  /** Server-loaded settings, or `null` when unavailable. */
  initialSettingsState: UserSettingsState | null;
}) {
  const [locale, setLocaleState] = React.useState<SupportedLocale>(
    () => initialSettingsState?.settings.locale ?? resolveBrowserLocale(),
  );
  const [measurementSystem, setMeasurementSystem] =
    React.useState<MeasurementSystem>(
      () => initialSettingsState?.settings.measurementSystem ?? "metric",
    );

  React.useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = React.useCallback((nextLocale: SupportedLocale) => {
    setLocaleState(nextLocale);
    writeStoredLocale(nextLocale);
  }, []);

  const value = React.useMemo(
    () => ({
      locale,
      measurementSystem,
      setLocale,
      setMeasurementSystem,
    }),
    [locale, measurementSystem, setLocale],
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

/**
 * Reconciles an authenticated user's local locale with persisted settings.
 *
 * @param props - Optional server-loaded settings used before a client fetch.
 * @returns No UI.
 * @throws When rendered outside {@link LocaleProvider}.
 */
export function AuthenticatedLocaleSync({
  initialSettingsState,
}: {
  /** Server-loaded settings, or `null` when a client fetch is required. */
  initialSettingsState: UserSettingsState | null;
}) {
  const { isLoaded, isSignedIn } = useAuth();
  const { locale, setLocale } = useLocale();
  const initialStateRef = React.useRef(initialSettingsState);
  const localeRef = React.useRef(locale);
  localeRef.current = locale;

  React.useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    let canceled = false;

    void (async () => {
      const settingsState =
        initialStateRef.current ?? (await fetchLocaleSettingsState());
      initialStateRef.current = null;
      const next = resolveAuthenticatedLocale(
        settingsState,
        readStoredLocale(),
      );

      if (canceled || !next.locale) return;

      setLocale(next.locale);

      if (next.shouldPersist) {
        await updateLocaleSetting(next.locale).catch(() => {
          if (!canceled) {
            toast.error(
              formatTranslation(
                "web.error.settingsSaveFailed",
                {},
                next.locale,
              ),
            );
          }
        });
      }
    })().catch(() => {
      if (!canceled) {
        toast.error(
          formatTranslation(
            "web.error.settingsSaveFailed",
            {},
            localeRef.current,
          ),
        );
      }
    });

    return () => {
      canceled = true;
    };
  }, [isLoaded, isSignedIn, setLocale]);

  return null;
}

/**
 * Reads the required locale provider value.
 *
 * @returns Active locale and update operation.
 * @throws When called outside {@link LocaleProvider}.
 */
export function useLocale() {
  const context = React.useContext(LocaleContext);

  if (!context) {
    throw new Error("useLocale must be used within LocaleProvider.");
  }

  return context;
}

/**
 * Reads the active locale without requiring a provider.
 *
 * @returns Active locale, or `null` outside {@link LocaleProvider}.
 */
export function useOptionalLocale() {
  return React.useContext(LocaleContext)?.locale ?? null;
}
