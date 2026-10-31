import { useReverification, useUser } from "@clerk/tanstack-react-start";
import {
  formatTranslation,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { useRef } from "react";
import { type EffectEntity, useEffectReducer } from "use-effect-reducer";
import { AdminPageShell } from "@/components/admin-page-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocale } from "@/providers/locale-provider";

/** Root URL containing Pocket Trash integration logos. */
const logoRoot = "https://cdn.pocket-trash.app/assets/static/logos";

/** Confirmed integration action owned by the current account. */
type ConnectionAction = "connect" | "remove" | "update";
/** Pending action and existing failure feedback. */
type ConnectionState = {
  /** Current integration mutation. */
  request: EffectEntity<ConnectionState, ConnectionEvent> | undefined;
  /** Whether the most recent action failed. */
  failed: boolean;
};
/** Explicit connection intent and terminal feedback. */
type ConnectionEvent =
  | {
      /** Requests an integration action. */
      type: "requested";
      /** Existing integration operation. */
      action: ConnectionAction;
    }
  | {
      /** Stops the completed action. */
      type: "finished";
      /** Whether Clerk completed the action. */
      success: boolean;
    };
/** Captured integration action; reverification remains Clerk-owned. */
type ConnectionEffect = {
  /** Action implementation. */
  type: "connect";
  /** Existing integration operation. */
  action: ConnectionAction;
};

/** Renders administrator integration settings for the current Clerk user.
 *
 * @returns The administrator settings page.
 */
export function AdminSettingsPage() {
  const { user } = useUser();
  return <AdminSettingsContent key={user?.id} />;
}

/**
 * Owns one administrator's integration action lifetime.
 * @returns Integration controls for the current Clerk user.
 */
function AdminSettingsContent() {
  const { isLoaded, user } = useUser();
  const { locale } = useLocale();
  /** Formats integration copy for the active locale.
   *
   * @param key - Translation key to format.
   * @param values - Values interpolated into the translation.
   * @returns Localized integration copy.
   */
  const t = (key: TranslationKey, values: Record<string, string> = {}) =>
    formatTranslation(key, values, locale);
  const linear = user?.externalAccounts.find(
    ({ provider }) => provider === "linear",
  );
  const hasWriteAccess = linear?.approvedScopes
    .split(/[\s,]+/)
    .includes("write");
  const updateConnection = useReverification(
    async (action: "connect" | "remove" | "update") => {
      if (!user) return;
      if (action === "connect") {
        await user.createExternalAccount({
          additionalScopes: ["write"],
          redirectUrl: "/admin/settings",
          strategy: "oauth_linear",
        });
      } else if (action === "update") {
        await linear?.reauthorize({
          additionalScopes: ["write"],
          redirectUrl: "/admin/settings",
        });
      } else {
        await linear?.destroy();
        await user.reload();
      }
    },
  );

  const task = useRef<{
    /** Descriptor whose Clerk mutation must not replay. */
    effect: ConnectionEffect;
    /** Action completion retained across suspension. */
    promise: Promise<boolean>;
  } | null>(null);
  const [state, dispatch] = useEffectReducer<
    ConnectionState,
    ConnectionEvent,
    ConnectionEffect
  >(
    (state, event, exec) => {
      if (event.type === "requested")
        return state.request
          ? state
          : {
              request: exec({ type: "connect", action: event.action }),
              failed: false,
            };
      exec.stop(state.request);
      return { request: undefined, failed: !event.success };
    },
    { request: undefined, failed: false },
    {
      /**
       * Observes one reverification action through its current account lifetime.
       * @param _state - Current integration control state.
       * @param effect - Captured integration action.
       * @param dispatch - Terminal dispatcher.
       * @param context - Current observer lifetime.
       */
      connect: (_state, effect, dispatch, { signal }) => {
        if (task.current?.effect !== effect)
          task.current = {
            effect,
            promise: Promise.resolve()
              .then(() => updateConnection(effect.action))
              .then(
                () => true,
                () => false,
              ),
          };
        void task.current.promise.then((success) => {
          if (!signal.aborted) dispatch({ type: "finished", success });
        });
      },
    },
  );
  const busy = Boolean(state.request);
  const { failed } = state;

  return (
    <AdminPageShell
      breadcrumbItems={[{ label: t("web.navigation.admin"), to: "/admin" }]}
      title={t("web.admin.settings.title")}
    >
      <main className="grid w-full max-w-3xl gap-6 px-4 py-6 md:px-6">
        {!isLoaded ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <section className="grid gap-4 rounded-lg border border-border bg-card p-5 text-card-foreground shadow-sm">
            <div className="flex items-center gap-3">
              {linear ? (
                <>
                  <img
                    alt=""
                    aria-hidden="true"
                    className="size-8 dark:hidden"
                    src={`${logoRoot}/linear-dark-logo.svg`}
                  />
                  <img
                    alt=""
                    aria-hidden="true"
                    className="hidden size-8 dark:block"
                    src={`${logoRoot}/linear-light-logo.svg`}
                  />
                </>
              ) : (
                <img
                  alt=""
                  aria-hidden="true"
                  className="size-8"
                  src={`${logoRoot}/linear-logo.svg`}
                />
              )}
              <div className="grid gap-1">
                <h2 className="m-0 text-lg font-semibold">
                  {t("web.admin.settings.linear.title")}
                </h2>
                <p className="m-0 text-sm text-muted-foreground">
                  {linear
                    ? t("web.admin.settings.linear.connectedAs", {
                        name: linear.accountIdentifier(),
                      })
                    : t("web.admin.settings.linear.description")}
                </p>
              </div>
            </div>
            {linear && !hasWriteAccess ? (
              <p className="m-0 text-sm text-destructive">
                {t("web.admin.settings.linear.needsUpdate")}
              </p>
            ) : null}
            {failed ? (
              <p className="m-0 text-sm text-destructive" role="alert">
                {t("web.admin.settings.linear.actionFailed")}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {linear ? (
                <>
                  <Button
                    disabled={busy}
                    onClick={() =>
                      dispatch({ type: "requested", action: "update" })
                    }
                    type="button"
                  >
                    {t("web.admin.settings.linear.update")}
                  </Button>
                  <Button
                    disabled={busy}
                    onClick={() =>
                      dispatch({ type: "requested", action: "remove" })
                    }
                    type="button"
                    variant="outline"
                  >
                    {t("web.admin.settings.linear.remove")}
                  </Button>
                </>
              ) : (
                <Button
                  disabled={busy}
                  onClick={() =>
                    dispatch({ type: "requested", action: "connect" })
                  }
                  type="button"
                >
                  {t("web.admin.settings.linear.connect")}
                </Button>
              )}
            </div>
          </section>
        )}
      </main>
    </AdminPageShell>
  );
}
