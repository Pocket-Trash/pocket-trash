import { useAuth } from "@clerk/tanstack-react-start";
import { loggerMessages } from "@package/logger";
import { formatTranslation } from "@pocket-trash/localizations";
import { useRouter } from "@tanstack/react-router";
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
  "currencyCode" | "measurementSystem" | "publishTrends"
>;

/** Account-backed settings combined with locally cached display preferences. */
type AccountPenSettings = PenSettings &
  Pick<typeof defaultUserSettings, "isProfilePublic">;

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
      publishTrends: defaultUserSettings.publishTrends,
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
      publishTrends:
        typeof stored?.publishTrends === "boolean"
          ? stored.publishTrends
          : defaultUserSettings.publishTrends,
    };
  } catch {
    return {
      currencyCode: defaultUserSettings.currencyCode,
      measurementSystem: defaultUserSettings.measurementSystem,
      publishTrends: defaultUserSettings.publishTrends,
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
      JSON.stringify({
        currencyCode: settings.currencyCode,
        measurementSystem: settings.measurementSystem,
        publishTrends: settings.publishTrends,
      }),
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
  const { isLoaded, isSignedIn, userId } = useAuth();
  const router = useRouter();
  const { locale, measurementSystem, setMeasurementSystem } = useLocale();
  const settingsSaveFailureMessage = formatTranslation(
    "web.error.settingsSaveFailed",
    {},
    locale,
  );
  const settingsLoadFailureMessage = formatTranslation(
    "error.generic",
    {},
    locale,
  );
  const initialSettings = React.useMemo(readStoredPenSettings, []);
  const [currency, setCurrencyState] = React.useState<CurrencyCode>(
    initialSettings.currencyCode,
  );
  const [saving, setSaving] = React.useState(false);
  const [publishTrends, setPublishTrendsState] = React.useState(
    initialSettings.publishTrends,
  );
  const [isProfilePublic, setIsProfilePublicState] = React.useState(false);
  const [accountSettingsLoaded, setAccountSettingsLoaded] =
    React.useState(false);
  const [accountSettingsLoadFailed, setAccountSettingsLoadFailed] =
    React.useState(false);
  const mutationVersionRef = React.useRef(0);
  const profileMutationVersionRef = React.useRef(0);

  const applyPenSettings = React.useCallback(
    (settings: PenSettings) => {
      setMeasurementSystem(settings.measurementSystem);
      setCurrencyState(settings.currencyCode);
      setPublishTrendsState(settings.publishTrends);
      writeStoredPenSettings(settings);
    },
    [setMeasurementSystem],
  );

  React.useEffect(() => {
    if (!isLoaded || isSignedIn) return;
    applyPenSettings(initialSettings);
  }, [applyPenSettings, initialSettings, isLoaded, isSignedIn]);

  React.useEffect(() => {
    mutationVersionRef.current += 1;
    profileMutationVersionRef.current += 1;
    setSaving(false);
    setIsProfilePublicState(false);
    setAccountSettingsLoaded(false);
    setAccountSettingsLoadFailed(false);
    if (!isLoaded || !isSignedIn || !userId) return;

    let cancelled = false;
    const requestVersion = mutationVersionRef.current;
    const profileMutationVersion = profileMutationVersionRef.current;

    getCurrentUserSettingsState()
      .then((settingsState) => {
        if (cancelled) return;
        if (!settingsState) {
          setAccountSettingsLoadFailed(true);
          toast.error(settingsLoadFailureMessage);
          return;
        }

        if (requestVersion === mutationVersionRef.current) {
          applyPenSettings(settingsState.settings);
        }
        if (profileMutationVersion === profileMutationVersionRef.current) {
          setIsProfilePublicState(settingsState.settings.isProfilePublic);
        }
        setAccountSettingsLoaded(true);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        logger.warn(loggerMessages.web.userSettingsFetchFailed, { error });
        setAccountSettingsLoadFailed(true);
        toast.error(settingsLoadFailureMessage);
      });

    return () => {
      cancelled = true;
    };
  }, [
    applyPenSettings,
    isLoaded,
    isSignedIn,
    settingsLoadFailureMessage,
    userId,
  ]);

  const saveSettings = React.useCallback(
    (patch: UserSettingsPatch, previousSettings: AccountPenSettings) => {
      const mutationVersion = mutationVersionRef.current + 1;
      mutationVersionRef.current = mutationVersion;
      if ("isProfilePublic" in patch) {
        profileMutationVersionRef.current += 1;
      }
      const optimisticSettings = { ...previousSettings, ...patch };

      applyPenSettings(optimisticSettings);
      setIsProfilePublicState(optimisticSettings.isProfilePublic);

      if (!isLoaded || !isSignedIn) {
        return;
      }

      setSaving(true);

      patchCurrentUserSettings({ data: patch })
        .then((settings) => {
          if (mutationVersion !== mutationVersionRef.current) {
            return;
          }

          if (!settings) {
            applyPenSettings(previousSettings);
            setIsProfilePublicState(previousSettings.isProfilePublic);
            toast.error(settingsSaveFailureMessage);
            return;
          }

          applyPenSettings(settings);
          setIsProfilePublicState(settings.isProfilePublic);
          void router.invalidate();
        })
        .catch((error: unknown) => {
          logger.warn(loggerMessages.web.userSettingsSaveFailed, { error });

          if (mutationVersion !== mutationVersionRef.current) return;

          applyPenSettings(previousSettings);
          setIsProfilePublicState(previousSettings.isProfilePublic);
          toast.error(settingsSaveFailureMessage);
        })
        .finally(() => {
          if (mutationVersion === mutationVersionRef.current) {
            setSaving(false);
          }
        });
    },
    [
      applyPenSettings,
      isLoaded,
      isSignedIn,
      router,
      settingsSaveFailureMessage,
    ],
  );

  const updateMeasurementSystem = React.useCallback(
    (nextSystem: MeasurementSystem) => {
      saveSettings(
        { measurementSystem: nextSystem },
        {
          currencyCode: currency,
          isProfilePublic,
          measurementSystem,
          publishTrends,
        },
      );
    },
    [currency, isProfilePublic, measurementSystem, publishTrends, saveSettings],
  );

  const setCurrency = React.useCallback(
    (nextCurrency: CurrencyCode) => {
      saveSettings(
        { currencyCode: nextCurrency },
        {
          currencyCode: currency,
          isProfilePublic,
          measurementSystem,
          publishTrends,
        },
      );
    },
    [currency, isProfilePublic, measurementSystem, publishTrends, saveSettings],
  );

  const setPublishTrends = React.useCallback(
    (nextValue: boolean) => {
      saveSettings(
        { publishTrends: nextValue },
        {
          currencyCode: currency,
          isProfilePublic,
          measurementSystem,
          publishTrends,
        },
      );
    },
    [currency, isProfilePublic, measurementSystem, publishTrends, saveSettings],
  );

  const setIsProfilePublic = React.useCallback(
    (nextValue: boolean) => {
      saveSettings(
        { isProfilePublic: nextValue },
        {
          currencyCode: currency,
          isProfilePublic,
          measurementSystem,
          publishTrends,
        },
      );
    },
    [currency, isProfilePublic, measurementSystem, publishTrends, saveSettings],
  );

  return {
    accountSettingsLoadFailed,
    accountSettingsLoaded,
    currency,
    isProfilePublic,
    measurementSystem,
    publishTrends,
    setCurrency,
    setIsProfilePublic,
    setMeasurementSystem: updateMeasurementSystem,
    setPublishTrends,
    saving,
  };
}
