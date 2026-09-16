import { useAuth, useClerk, useUser } from "@clerk/tanstack-react-start";
import * as React from "react";
import { fn, mocked } from "storybook/test";
import { products } from "../src/lib/pen-data";
import type { ActiveFilters, MatchModes } from "../src/lib/pen-filters";
import {
  createDefaultMatchModes,
  createEmptyFilters,
} from "../src/lib/pen-filters";
import type { CurrencyRates } from "../src/lib/pen-formatters";
import { applyTheme, type ThemeMode } from "../src/lib/theme";
import type { UserSettingsState } from "../src/lib/user-settings";
import { LocaleProvider } from "../src/providers/locale-provider";
import { ThemeContext } from "../src/providers/theme-provider";
import { TooltipProvider } from "../src/providers/tooltip-provider";

export const storySettings: UserSettingsState = {
  hasSavedSettings: true,
  settings: {
    currencyCode: "USD",
    dimensionUnit: "in",
    locale: "en-US",
    theme: "light",
    weightUnit: "g",
  },
};

export const storyProducts = products.slice(0, 8);
const firstProduct = products[0];
if (!firstProduct) {
  throw new Error("Storybook fixtures require at least one product.");
}

export const storyProduct =
  products.find((product) => product.images_local.length > 1) ?? firstProduct;
export const storyRates: CurrencyRates = {
  AUD: 1.13,
  CAD: 1,
  CHF: 0.66,
  EUR: 0.68,
  GBP: 0.58,
  JPY: 109,
  NZD: 1.24,
  USD: 0.74,
};

export const storyActiveFilters: ActiveFilters = createEmptyFilters();
storyActiveFilters.materials.add("Titanium");
storyActiveFilters.refills.add("Pilot G2");
storyActiveFilters.refills.add("EnerGel");

export const storyMatchModes: MatchModes = {
  ...createDefaultMatchModes(),
  refills: "all",
};

export function mockStoryAuth() {
  mocked(useAuth).mockReturnValue({
    isLoaded: true,
    isSignedIn: false,
  } as ReturnType<typeof useAuth>);
  mocked(useUser).mockReturnValue({
    isLoaded: true,
    isSignedIn: false,
    user: null,
  } as ReturnType<typeof useUser>);
  mocked(useClerk).mockReturnValue({
    signOut: fn(async () => undefined),
  } as unknown as ReturnType<typeof useClerk>);
}

export function StoryProviders({ children }: { children: React.ReactNode }) {
  return (
    <LocaleProvider initialSettingsState={storySettings}>
      <StoryThemeProvider>
        <TooltipProvider>{children}</TooltipProvider>
      </StoryThemeProvider>
    </LocaleProvider>
  );
}

function currentStorybookTheme(): ThemeMode {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function StoryThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<ThemeMode>(
    currentStorybookTheme,
  );

  React.useEffect(() => {
    const observer = new MutationObserver(() => {
      setThemeState(currentStorybookTheme());
    });

    observer.observe(document.documentElement, {
      attributeFilter: ["class"],
      attributes: true,
    });

    return () => observer.disconnect();
  }, []);

  const value = React.useMemo(
    () => ({
      saving: false,
      setTheme: (nextTheme: ThemeMode) => {
        setThemeState(nextTheme);
        applyTheme(nextTheme);
      },
      theme,
    }),
    [theme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}
