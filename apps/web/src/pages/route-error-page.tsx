import { serializeError } from "@package/logger";
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
import { useRef } from "react";
import { type EffectEntity, useEffectReducer } from "use-effect-reducer";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { useClipboardCopy } from "@/hooks/use-clipboard-copy";
import type { UserSettingsState } from "@/lib/user-settings";
import { useOptionalLocale } from "@/providers/locale-provider";

/** Root loader data used to recover the saved locale. */
type RootLoaderData = {
  /** Current user settings, when the root loader resolved them. */
  settingsState?: UserSettingsState | null;
};

/**
 * Renders localized recovery UI for a failure reported by the router boundary.
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

/** Current recovery identity and invalidation observer. */
type RetryState = {
  /** Current boundary error. */
  error: unknown;

  /** Current route pathname. */
  pathname: string;

  /** Current retry observer. */
  request?: EffectEntity<RetryState, RetryEvent>;
};

/** Retry intent, boundary replacement, and terminal cleanup. */
type RetryEvent =
  | {
      /** Reconciles a replaced route or error. */
      type: "sourceChanged";
      /** Current boundary error. */
      error: unknown;
      /** Current pathname. */
      pathname: string;
    }
  | {
      /** Requests loader invalidation. */
      type: "requested";
    }
  | {
      /** Stops a settled retry. */
      type: "settled";
    };

/** Captured invalidation command. */
type RetryEffect = {
  /** Retry implementation. */
  type: "retry";

  /** Invalidates the current route.
   * @returns Loader refresh completion.
   * @rejects When route refresh fails. */
  execute: () => Promise<unknown>;
};

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
  /** Formats localized route-error copy.
   * @param key - Translation key.
   * @returns The localized message. */
  const t = (key: TranslationKey) => formatTranslation(key, {}, locale);
  const details = formatErrorDetails(pathname, error);
  const { status: copyStatus, copy: copyDetails } = useClipboardCopy(details);
  const task = useRef<{
    /** Captured retry whose invalidation must not replay. */
    effect: RetryEffect;

    /** Settled retry acknowledgement. */
    promise: Promise<void>;
  } | null>(null);
  const [state, dispatch] = useEffectReducer<
    RetryState,
    RetryEvent,
    RetryEffect
  >(
    (state, event, exec) => {
      if (event.type === "sourceChanged") {
        exec.stop(state.request);
        return { error: event.error, pathname: event.pathname };
      }
      if (event.type === "requested")
        return state.request
          ? state
          : { ...state, request: exec({ type: "retry", execute: onRetry }) };
      exec.stop(state.request);
      return { ...state, request: undefined };
    },
    { error, pathname },
    {
      /** Observes the current retry without replaying invalidation on resume.
       * @param _state - Current recovery identity.
       * @param effect - Captured retry command.
       * @param dispatch - Terminal dispatcher.
       * @param context - Current observer lifetime. */
      retry: (_state, effect, dispatch, { signal }) => {
        if (task.current?.effect !== effect)
          task.current = {
            effect,
            promise: (async () => {
              try {
                await effect.execute();
              } catch {
                /* A persistent failure keeps this boundary available for another retry. */
              }
            })(),
          };
        void task.current.promise.then(() => {
          if (!signal.aborted) dispatch({ type: "settled" });
        });
      },
    },
  );
  if (state.error !== error || state.pathname !== pathname)
    dispatch({ type: "sourceChanged", error, pathname });
  const retrying = Boolean(state.request);
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
              onClick={() => dispatch({ type: "requested" })}
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
