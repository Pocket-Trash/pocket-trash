import { loggerMessages } from "@package/logger";
import { formatTranslation } from "@pocket-trash/localizations";
import * as React from "react";
import { toast } from "sonner";
import { compactMediaQuery } from "@/lib/breakpoints";
import { logger } from "@/lib/logger";
import {
  baseCurrency,
  type CurrencyCode,
  type CurrencyRates,
  currencies,
  type DimensionUnit,
  todayUTCDateString,
  type WeightUnit,
} from "@/lib/pen-formatters";
import {
  defaultUserSettings,
  getCurrentUserSettingsState,
  patchCurrentUserSettings,
  type UserSettingsPatch,
  userSettingsStorageKey,
} from "@/lib/user-settings";
import { useLocale } from "@/providers/locale-provider";

const filtersClosedStorageKey = "pocket-trash.filtersClosed";
const rateStorageKey = `pocket-trash.fxRates.${baseCurrency}`;
type PenSettings = Pick<
  typeof defaultUserSettings,
  "currencyCode" | "dimensionUnit" | "weightUnit"
>;

function readStoredPenSettings(): PenSettings {
  if (typeof window === "undefined") {
    return {
      currencyCode: defaultUserSettings.currencyCode,
      dimensionUnit: defaultUserSettings.dimensionUnit,
      weightUnit: defaultUserSettings.weightUnit,
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
      dimensionUnit:
        stored?.dimensionUnit === "mm" || stored?.dimensionUnit === "in"
          ? stored.dimensionUnit
          : defaultUserSettings.dimensionUnit,
      weightUnit:
        stored?.weightUnit === "oz" || stored?.weightUnit === "g"
          ? stored.weightUnit
          : defaultUserSettings.weightUnit,
    };
  } catch {
    return {
      currencyCode: defaultUserSettings.currencyCode,
      dimensionUnit: defaultUserSettings.dimensionUnit,
      weightUnit: defaultUserSettings.weightUnit,
    };
  }
}

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

