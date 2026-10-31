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
import { applyTheme, type ThemeMode } from "../src/lib/theme";
import type { UserSettingsState } from "../src/lib/user-settings";
import {
  AuthenticatedLocaleSync,
  LocaleProvider,
} from "../src/providers/locale-provider";
import { ThemeContext } from "../src/providers/theme-provider";
import { TooltipProvider } from "../src/providers/tooltip-provider";

/** Saved English-US settings shared by component stories. */
export const storySettings: UserSettingsState = {
  hasSavedSettings: true,
  settings: {
    currencyCode: "USD",
    isProfilePublic: false,
    locale: "en-US",
    measurementSystem: "metric",
    publishTrends: false,
    theme: "light",
  },
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
  initialSettingsState = storySettings,
}: {
  /** Optional server settings; null exercises the mocked account fetch. */
  initialSettingsState?: UserSettingsState | null;
  /** Story content. */
  children: React.ReactNode;
}) {
  return (
    <StoryRouter>
      <LocaleProvider initialSettingsState={initialSettingsState}>
        <AuthenticatedLocaleSync initialSettingsState={initialSettingsState} />
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
  const theme = React.useSyncExternalStore<ThemeMode>(
    subscribeStorybookTheme,
    currentStorybookTheme,
    () => "light",
  );

  const value = React.useMemo(
    () => ({
      saving: false,
      /**
       * Applies a new theme to Storybook and local context state.
       *
       * @param nextTheme - Theme selected by the story toolbar.
       */
      setTheme: (nextTheme: ThemeMode) => {
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

/**
 * Observes Storybook theme globals without owning application preference state.
 * @param notify - React subscription notification.
 * @returns Disposal of the document observer.
 */
function subscribeStorybookTheme(notify: () => void) {
  const observer = new MutationObserver(notify);
  observer.observe(document.documentElement, {
    attributeFilter: ["class"],
    attributes: true,
  });
  return () => observer.disconnect();
}
