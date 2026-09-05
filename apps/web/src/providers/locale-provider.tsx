import { useAuth } from "@clerk/tanstack-react-start";
import type { SupportedLocale } from "@pocket-trash/localizations";
import * as React from "react";
import { resolveBrowserLocale, writeStoredLocale } from "@/lib/locale";
import { fetchLocaleSetting } from "@/lib/locale-api";
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

export function AuthenticatedLocaleSync() {
  const { isLoaded, isSignedIn } = useAuth();
  const { setLocale } = useLocale();

  React.useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      setLocale(resolveBrowserLocale());
      return;
    }

    let canceled = false;

    void fetchLocaleSetting().then((locale) => {
      if (!canceled && locale) setLocale(locale);
    });

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
