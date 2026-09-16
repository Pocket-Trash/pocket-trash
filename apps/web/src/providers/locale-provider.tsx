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
import type { UserSettingsState } from "@/lib/user-settings";

type LocaleProviderValue = {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
};

const LocaleContext = React.createContext<LocaleProviderValue | null>(null);

export function LocaleProvider({
  children,
  initialSettingsState,
}: {
  children: React.ReactNode;
  initialSettingsState: UserSettingsState | null;
}) {
  const [locale, setLocaleState] = React.useState<SupportedLocale>(
    () => initialSettingsState?.settings.locale ?? resolveBrowserLocale(),
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
      setLocale,
    }),
    [locale, setLocale],
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function AuthenticatedLocaleSync({
  initialSettingsState,
}: {
  initialSettingsState: UserSettingsState | null;
}) {
  const { isLoaded, isSignedIn } = useAuth();
  const { setLocale } = useLocale();
  const initialStateRef = React.useRef(initialSettingsState);

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
    })().catch(() => undefined);

    return () => {
      canceled = true;
    };
  }, [isLoaded, isSignedIn, setLocale]);

  return null;
}

export function useLocale() {
  const context = React.useContext(LocaleContext);

  if (!context) {
    throw new Error("useLocale must be used within LocaleProvider.");
  }

  return context;
}
