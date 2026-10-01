import { loggerMessages } from "@package/logger";
import { formatTranslation } from "@pocket-trash/localizations";
import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import type * as React from "react";
import { PageFooter } from "@/components/page-footer";
import { logger } from "@/lib/logger";
import { themeStorageKey } from "@/lib/theme";
import type { ThemeBootstrapState } from "@/lib/theme-bootstrap";
import { resolveServerThemeBootstrap } from "@/lib/theme-bootstrap";
import {
  getCurrentUserSettingsState,
  type UserSettingsState,
} from "@/lib/user-settings";
import { AppProviders } from "@/providers/app-providers";
import "../styles.css";

/**
 * Defines the application root route and shared document shell.
 */
export const Route = createRootRoute({
  component: RootContent,
  /**
   * Loads optional user settings, theme bootstrap state, and the current copyright year.
   *
   * @returns The route's loader data.
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
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script
          dangerouslySetInnerHTML={{
            __html: bootstrapScript(
              { serverTheme: null, shouldUseServerTheme: false },
              null,
            ),
          }}
        />
      </head>
      <body>
        <div className="root">{children}</div>
        <Scripts />
      </body>
    </html>
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
          __html: bootstrapScript(themeBootstrap, loaderData.settingsState),
        }}
      />
      <AppProviders initialSettingsState={loaderData.settingsState}>
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
 * Builds the inline script that applies locale and theme state before hydration.
 *
 * @param themeBootstrap - Server-resolved theme bootstrap state.
 * @param settingsState - Resolved user settings, or `null` when unavailable.
 * @returns Executable bootstrap source.
 */
function bootstrapScript(
  themeBootstrap: ThemeBootstrapState,
  settingsState: UserSettingsState | null,
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
  } catch {}
})();
`;
}
