import { loggerMessages } from "@package/logger";
import { formatTranslation } from "@pocket-trash/localizations";
import * as React from "react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import {
  applyTheme,
  isThemeMode,
  type ThemeMode,
  themeStorageKey,
} from "@/lib/theme";
import { resolveThemeBootstrap } from "@/lib/theme-bootstrap";
import {
  getCurrentUserSettingsState,
  patchCurrentUserSettings,
  type UserSettingsState,
} from "@/lib/user-settings";
import { useLocale } from "@/providers/locale-provider";

type ThemeProviderValue = {
  saving: boolean;
  setTheme: (theme: ThemeMode) => void;
  theme: ThemeMode;
};

const ThemeContext = React.createContext<ThemeProviderValue | null>(null);
const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? React.useEffect : React.useLayoutEffect;

function readTheme(initialSettingsState: UserSettingsState | null): ThemeMode {
  if (initialSettingsState?.hasSavedSettings) {
    return initialSettingsState.settings.theme;
  }

  if (typeof window === "undefined") return "system";

  const stored = window.localStorage.getItem(themeStorageKey);
  return isThemeMode(stored) ? stored : "system";
}

export function ThemeProvider({
  children,
  initialSettingsState,
}: {
  children: React.ReactNode;
  initialSettingsState: UserSettingsState | null;
}) {
  const { locale } = useLocale();
  const settingsSaveFailureMessage = formatTranslation(
    "web.error.settingsSaveFailed",
    {},
    locale,
  );
  const [theme, setThemeState] = React.useState<ThemeMode>(() =>
    readTheme(initialSettingsState),
  );
  const [saving, setSaving] = React.useState(false);
  const mutationVersionRef = React.useRef(0);

  React.useEffect(() => {
    applyTheme(theme);

    if (theme !== "system") return undefined;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  useIsomorphicLayoutEffect(() => {
    if (!initialSettingsState) return;

    const stored = window.localStorage.getItem(themeStorageKey);
    const localTheme = isThemeMode(stored) ? stored : null;
    const next = resolveThemeBootstrap(initialSettingsState, localTheme);

    setThemeState(next.theme);
    window.localStorage.setItem(themeStorageKey, next.theme);
    applyTheme(next.theme);
  }, [initialSettingsState]);

  React.useEffect(() => {
    let cancelled = false;
    const requestVersion = mutationVersionRef.current;

    if (initialSettingsState) {
      const stored = window.localStorage.getItem(themeStorageKey);
      const localTheme = isThemeMode(stored) ? stored : null;
      const next = resolveThemeBootstrap(initialSettingsState, localTheme);

      if (next.shouldPersist) {
        patchCurrentUserSettings({ data: { theme: next.theme } }).catch(
          (error: unknown) => {
            logger.warn(loggerMessages.web.userSettingsSaveFailed, { error });
            toast.error(settingsSaveFailureMessage);
          },
        );
      }

      return () => {
        cancelled = true;
      };
    }

    getCurrentUserSettingsState()
      .then((settingsState) => {
        if (
          cancelled ||
          !settingsState ||
          requestVersion !== mutationVersionRef.current
        ) {
          return;
        }

        const stored = window.localStorage.getItem(themeStorageKey);
        const localTheme = isThemeMode(stored) ? stored : null;
        const next = resolveThemeBootstrap(settingsState, localTheme);

        setThemeState(next.theme);
        window.localStorage.setItem(themeStorageKey, next.theme);
        applyTheme(next.theme);

        if (!next.shouldPersist) return;

        patchCurrentUserSettings({ data: { theme: next.theme } }).catch(
          (error: unknown) => {
            logger.warn(loggerMessages.web.userSettingsSaveFailed, { error });
            toast.error(settingsSaveFailureMessage);
          },
        );
      })
      .catch((error: unknown) => {
        logger.warn(loggerMessages.web.userSettingsFetchFailed, { error });
      });

    return () => {
      cancelled = true;
    };
  }, [initialSettingsState, settingsSaveFailureMessage]);

  const setTheme = React.useCallback(
    (nextTheme: ThemeMode) => {
      const previousTheme = theme;
      const mutationVersion = mutationVersionRef.current + 1;
      mutationVersionRef.current = mutationVersion;

      setThemeState(nextTheme);
      window.localStorage.setItem(themeStorageKey, nextTheme);
      applyTheme(nextTheme);

      setSaving(true);
      patchCurrentUserSettings({ data: { theme: nextTheme } })
        .then((settings) => {
          if (!settings || mutationVersion !== mutationVersionRef.current) {
            return;
          }

          setThemeState(settings.theme);
          window.localStorage.setItem(themeStorageKey, settings.theme);
          applyTheme(settings.theme);
        })
        .catch((error: unknown) => {
          logger.warn(loggerMessages.web.userSettingsSaveFailed, { error });

          if (mutationVersion !== mutationVersionRef.current) return;

          setThemeState(previousTheme);
          window.localStorage.setItem(themeStorageKey, previousTheme);
          applyTheme(previousTheme);
          toast.error(settingsSaveFailureMessage);
        })
        .finally(() => {
          if (mutationVersion === mutationVersionRef.current) {
            setSaving(false);
          }
        });
    },
    [settingsSaveFailureMessage, theme],
  );

  const value = React.useMemo(
    () => ({
      saving,
      setTheme,
      theme,
    }),
    [saving, setTheme, theme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = React.useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider.");
  }

  return context;
}
