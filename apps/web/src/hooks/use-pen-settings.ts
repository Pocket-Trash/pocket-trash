import { useAuth } from "@clerk/tanstack-react-start";
import { loggerMessages } from "@package/logger";
import { formatTranslation } from "@pocket-trash/localizations";
import * as React from "react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import {
  type CurrencyCode,
  currencies,
  type MeasurementSystem,
} from "@/lib/pen-formatters";
import {
  defaultUserSettings,
  getCurrentUserSettingsState,
  patchCurrentUserSettings,
  type UserSettingsPatch,
  userSettingsStorageKey,
} from "@/lib/user-settings";
import { useLocale } from "@/providers/locale-provider";

/** User-selectable pen measurement and display preferences. */
type PenSettings = Pick<
  typeof defaultUserSettings,
  "currencyCode" | "measurementSystem"
>;

/**
 * Reads valid pen display settings from local storage.
 *
 * @returns Stored settings with invalid or unavailable values replaced by defaults.
 */
function readStoredPenSettings(): PenSettings {
  if (typeof window === "undefined") {
    return {
      currencyCode: defaultUserSettings.currencyCode,
      measurementSystem: defaultUserSettings.measurementSystem,
    };
  }

  try {
    const stored = JSON.parse(
      window.localStorage.getItem(userSettingsStorageKey) ?? "null",
    ) as Partial<PenSettings> | null;

    return {
      currencyCode:
        stored?.currencyCode && currencies.includes(stored.currencyCode)
          ? stored.currencyCode
          : defaultUserSettings.currencyCode,
      measurementSystem:
        stored?.measurementSystem === "metric" ||
        stored?.measurementSystem === "imperial"
          ? stored.measurementSystem
          : defaultUserSettings.measurementSystem,
    };
  } catch {
    return {
      currencyCode: defaultUserSettings.currencyCode,
      measurementSystem: defaultUserSettings.measurementSystem,
    };
  }
}

/**
 * Persists pen display settings on a best-effort basis.
 *
 * @param settings - Valid display preferences to serialize.
 */
function writeStoredPenSettings(settings: PenSettings): void {
  try {
    window.localStorage.setItem(
      userSettingsStorageKey,
      JSON.stringify(settings),
    );
  } catch {
    // Local persistence is best-effort; the save path still reports server errors.
  }
}

/**
 * Synchronizes pen display settings across local storage and the signed-in account.
 *
 * @returns Current units and currency, optimistic setters, and save state.
 * @throws When called outside `LocaleProvider`.
 */
export function usePenSettings() {
  const { isLoaded, isSignedIn } = useAuth();
  const { locale, measurementSystem, setMeasurementSystem } = useLocale();
  const settingsSaveFailureMessage = formatTranslation(
    "web.error.settingsSaveFailed",
    {},
    locale,
  );
  const initialSettings = React.useMemo(readStoredPenSettings, []);
  const [currency, setCurrencyState] = React.useState<CurrencyCode>(
    initialSettings.currencyCode,
  );
  const [saving, setSaving] = React.useState(false);
  const mutationVersionRef = React.useRef(0);

  const applyPenSettings = React.useCallback(
    (settings: PenSettings) => {
      setMeasurementSystem(settings.measurementSystem);
      setCurrencyState(settings.currencyCode);
      writeStoredPenSettings(settings);
    },
    [setMeasurementSystem],
  );

  React.useEffect(() => {
    if (!isLoaded || isSignedIn) return;
    applyPenSettings(initialSettings);
  }, [applyPenSettings, initialSettings, isLoaded, isSignedIn]);

  React.useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    let cancelled = false;
    const requestVersion = mutationVersionRef.current;

    getCurrentUserSettingsState()
      .then((settingsState) => {
        if (
          cancelled ||
          !settingsState?.hasSavedSettings ||
          requestVersion !== mutationVersionRef.current
        ) {
          return;
        }

        applyPenSettings(settingsState.settings);
      })
      .catch((error: unknown) => {
        logger.warn(loggerMessages.web.userSettingsFetchFailed, { error });
      });

    return () => {
      cancelled = true;
    };
  }, [applyPenSettings, isLoaded, isSignedIn]);

  const saveSettings = React.useCallback(
    (patch: UserSettingsPatch, previousSettings: PenSettings) => {
      const mutationVersion = mutationVersionRef.current + 1;
      mutationVersionRef.current = mutationVersion;
      const optimisticSettings = { ...previousSettings, ...patch };

      applyPenSettings(optimisticSettings);

      if (!isLoaded || !isSignedIn) {
        return;
      }

      setSaving(true);

      patchCurrentUserSettings({ data: patch })
        .then((settings) => {
          if (!settings || mutationVersion !== mutationVersionRef.current) {
            return;
          }

          applyPenSettings(settings);
        })
        .catch((error: unknown) => {
          logger.warn(loggerMessages.web.userSettingsSaveFailed, { error });

          if (mutationVersion !== mutationVersionRef.current) return;

          applyPenSettings(previousSettings);
          toast.error(settingsSaveFailureMessage);
        })
        .finally(() => {
          if (mutationVersion === mutationVersionRef.current) {
            setSaving(false);
          }
        });
    },
    [applyPenSettings, isLoaded, isSignedIn, settingsSaveFailureMessage],
  );

  const updateMeasurementSystem = React.useCallback(
    (nextSystem: MeasurementSystem) => {
      saveSettings(
        { measurementSystem: nextSystem },
        { currencyCode: currency, measurementSystem },
      );
    },
    [currency, measurementSystem, saveSettings],
  );

  const setCurrency = React.useCallback(
    (nextCurrency: CurrencyCode) => {
      saveSettings(
        { currencyCode: nextCurrency },
        { currencyCode: currency, measurementSystem },
      );
    },
    [currency, measurementSystem, saveSettings],
  );

  return {
    currency,
    measurementSystem,
    setCurrency,
    setMeasurementSystem: updateMeasurementSystem,
    saving,
  };
}
