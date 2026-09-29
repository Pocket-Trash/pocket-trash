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
import { Button } from "@/components/ui/button";
import { logger } from "@/lib/logger";
import type { UserSettingsState } from "@/lib/user-settings";
import { useOptionalLocale } from "@/providers/locale-provider";

type RootLoaderData = {
  settingsState?: UserSettingsState | null;
};

export function RouteErrorPage({ error }: ErrorComponentProps) {
  const router = useRouter();
  const activeLocale = useOptionalLocale();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const rootLocale = useRouterState({
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

export function resolveRouteErrorLocale(
  activeLocale: SupportedLocale | null,
  rootLocale: SupportedLocale | null,
): SupportedLocale {
  return activeLocale ?? rootLocale ?? DEFAULT_LOCALE;
}

export function RouteErrorView({
  development,
  error,
  locale,
  onRetry,
  pathname,
}: {
  development: boolean;
  error: unknown;
  locale: SupportedLocale;
  onRetry: () => Promise<unknown>;
  pathname: string;
}) {
  const [copyStatus, setCopyStatus] = React.useState<
    "copied" | "failed" | null
  >(null);
  const [retrying, setRetrying] = React.useState(false);
  const t = (key: TranslationKey) => formatTranslation(key, {}, locale);
  const details = formatErrorDetails(pathname, error);

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

  const copyDetails = async () => {
    try {
      await navigator.clipboard.writeText(details);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
  };

  return (
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
  );
}

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
