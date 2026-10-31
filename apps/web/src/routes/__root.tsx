import { config } from "@fortawesome/fontawesome-svg-core";
import { loggerMessages } from "@package/logger";
import "@fortawesome/fontawesome-svg-core/styles.css";
import { formatTranslation } from "@pocket-trash/localizations";
import {
  createRootRoute,
  Outlet,
  Scripts,
  useRouterState,
} from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import type React from "react";
import { DocumentHead } from "@/components/document-head";
import { PageFooter } from "@/components/page-footer";
import { markHydrated } from "@/lib/hydration-marker";
import { logger } from "@/lib/logger";
import { themeStorageKey } from "@/lib/theme";
import type { ThemeBootstrapState } from "@/lib/theme-bootstrap";
import { resolveServerThemeBootstrap } from "@/lib/theme-bootstrap";
import {
  $uiPreferences,
  parseUiPreferences,
  type UiPreferences,
  uiPreferencesCookieName,
  uiPreferencesStorageKey,
} from "@/lib/ui-preferences";
import {
  getCurrentUserSettingsState,
  type UserSettingsState,
} from "@/lib/user-settings";
import { AppProviders } from "@/providers/app-providers";
import { LocaleProvider } from "@/providers/locale-provider";
import "../styles.css";

config.autoAddCss = false;

/**
 * Provides the shared document shell, settings bootstrap, providers, and application chrome.
 */
export const Route = createRootRoute({
  component: RootContent,
  /**
   * Loads optional user settings, theme bootstrap state, and the current copyright year.
   *
   * @returns Copyright year, optional settings state, and resolved theme bootstrap state.
   */
  loader: async () => {
    const settingsState = await getCurrentUserSettingsState().catch(
      async (error) => {
        try {
          if (import.meta.env.SSR) {
            const { s } = await import("@/lib/services");
            s.logger.warn(loggerMessages.web.userSettingsFetchFailed, {
              error,
            });
          } else {
            logger.warn(loggerMessages.web.userSettingsFetchFailed, { error });
          }
        } catch {
          // Optional settings and logging must never prevent first paint.
        }

        return null;
      },
    );

    return {
      copyrightYear: new Date().getFullYear(),
      settingsState,
      themeBootstrap: resolveServerThemeBootstrap(settingsState),
      uiPreferences: await readInitialUiPreferences(),
    };
  },
  /**
   * Builds document metadata for the application root route.
   *
   * @returns Metadata emitted for the route.
   */
  head: () => ({
    links: [
      {
        rel: "icon",
        href: "https://pocket-trash.b-cdn.net/assets/favicon/favicon.ico",
        sizes: "any",
      },
      {
        rel: "icon",
        type: "image/png",
        sizes: "16x16",
        href: "https://pocket-trash.b-cdn.net/assets/favicon/favicon-16x16.png",
      },
      {
        rel: "icon",
        type: "image/png",
        sizes: "32x32",
        href: "https://pocket-trash.b-cdn.net/assets/favicon/favicon-32x32.png",
      },
      {
        rel: "icon",
        type: "image/png",
        sizes: "192x192",
        href: "https://pocket-trash.b-cdn.net/assets/favicon/android-chrome-192x192.png",
      },
      {
        rel: "icon",
        type: "image/png",
        sizes: "512x512",
        href: "https://pocket-trash.b-cdn.net/assets/favicon/android-chrome-512x512.png",
      },
      {
        rel: "apple-touch-icon",
        href: "https://pocket-trash.b-cdn.net/assets/favicon/apple-touch-icon.png",
      },
    ],
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover",
      },
      {
        title: formatTranslation("web.site.name"),
      },
    ],
  }),
  shellComponent: RootDocument,
});

/**
 * Renders the HTML document shell around application content.
 *
 * @param props - Document shell properties.
 * @param props.children - Nested application content.
 * @returns The rendered route UI.
 */
function RootDocument({
  children,
}: {
  /**
   * Nested application content.
   */
  children?: React.ReactNode;
}) {
  const initialSettingsState = useRouterState({
    /** Selects optional settings without requiring a successful root loader.
     * @param state - Current Router matches.
     * @returns Root settings or the existing anonymous fallback. */
    select: (state) => {
      const data = state.matches.find((match) => match.routeId === "__root__")
        ?.loaderData as
        | {
            /** Optional authorized settings snapshot. */
            settingsState?: UserSettingsState | null;
          }
        | undefined;
      return data?.settingsState ?? null;
    },
  });
  return (
    <LocaleProvider initialSettingsState={initialSettingsState}>
      <html lang="en" suppressHydrationWarning>
        <head>
          <DocumentHead />
          <script
            dangerouslySetInnerHTML={{
              __html: bootstrapScript(
                { serverTheme: null, shouldUseServerTheme: false },
                null,
                null,
              ),
            }}
          />
        </head>
        <body ref={markHydrated}>
          <div className="root">{children}</div>
          <Scripts />
        </body>
      </html>
    </LocaleProvider>
  );
}

/**
 * Renders application providers, routed content, and the shared footer.
 *
 * @returns The rendered route UI.
 */
function RootContent() {
  const loaderData = Route.useLoaderData();
  const themeBootstrap = loaderData.themeBootstrap;

  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: bootstrapScript(
            themeBootstrap,
            loaderData.settingsState,
            loaderData.uiPreferences,
          ),
        }}
      />
      <AppProviders initialUiPreferences={loaderData.uiPreferences}>
        <div className="flex min-h-svh flex-col bg-background text-foreground">
          <div className="flex flex-1 flex-col">
            <Outlet />
          </div>
          <PageFooter year={loaderData.copyrightYear} />
        </div>
      </AppProviders>
    </>
  );
}

/**
 * Reads validated browser interface preferences for the current environment.
 *
 * @returns Cookie-backed preferences on the server and local preferences in the browser.
 */
const readInitialUiPreferences = createIsomorphicFn()
  .client(() => $uiPreferences.get())
  .server(async () => {
    const { getCookie } = await import("@tanstack/react-start/server");
    return parseUiPreferences(getCookie(uiPreferencesCookieName));
  });

/**
 * Builds the inline script that applies locale and theme state before hydration.
 *
 * @param themeBootstrap - Server-resolved theme bootstrap state.
 * @param settingsState - Resolved user settings, or `null` when unavailable.
 * @param uiPreferences - Cookie-backed interface preferences, or `null` before route data is available.
 * @returns Executable bootstrap source.
 */
function bootstrapScript(
  themeBootstrap: ThemeBootstrapState,
  settingsState: UserSettingsState | null,
  uiPreferences: UiPreferences | null,
) {
  return `
(() => {
  try {
    const serverTheme = ${JSON.stringify(themeBootstrap.serverTheme)};
    const shouldUseServerTheme = ${JSON.stringify(themeBootstrap.shouldUseServerTheme)};
    const serverLocale = ${JSON.stringify(settingsState?.settings.locale ?? null)};
    const theme = shouldUseServerTheme
      ? serverTheme
      : localStorage.getItem(${JSON.stringify(themeStorageKey)}) || "system";
    const dark = theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
    const storedLocale = localStorage.getItem("field-log.locale");
    const locale = serverLocale || (storedLocale === "en" || storedLocale === "en-US" ? "en-US" : storedLocale === "es-MX" ? "es-MX" : "en-US");
    document.documentElement.lang = locale;
    const uiPreferences = ${JSON.stringify(uiPreferences)};
    if (uiPreferences) localStorage.setItem(${JSON.stringify(uiPreferencesStorageKey)}, JSON.stringify(uiPreferences));
  } catch {}
})();
`;
}
