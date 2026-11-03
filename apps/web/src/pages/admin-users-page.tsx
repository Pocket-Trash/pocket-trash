import { useAuth } from "@clerk/tanstack-react-start";
import { faMagnifyingGlass, faUser } from "@fortawesome/pro-light-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  formatTranslation,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { useForm, useStore } from "@tanstack/react-form";
import { useRef } from "react";
import {
  type EffectEntity,
  type EffectFunction,
  useEffectReducer,
} from "use-effect-reducer";
import { AdminPageShell } from "@/components/admin-page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type AdminUserAccess,
  type AdminUserIdentity,
  getAdminUserAccess,
  searchAdminUsers,
  setAdminUserBanState,
} from "@/lib/user-bans";
import { useLocale } from "@/providers/locale-provider";

/** User-access administration result and current explicit operation. */
type UserAccessState = {
  /** Current explicit search results. */
  users: AdminUserIdentity[];
  /** Current loaded access identity. */
  selected: AdminUserAccess | null;
  /** Existing operation feedback. */
  status: string | null;
  /** Monotonic search/selection/save lifetime. */
  revision: number;
  /** Current asynchronous operation. */
  request: EffectEntity<UserAccessState, UserAccessEvent> | undefined;
};
/** Current user-access action intent. */
type UserAccessEvent =
  | {
      /** Searches a submitted query. */
      type: "searchRequested";
      /** Captured search query. */
      query: string;
    }
  | {
      /** Loads durable access for a selected identity. */
      type: "selectionRequested";
      /** Selected Clerk identity. */
      user: AdminUserIdentity;
    }
  | {
      /** Saves a validated ban/reason change. */
      type: "banRequested";
      /** Desired ban state. */
      banned: boolean;
      /** Existing required staff reason. */
      reason: string;
    }
  | {
      /** Stops and applies one current operation result. */
      type: "finished";
      /** Operation lifetime that completed. */
      revision: number;
      /** Current search, access, and feedback result. */
      outcome: UserAccessOutcome;
    };
/** Captured user-access service operation. */
type UserAccessEffect = {
  /** Current operation lifetime. */
  revision: number;
} & (
  | {
      /** Explicit search implementation. */
      type: "search";
      /** Submitted query. */
      query: string;
    }
  | {
      /** Selected-user lookup implementation. */
      type: "select";
      /** Selected Clerk identity. */
      user: AdminUserIdentity;
    }
  | {
      /** Confirmed ban-state implementation. */
      type: "saveBan";
      /** Target access state captured at confirmation. */
      selected: AdminUserAccess;
      /** Desired ban state. */
      banned: boolean;
      /** Existing required staff reason. */
      reason: string;
    }
);
/** Retained service result without observer side effects. */
type UserAccessOutcome = {
  /** Fresh explicit search results. */
  users?: AdminUserIdentity[];
  /** Canonical access result for the selected identity. */
  selected?: AdminUserAccess;
  /** Existing feedback after completion or failure. */
  status?: string;
};

/**
 * Renders user search and administrator ban controls.
 *
 * @returns User-access administration page.
 */
export function AdminUsersPage() {
  const { userId } = useAuth();
  return <AdminUsersContent key={userId} />;
}

/**
 * Owns one administrator's explicit searches, selected access, and reason form.
 * @returns Scoped user-access administration.
 */
