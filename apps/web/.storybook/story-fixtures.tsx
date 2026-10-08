import { useAuth, useClerk, useUser } from "@clerk/tanstack-react-start";
import type { Role } from "@package/services/authorization";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
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

/** Saved English-US settings shared by component stories. */
export const storySettings: UserSettingsState = {
  hasSavedSettings: true,
  settings: {
    currencyCode: "USD",
    locale: "en-US",
    measurementSystem: "metric",
    theme: "light",
  },
};

/** First eight catalog products used by list stories. */
export const storyProducts = products.slice(0, 8);
/** First catalog product used as a deterministic fallback fixture. */
const firstProduct = products[0];
if (!firstProduct) {
  throw new Error("Storybook fixtures require at least one product.");
}

/** Catalog product with a gallery when available, otherwise the first product. */
export const storyProduct =
  products.find((product) => product.images_local.length > 1) ?? firstProduct;
/** Fixed CAD-based exchange rates used by price stories. */
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

/** Active material and refill filters used by catalog stories. */
export const storyActiveFilters: ActiveFilters = createEmptyFilters();
storyActiveFilters.materials.add("Titanium");
storyActiveFilters.refills.add("Pilot G2");
storyActiveFilters.refills.add("EnerGel");

/** Catalog match modes requiring every selected refill. */
export const storyMatchModes: MatchModes = {
  ...createDefaultMatchModes(),
  refills: "all",
};

/**
 * Configures Clerk story mocks for an anonymous visitor.
 */
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

/**
 * Configures Clerk story mocks for a signed-in user with a fixed identity.
 *
 * @param role - Authorization role exposed through the mocked session claims.
 */
export function mockStoryRole(role: Role) {
  mocked(useAuth).mockReturnValue({
    isLoaded: true,
    isSignedIn: true,
    sessionClaims: { role },
    userId: "story-user",
  } as unknown as ReturnType<typeof useAuth>);
  mocked(useUser).mockReturnValue({
    isLoaded: true,
    isSignedIn: true,
    user: {
      externalAccounts: [],
      imageUrl: "",
      primaryEmailAddress: { emailAddress: "story@example.com" },
      username: "Story User",
    },
  } as unknown as ReturnType<typeof useUser>);
  mocked(useClerk).mockReturnValue({
    signOut: fn(async () => undefined),
  } as unknown as ReturnType<typeof useClerk>);
}

/**
 * Wraps a story with router, locale, theme, and tooltip providers.
 *
 * @param props - Story content to render.
 * @returns Story content inside the standard provider stack.
 */
export function StoryProviders({
  children,
}: {
  /** Story content. */
  children: React.ReactNode;
}) {
  return (
    <StoryRouter>
      <LocaleProvider initialSettingsState={storySettings}>
        <StoryThemeProvider>
          <TooltipProvider>{children}</TooltipProvider>
        </StoryThemeProvider>
      </LocaleProvider>
    </StoryRouter>
  );
}

/**
 * Creates an isolated in-memory router for story content.
 *
 * @param props - Story content mounted at the root route.
 * @returns Story Router provider.
 */
function StoryRouter({
  children,
}: {
  /** Root route content. */
  children: React.ReactNode;
}) {
  const router = React.useMemo(
    () =>
      createRouter({
        history: createMemoryHistory({ initialEntries: ["/"] }),
        routeTree: createRootRoute({
          /**
           * Renders the supplied story at the root route.
           *
           * @returns Story content.
           */
          component: () => children,
        }),
      }),
    [children],
  );

  return <RouterProvider router={router as never} />;
}

/**
 * Reads Storybook's active theme from the document root.
 *
 * @returns Active light or dark theme.
 */
function currentStorybookTheme(): ThemeMode {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

/**
 * Synchronizes the application theme context with Storybook globals.
 *
 * @param props - Story content receiving theme context.
 * @returns Theme context provider around the story.
 */
function StoryThemeProvider({
  children,
}: {
  /** Story content. */
  children: React.ReactNode;
}) {
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
      /**
       * Applies a new theme to Storybook and local context state.
       *
       * @param nextTheme - Theme selected by the story toolbar.
       */
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