export function usePenSettings() {
  const { locale } = useLocale();
  const settingsSaveFailureMessage = formatTranslation(
    "web.error.settingsSaveFailed",
    {},
    locale,
  );
  const initialSettings = React.useMemo(readStoredPenSettings, []);
  const [units, setUnitsState] = React.useState<DimensionUnit>(
    initialSettings.dimensionUnit,
  );
  const [weight, setWeightState] = React.useState<WeightUnit>(
    initialSettings.weightUnit,
  );
  const [currency, setCurrencyState] = React.useState<CurrencyCode>(
    initialSettings.currencyCode,
  );
  const [saving, setSaving] = React.useState(false);
  const mutationVersionRef = React.useRef(0);

  const applyPenSettings = React.useCallback((settings: PenSettings) => {
    setUnitsState(settings.dimensionUnit);
    setWeightState(settings.weightUnit);
    setCurrencyState(settings.currencyCode);
    writeStoredPenSettings(settings);
  }, []);

  React.useEffect(() => {
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
  }, [applyPenSettings]);

  const saveSettings = React.useCallback(
    (patch: UserSettingsPatch, previousSettings: PenSettings) => {
      const mutationVersion = mutationVersionRef.current + 1;
      mutationVersionRef.current = mutationVersion;
      const optimisticSettings = { ...previousSettings, ...patch };

      applyPenSettings(optimisticSettings);
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
    [applyPenSettings, settingsSaveFailureMessage],
  );

  const setUnits = React.useCallback(
    (nextUnits: DimensionUnit) => {
      saveSettings(
        { dimensionUnit: nextUnits },
        { currencyCode: currency, dimensionUnit: units, weightUnit: weight },
      );
    },
    [currency, saveSettings, units, weight],
  );

  const setWeight = React.useCallback(
    (nextWeight: WeightUnit) => {
      saveSettings(
        { weightUnit: nextWeight },
        { currencyCode: currency, dimensionUnit: units, weightUnit: weight },
      );
    },
    [currency, saveSettings, units, weight],
  );

  const setCurrency = React.useCallback(
    (nextCurrency: CurrencyCode) => {
      saveSettings(
        { currencyCode: nextCurrency },
        { currencyCode: currency, dimensionUnit: units, weightUnit: weight },
      );
    },
    [currency, saveSettings, units, weight],
  );

  return {
    currency,
    setCurrency,
    setUnits,
    setWeight,
    saving,
    units,
    weight,
  };
}

export function useCurrencyRates() {
  const [rates, setRates] = React.useState<CurrencyRates>({
    [baseCurrency]: 1,
  });

  // `force` skips the once-a-day cache so pull-to-refresh always re-hits the FX
  // API; the normal mount path still short-circuits on a same-day cache hit.
  const loadRates = React.useCallback(async (force = false) => {
    const today = todayUTCDateString();

    if (!force) {
      try {
        const cached = JSON.parse(
          window.localStorage.getItem(rateStorageKey) ?? "null",
        ) as { date?: string; rates?: CurrencyRates } | null;

        if (cached?.date === today && cached.rates) {
          setRates({ [baseCurrency]: 1, ...cached.rates });
          return;
        }
      } catch {
        // Ignore malformed cache entries and fetch fresh rates.
      }

      const symbols = currencies
        .filter((currency) => currency !== baseCurrency)
        .join(",");

      try {
        const response = await fetch(
          `https://api.frankfurter.dev/v1/latest?base=${baseCurrency}&symbols=${symbols}`,
          { cache: "no-store" },
        );

        if (!response.ok) throw new Error(`FX ${response.status}`);

        const data = (await response.json()) as { rates?: CurrencyRates };
        if (data.rates) {
          const nextRates = { [baseCurrency]: 1, ...data.rates };
          setRates(nextRates);
          window.localStorage.setItem(
            rateStorageKey,
            JSON.stringify({ date: today, rates: data.rates }),
          );
        }
      } catch (error) {
        logger.warn(loggerMessages.web.fxRatesFetchFailed, {
          attributes: {
            baseCurrency,
            symbols,
          },
          error,
        });
      }
    }

    try {
      const symbols = currencies
        .filter((currency) => currency !== baseCurrency)
        .join(",");
      const response = await fetch(
        `https://api.frankfurter.dev/v1/latest?base=${baseCurrency}&symbols=${symbols}`,
        { cache: "no-store" },
      );

      if (!response.ok) throw new Error(`FX ${response.status}`);

      const data = (await response.json()) as { rates?: CurrencyRates };
      if (data.rates) {
        setRates({ [baseCurrency]: 1, ...data.rates });
        window.localStorage.setItem(
          rateStorageKey,
          JSON.stringify({ date: today, rates: data.rates }),
        );
      }
    } catch (error) {
      logger.warn(loggerMessages.web.fxRatesFetchFailed, {
        attributes: {
          baseCurrency,
          symbols: currencies
            .filter((currency) => currency !== baseCurrency)
            .join(","),
        },
        error,
      });
    }
  }, []);

  React.useEffect(() => {
    void loadRates();
  }, [loadRates]);

  const refreshRates = React.useCallback(() => loadRates(true), [loadRates]);

  return { rates, refreshRates };
}

export function useFiltersOpen() {
  const [filtersOpen, setFiltersOpenState] = React.useState(true);

  React.useEffect(() => {
    const media = window.matchMedia(compactMediaQuery);
    const sync = () => {
      if (media.matches) {
        setFiltersOpenState(false);
        return;
      }

      setFiltersOpenState(
        window.localStorage.getItem(filtersClosedStorageKey) !== "1",
      );
    };

    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  const setFiltersOpen = React.useCallback((open: boolean) => {
    setFiltersOpenState(open);

    if (!window.matchMedia(compactMediaQuery).matches) {
      window.localStorage.setItem(filtersClosedStorageKey, open ? "0" : "1");
    }
  }, []);

  return [filtersOpen, setFiltersOpen] as const;
}