function AdminUsersContent() {
  const { locale } = useLocale();
  /**
   * Formats localized copy for the active locale.
   *
   * @param key - Localization key.
   * @returns Localized copy.
   */
  const t = (key: TranslationKey) => formatTranslation(key, {}, locale);
  const searchForm = useForm({
    defaultValues: { query: "" },
    /**
     * Captures an explicit submitted user search.
     * @param input - Current search field.
     */
    onSubmit: ({ value }) => {
      dispatch({ type: "searchRequested", query: value.query });
    },
  });
  const query = useStore(searchForm.store, (state) => state.values.query);
  const reasonForm = useForm({
    defaultValues: { reason: "" },
    onSubmitMeta: { banned: false },
    validators: {
      /**
       * Preserves the required nonblank staff reason before a ban mutation.
       * @param input - Current staff reason.
       * @returns Existing localized required-reason feedback.
       */
      onSubmit: ({ value }): string | undefined =>
        value.reason.trim()
          ? undefined
          : t("web.resources.moderation.reasonRequired"),
    },
    /**
     * Captures one validated ban/reason intent for the current selected identity.
     * @param input - Current reason and desired ban state.
     */
    onSubmit: ({ value, meta }) => {
      dispatch({
        type: "banRequested",
        banned: meta.banned,
        reason: value.reason,
      });
    },
  });
  const reason = useStore(reasonForm.store, (state) => state.values.reason);
  const reasonError = useStore(
    reasonForm.store,
    (state) => state.errorMap.onSubmit,
  );
  const task = useRef<{
    /** Descriptor whose service operation must not replay. */
    effect: UserAccessEffect;
    /** Durable service result retained during suspension. */
    promise: Promise<UserAccessOutcome>;
  } | null>(null);
  /**
   * Observes a captured access operation only through its current account/selection lifetime.
   * @param _state - Current selected identity and results.
   * @param effect - Captured query, lookup, or confirmed ban request.
   * @param dispatch - Terminal dispatcher.
   * @param context - Current observer lifetime.
   */
  const execute: EffectFunction<
    UserAccessState,
    UserAccessEvent,
    UserAccessEffect
  > = (_state, effect, dispatch, { signal }) => {
    if (effect.type !== "saveBan" || task.current?.effect !== effect)
      task.current = {
        effect,
        promise: (async (): Promise<UserAccessOutcome> => {
          try {
            if (effect.type === "search")
              return {
                users: await searchAdminUsers({
                  data: { query: effect.query },
                  signal,
                }),
              };
            if (effect.type === "select")
              return {
                selected: await getAdminUserAccess({
                  data: { targetClerkId: effect.user.clerkId },
                  signal,
                }),
              };
            const banState = await setAdminUserBanState({
              data: {
                banned: effect.banned,
                reason: effect.reason,
                targetClerkId: effect.selected.user.clerkId,
              },
            });
            return {
              selected: {
                banState,
                user: {
                  ...effect.selected.user,
                  banned: banState.status === "banned",
                },
              },
              status: t("web.admin.users.updated"),
            };
          } catch (error) {
            return {
              status:
                error instanceof Error ? error.message : t("error.generic"),
            };
          }
        })(),
      };
    void task.current.promise.then((outcome) => {
      if (signal.aborted) return;
      dispatch({ type: "finished", revision: effect.revision, outcome });
      if (
        outcome.selected &&
        (effect.type !== "saveBan" ||
          reasonForm.state.values.reason === effect.reason)
      )
        reasonForm.setFieldValue(
          "reason",
          outcome.selected.banState?.reason ?? "",
        );
    });
  };
  const [state, dispatch] = useEffectReducer<
    UserAccessState,
    UserAccessEvent,
    UserAccessEffect
  >(
    (state, event, exec) => {
      if (event.type === "finished") {
        if (event.revision !== state.revision || !state.request) return state;
        exec.stop(state.request);
        return {
          ...state,
          request: undefined,
          users: event.outcome.users ?? state.users,
          selected: event.outcome.selected ?? state.selected,
          status: event.outcome.status ?? null,
        };
      }
      const revision = state.revision + 1;
      if (event.type === "banRequested")
        return !state.selected || state.request
          ? state
          : {
              ...state,
              revision,
              status: null,
              request: exec({
                type: "saveBan",
                revision,
                selected: state.selected,
                banned: event.banned,
                reason: event.reason,
              }),
            };
      const request =
        event.type === "searchRequested"
          ? exec.replace(state.request, {
              type: "search",
              revision,
              query: event.query,
            })
          : exec.replace(state.request, {
              type: "select",
              revision,
              user: event.user,
            });
      return { ...state, request, revision, status: null, selected: null };
    },
    {
      users: [],
      selected: null,
      status: null,
      revision: 0,
      request: undefined,
    },
    { search: execute, select: execute, saveBan: execute },
  );
  const { users, selected } = state;
  const busy = Boolean(state.request);
  const status = reasonError || state.status;
  /**
   * Validates a staff reason before the current identity's requested ban change.
   * @param banned - Desired completed ban state.
   */
  function save(banned: boolean) {
    if (busy || !selected) return;
    reasonForm.setErrorMap({ onSubmit: undefined });
    void reasonForm.handleSubmit({ banned });
  }
  const pendingStatus = selected?.banState?.status.startsWith("pending_")
    ? selected.banState.status
    : null;
  const currentStatus = selected
    ? (pendingStatus ?? (selected.user.banned ? "banned" : "unbanned"))
    : null;
  const statusLabel = currentStatus
    ? t(
        {
          banned: "web.admin.users.banned",
          pending_ban: "web.admin.users.pendingBan",
          pending_unban: "web.admin.users.pendingUnban",
          unbanned: "web.admin.users.active",
        }[currentStatus] as TranslationKey,
      )
    : null;

  return (
    <AdminPageShell section="users" title={t("web.admin.users.title")}>
      <main className="grid w-full max-w-5xl gap-5 p-4 md:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)] md:p-6">
        <section aria-labelledby="user-search-title" className="grid gap-4">
          <div>
            <h2 className="m-0 text-base font-semibold" id="user-search-title">
              {t("web.admin.users.title")}
            </h2>
            <p className="m-0 mt-1 text-sm text-muted-foreground">
              {t("web.admin.users.description")}
            </p>
          </div>
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              reasonForm.setErrorMap({ onSubmit: undefined });
              void searchForm.handleSubmit();
            }}
          >
            <label className="sr-only" htmlFor="admin-user-search">
              {t("web.admin.featureFlags.emailUsernameOrName")}
            </label>
            <Input
              id="admin-user-search"
              onChange={(event) =>
                searchForm.setFieldValue("query", event.target.value)
              }
              placeholder={t("web.admin.featureFlags.emailUsernameOrName")}
              required
              value={query}
            />
            <Button disabled={busy} type="submit" variant="outline">
              <FontAwesomeIcon aria-hidden="true" icon={faMagnifyingGlass} />
              {t("web.action.search")}
            </Button>
          </form>
          <div className="grid gap-2">
            {users.map((user) => (
              <Button
                className="h-auto min-h-11 justify-start px-3 py-2"
                disabled={busy}
                key={user.clerkId}
                onClick={() => {
                  reasonForm.setErrorMap({ onSubmit: undefined });
                  dispatch({ type: "selectionRequested", user });
                }}
                type="button"
                variant="outline"
              >
                <FontAwesomeIcon aria-hidden="true" icon={faUser} />
                <span className="min-w-0 text-left">
                  <span className="block truncate">{user.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {user.email ?? user.username ?? user.clerkId}
                  </span>
                </span>
              </Button>
            ))}
            {query && !busy && users.length === 0 ? (
              <p className="m-0 text-sm text-muted-foreground">
                {t("web.admin.users.noResults")}
              </p>
            ) : null}
          </div>
        </section>

        {selected && currentStatus ? (
          <section
            aria-labelledby="selected-user-title"
            className="grid content-start gap-4 rounded-lg border border-border bg-card p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2
                  className="m-0 truncate text-base font-semibold"
                  id="selected-user-title"
                >
                  {selected.user.name}
                </h2>
                <p className="m-0 truncate text-xs text-muted-foreground">
                  {selected.user.email ?? selected.user.clerkId}
                </p>
              </div>
              <Badge
                variant={currentStatus === "banned" ? "destructive" : "outline"}
              >
                {statusLabel}
              </Badge>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="ban-reason">
                {t("web.admin.audit.reason")}
              </label>
              <textarea
                className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                id="ban-reason"
                maxLength={1000}
                onChange={(event) =>
                  reasonForm.setFieldValue("reason", event.target.value)
                }
                placeholder={t("web.admin.users.reasonPlaceholder")}
                required
                value={reason}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {currentStatus === "unbanned" ? (
                <Button
                  disabled={busy}
                  onClick={() => save(true)}
                  type="button"
                >
                  {t("web.admin.users.ban")}
                </Button>
              ) : null}
              {currentStatus === "banned" ? (
                <>
                  <Button
                    disabled={busy}
                    onClick={() => save(true)}
                    type="button"
                  >
                    {t("web.admin.users.updateReason")}
                  </Button>
                  <Button
                    disabled={busy}
                    onClick={() => save(false)}
                    type="button"
                    variant="outline"
                  >
                    {t("web.admin.users.unban")}
                  </Button>
                </>
              ) : null}
              {currentStatus === "pending_ban" ||
              currentStatus === "pending_unban" ? (
                <Button
                  disabled={busy}
                  onClick={() => save(currentStatus === "pending_ban")}
                  type="button"
                >
                  {t("web.page.error.retry")}
                </Button>
              ) : null}
            </div>
          </section>
        ) : null}
        <p
          aria-live="polite"
          className="m-0 text-sm md:col-span-2"
          role="status"
        >
          {status}
        </p>
      </main>
    </AdminPageShell>
  );
}
