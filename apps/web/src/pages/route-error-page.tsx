import { loggerMessages, serializeError } from "@package/logger";
import {
  DEFAULT_LOCALE,
  formatTranslation,
  type SupportedLocale,
  type TranslationKey,
} from "@pocket-trash/localizations";
import {
  type ErrorComponentProps,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import * as React from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { logger } from "@/lib/logger";
import type { UserSettingsState } from "@/lib/user-settings";
import { useOptionalLocale } from "@/providers/locale-provider";

/** Root loader data used to recover the saved locale. */
type RootLoaderData = {
  /** Current user settings, when the root loader resolved them. */
  settingsState?: UserSettingsState | null;
};

/**
 * Logs a route failure and renders its localized recovery UI.
 *
 * @param root0 - Router error-component properties.
 * @returns The route error boundary page.
 */
export function RouteErrorPage({ error }: ErrorComponentProps) {
  const router = useRouter();
  const activeLocale = useOptionalLocale();
  const pathname = useRouterState({
    /**
     * Selects the current route pathname.
     *
     * @param state - Router state.
     * @returns The active pathname.
     */
    select: (state) => state.location.pathname,
  });
  const rootLocale = useRouterState({
    /**
     * Selects the saved locale from root loader data.
     *
     * @param state - Router state.
     * @returns The saved locale, or `null` when unavailable.
     */
    select: (state) => {
      const rootData = state.matches.find(
        (match) => match.routeId === "__root__",
      )?.loaderData as RootLoaderData | undefined;
      return rootData?.settingsState?.settings.locale ?? null;
    },
  });

  React.useEffect(() => {
    logger.error(loggerMessages.web.routeError, {
      attributes: { route: pathname },
      error,
    });
  }, [error, pathname]);

  return (
    <RouteErrorView
      development={import.meta.env.DEV}
      error={error}
      locale={resolveRouteErrorLocale(activeLocale, rootLocale)}
      onRetry={() => router.invalidate()}
      pathname={pathname}
    />
  );
}

/**
 * Resolves the locale used when rendering a route error.
 *
 * @param activeLocale - Locale from the mounted provider.
 * @param rootLocale - Locale from root loader settings.
 * @returns The first available locale, falling back to the default locale.
 */
export function resolveRouteErrorLocale(
  activeLocale: SupportedLocale | null,
  rootLocale: SupportedLocale | null,
): SupportedLocale {
  return activeLocale ?? rootLocale ?? DEFAULT_LOCALE;
}

/**
 * Renders route-error recovery actions and optional development diagnostics.
 *
 * @param root0 - Error details and retry behavior.
 * @returns The route-error view.
 */
export function RouteErrorView({
  development,
  error,
  locale,
  onRetry,
  pathname,
}: {
  /** Whether technical diagnostics are visible. */
  development: boolean;
  /** Failure caught by the router boundary. */
  error: unknown;
  /** Locale used for recovery copy. */
  locale: SupportedLocale;
  /**
   * Invalidates the router to retry failed loaders and rendering.
   *
   * @returns The router invalidation result.
   */
  onRetry: () => Promise<unknown>;
  /** Failed route pathname. */
  pathname: string;
}) {
  const [copyStatus, setCopyStatus] = React.useState<
    "copied" | "failed" | null
  >(null);
  const [retrying, setRetrying] = React.useState(false);
  /**
   * Formats localized route-error copy.
   *
   * @param key - Translation key.
   * @returns The localized message.
   */
  const t = (key: TranslationKey) => formatTranslation(key, {}, locale);
  const details = formatErrorDetails(pathname, error);

  /** Retries the failed route while maintaining the busy state. */
  const retry = async () => {
    setRetrying(true);
    try {
      await onRetry();
    } catch {
      // A persistent failure leaves this boundary visible for another retry.
    } finally {
      setRetrying(false);
    }
  };

  /** Copies sanitized development diagnostics to the clipboard. */
  const copyDetails = async () => {
    try {
      await navigator.clipboard.writeText(details);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
  };

  return (
    <AppShell showControls={false} title={t("web.page.error.title")}>
      <main className="flex flex-1 items-center justify-center bg-background px-4 py-10 text-foreground">
        <section
          aria-labelledby="route-error-title"
          className="w-full max-w-xl rounded-lg border border-border bg-card px-6 py-8 text-card-foreground shadow-sm"
        >
          <h1
            className="text-2xl font-bold tracking-[0.5px]"
            id="route-error-title"
          >
            {t("web.page.error.title")}
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {t("web.page.error.description")}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button
              aria-busy={retrying}
              disabled={retrying}
              onClick={() => void retry()}
              type="button"
            >
              {t(retrying ? "web.page.error.retrying" : "web.page.error.retry")}
            </Button>
            <Button
              nativeButton={false}
              render={<a href="/" />}
              variant="outline"
            >
              {t("web.page.error.returnHome")}
            </Button>
          </div>
          {development ? (
            <details className="mt-6 border-t border-border pt-4">
              <summary className="cursor-pointer text-sm font-semibold focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
                {t("web.page.error.technicalDetails")}
              </summary>
              <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap text-xs leading-5 text-muted-foreground">
                {details}
              </pre>
              <div className="mt-3 flex items-center gap-3">
                <Button
                  onClick={() => void copyDetails()}
                  size="sm"
                  type="button"
                >
                  {t("web.page.error.copyDetails")}
                </Button>
                <span aria-live="polite" role="status">
                  {copyStatus === "copied"
                    ? t("web.page.error.copied")
                    : copyStatus === "failed"
                      ? t("web.page.error.copyFailed")
                      : null}
                </span>
              </div>
            </details>
          ) : null}
        </section>
      </main>
    </AppShell>
  );
}

/**
 * Serializes safe route diagnostics without query or hash values.
 *
 * @param pathname - Failed route location.
 * @param error - Failure caught by the route boundary.
 * @returns Pretty-printed diagnostic JSON.
 */
function formatErrorDetails(pathname: string, error: unknown) {
  const serialized = serializeError(error);
  return JSON.stringify(
    {
      pathname: pathname.split(/[?#]/, 1)[0] || "/",
      error: {
        name: serialized.name,
        message: serialized.message,
        stack: serialized.stack ?? "",
      },
    },
    null,
    2,
  );
}
