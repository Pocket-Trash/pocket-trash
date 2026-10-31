import { useAuth } from "@clerk/tanstack-react-start";
import {
  faBoxArchive,
  faCheck,
  faMagnifyingGlass,
  faShield,
  faSlidersSimple,
  faToggleOff,
} from "@fortawesome/pro-light-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { FeatureFlagAudience } from "@package/feature-flags";
import {
  formatTranslation,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { useForm, useStore } from "@tanstack/react-form";
import { type EffectEntity, useEffectReducer } from "use-effect-reducer";
import { AdminPageShell } from "@/components/admin-page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type FeatureFlagDraft,
  useFeatureFlagMutation,
} from "@/hooks/use-feature-flag-mutation";
import type { ClerkUserSearchResult } from "@/lib/feature-flags";
import {
  type listAdminFeatureFlags,
  listAdminTargetingForUser,
  searchFeatureFlagUsers,
} from "@/lib/feature-flags";
import { useLocale } from "@/providers/locale-provider";

/** A feature flag managed by an administrator. */
type AdminFlag = Awaited<ReturnType<typeof listAdminFeatureFlags>>[number];

/** A feature flag and its resolved state for a selected user. */
type TargetFlag = Awaited<ReturnType<typeof listAdminTargetingForUser>>[number];

/** Audiences available when creating a feature flag. */
const audiences: FeatureFlagAudience[] = ["global", "admin", "user"];

/** Flag edit selection and explicit administrator user search. */
type FlagAdminState = {
  /** Selected stable flag identity, or create mode. */
  editingSlug: string | null;
  /** Current explicit user search results. */
  users: ClerkUserSearchResult[];
  /** Current targeting identity. */
  selectedUser: ClerkUserSearchResult | null;
  /** Monotonic search/selection lifetime. */
  revision: number;
  /** Pending explicit user search. */
  search: EffectEntity<FlagAdminState, FlagAdminEvent> | undefined;
  /** Existing search failure feedback. */
  error: string | null;
};
/** Explicit flag editing and user-target selection/search intent. */
type FlagAdminEvent =
  | {
      /** Selects a stable flag identity or create mode. */
      type: "editingSelected";
      /** Current stable flag identity. */
      slug: string | null;
    }
  | {
      /** Requests one explicit user search. */
      type: "searchRequested";
      /** Submitted search query. */
      query: string;
    }
  | {
      /** Selects a targeting identity and disposes older searches. */
      type: "userSelected";
      /** Current selected identity. */
      user: ClerkUserSearchResult;
    }
  | {
      /** Stops a completed current search. */
      type: "searchFinished";
      /** Request lifetime that completed. */
      revision: number;
      /** Current matching users. */
      users?: ClerkUserSearchResult[];
      /** Existing failure feedback. */
      error?: string;
    };
/** Captured administrator user search. */
type FlagUserSearchEffect = {
  /** Search implementation. */
  type: "search";
  /** Submitted query. */
  query: string;
  /** Current request lifetime. */
  revision: number;
};
/** Selected-user targeting data and current reload lifetime. */
type FlagTargetState = {
  /** Canonical targeting for this selected user only. */
  flags: TargetFlag[];
  /** Current selected-user targeting lookup. */
  request: EffectEntity<FlagTargetState, FlagTargetEvent> | undefined;
  /** Existing lookup failure feedback. */
  error: string | null;
};
/** Selected-user targeting refresh and terminal cleanup. */
type FlagTargetEvent =
  | {
      /** Reloads current targeting after a confirmed mutation. */
      type: "reloadRequested";
    }
  | {
      /** Stops a current targeting lookup. */
      type: "loaded";
      /** Canonical current-user targeting. */
      flags?: TargetFlag[];
      /** Existing failure feedback. */
      error?: string;
    };
/** Captured selected-user targeting lookup. */
type FlagTargetEffect = {
  /** Lookup implementation. */
  type: "load";
};

/**
 * Renders feature flag management and user targeting controls.
 *
 * @param props - Current route-owned flag snapshot.
 * @returns The admin feature flags page.
 */
export function AdminFeatureFlagsPage({
  initialFlags = [],
  actorId,
}: {
  /** Current flags supplied by the authorized route loader. */
  initialFlags?: AdminFlag[];
  /** Account that authorized this exact loader snapshot. */
  actorId?: string;
}) {
  const { userId } = useAuth();
  return (
    <FeatureFlagsContent
      key={userId}
      flags={actorId === undefined || actorId === userId ? initialFlags : []}
    />
  );
}

/**
 * Owns one administrator's flag draft and selected targeting identity.
 * @param props - Current authorized route flags.
 * @returns Account-scoped flag administration.
 */
function FeatureFlagsContent({
  flags,
}: {
  /** Current canonical flag list. */
  flags: AdminFlag[];
}) {
  const { locale } = useLocale();
  /**
   * Formats localized feature flag copy.
   *
   * @param key - Localization key.
   * @returns The formatted translation.
   */
  const t = (key: TranslationKey) => formatTranslation(key, {}, locale);
  const flagForm = useForm({
    defaultValues: {
      audience: "user",
      defaultEnabled: false,
      description: "",
      name: "",
      slug: "",
    } as FeatureFlagDraft,
    /**
     * Captures the existing create/update contract without clearing failed drafts.
     * @param input - Current flag authoring fields.
     */
    onSubmit: ({ value }) => {
      if (!mutation.pending)
        mutation.mutate({
          kind: state.editingSlug ? "update" : "create",
          value,
        });
    },
  });
  const fields = useStore(flagForm.store, (state) => state.values);
  const searchForm = useForm({
    defaultValues: { query: "" },
    /**
     * Captures one explicit selected-user search.
     * @param input - Current search field.
     */
    onSubmit: ({ value }) => {
      dispatch({ type: "searchRequested", query: value.query });
    },
  });
  const query = useStore(searchForm.store, (state) => state.values.query);
  const [state, dispatch] = useEffectReducer<
    FlagAdminState,
    FlagAdminEvent,
    FlagUserSearchEffect
  >(
    (state, event, exec) => {
      if (event.type === "editingSelected")
        return { ...state, editingSlug: event.slug };
      if (event.type === "userSelected") {
        exec.stop(state.search);
        return {
          ...state,
          search: undefined,
          selectedUser: event.user,
          revision: state.revision + 1,
          error: null,
        };
      }
      if (event.type === "searchRequested") {
        const revision = state.revision + 1;
        return {
          ...state,
          selectedUser: null,
          revision,
          error: null,
          search: exec.replace(state.search, {
            type: "search",
            query: event.query,
            revision,
          }),
        };
      }
      if (event.revision !== state.revision || !state.search) return state;
      exec.stop(state.search);
      return {
        ...state,
        search: undefined,
        error: event.error ?? null,
        users: event.users ?? state.users,
      };
    },
    {
      editingSlug: null,
      users: [],
      selectedUser: null,
      revision: 0,
      search: undefined,
      error: null,
    },
    {
      /**
       * Loads explicit search results only into their current account/search scope.
       * @param _state - Current administrator controls.
       * @param effect - Captured query and lifetime.
       * @param dispatch - Terminal dispatcher.
       * @param context - Current observer lifetime.
       */
      search: (_state, effect, dispatch, { signal }) => {
        void searchFeatureFlagUsers({
          data: { query: effect.query },
          signal,
        }).then(
          (users) => {
            if (!signal.aborted)
              dispatch({
                type: "searchFinished",
                revision: effect.revision,
                users,
              });
          },
          (error: unknown) => {
            if (!signal.aborted)
              dispatch({
                type: "searchFinished",
                revision: effect.revision,
                error:
                  error instanceof Error
                    ? error.message
                    : t("web.status.failedToLoad"),
              });
          },
        );
      },
    },
  );
  const mutation = useFeatureFlagMutation(
    (operation) => {
      if (operation.kind === "create" || operation.kind === "update") {
        flagForm.reset();
        dispatch({ type: "editingSelected", slug: null });
      }
    },
    (operation) => {
      if (operation.kind === "create")
        dispatch({ type: "editingSelected", slug: operation.value.slug });
    },
  );
  const { editingSlug, users, selectedUser } = state;
  const status = mutation.error || state.error;

  return (
    <AdminPageShell title={t("web.admin.featureFlags.featureFlags")}>
      <main className="grid w-full max-w-6xl gap-5 px-4 py-6 md:grid-cols-[minmax(0,1fr)_360px] md:px-6">
        <section className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="m-0 text-base font-semibold">
                {t("web.admin.featureFlags.flags")}
              </h2>
              <p className="m-0 text-sm text-muted-foreground">
                {t("web.admin.featureFlags.booleanControls")}
              </p>
            </div>
            {status ? (
              <Badge className="bg-destructive text-destructive-foreground">
                {status}
              </Badge>
            ) : null}
          </div>
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="grid grid-cols-[1fr_auto_auto] gap-3 border-b border-border px-3 py-2 text-xs font-semibold text-muted-foreground uppercase">
              <span>{t("web.admin.featureFlags.flag")}</span>
              <span>{t("web.admin.featureFlags.audience")}</span>
              <span>{t("web.admin.featureFlags.actions")}</span>
            </div>
            {flags.map((flag) => (
              <div
                className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-border px-3 py-3 last:border-b-0"
                key={flag.slug}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{flag.name}</span>
                    {flag.archivedAt ? (
                      <Badge variant="outline">
                        {t("web.archive.state.archived")}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="mt-1 truncate font-mono text-xs text-muted-foreground">
                    {flag.slug}
                  </div>
                  {flag.description ? (
                    <p className="m-0 mt-1 text-sm text-muted-foreground">
                      {flag.description}
                    </p>
                  ) : null}
                </div>
                <Badge
                  variant={flag.audience === "admin" ? "default" : "secondary"}
                >
                  {flag.audience}
                </Badge>
                <div className="flex items-center gap-2">
                  <Button
                    aria-label={`${t("web.action.edit")} ${flag.slug}`}
                    disabled={mutation.pending}
                    onClick={() => {
                      if (mutation.pending) return;
                      dispatch({ type: "editingSelected", slug: flag.slug });
                      flagForm.reset(
                        {
                          audience: flag.audience,
                          defaultEnabled: flag.defaultEnabled,
                          description: flag.description ?? "",
                          name: flag.name,
                          slug: flag.slug,
                        },
                        { keepDefaultValues: true },
                      );
                    }}
                    size="icon"
                    type="button"
                    variant="outline"
                  >
                    <FontAwesomeIcon
                      aria-hidden="true"
                      icon={faSlidersSimple}
                    />
                  </Button>
                  <Button
                    aria-label={`${t("web.action.archive")} ${flag.slug}`}
                    disabled={mutation.pending || Boolean(flag.archivedAt)}
                    onClick={() =>
                      mutation.mutate({ kind: "archive", slug: flag.slug })
                    }
                    size="icon"
                    type="button"
                    variant="outline"
                  >
                    <FontAwesomeIcon aria-hidden="true" icon={faBoxArchive} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <aside className="grid content-start gap-5">
          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="m-0 mb-3 text-sm font-semibold">
              {editingSlug
                ? t("web.admin.featureFlags.editFlag")
                : t("web.admin.featureFlags.newFlag")}
            </h2>
            <div className="grid gap-3">
              <Input
                disabled={mutation.pending || Boolean(editingSlug)}
                onChange={(event) =>
                  flagForm.setFieldValue("slug", event.target.value)
                }
                aria-label={t("web.admin.featureFlags.slugPlaceholder")}
                placeholder={t("web.admin.featureFlags.slugPlaceholder")}
                value={fields.slug}
              />
              <Input
                disabled={mutation.pending}
                onChange={(event) =>
                  flagForm.setFieldValue("name", event.target.value)
                }
                aria-label={t("web.admin.featureFlags.displayName")}
                placeholder={t("web.admin.featureFlags.displayName")}
                value={fields.name}
              />
              <Input
                disabled={mutation.pending}
                onChange={(event) =>
                  flagForm.setFieldValue("description", event.target.value)
                }
                aria-label={t("web.admin.featureFlags.description")}
                placeholder={t("web.admin.featureFlags.description")}
                value={fields.description}
              />
              <Select
                disabled={mutation.pending || Boolean(editingSlug)}
                items={audiences.map((audience) => ({
                  label: audience,
                  value: audience,
                }))}
                onValueChange={(audience) =>
                  flagForm.setFieldValue(
                    "audience",
                    audience as FeatureFlagAudience,
                  )
                }
                value={fields.audience}
              >
                <SelectTrigger
                  aria-label={t("web.admin.featureFlags.audience")}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {audiences.map((audience) => (
                    <SelectItem key={audience} value={audience}>
                      {audience}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <label className="flex items-center gap-2 text-sm">
                <input
                  checked={fields.defaultEnabled}
                  disabled={mutation.pending || fields.audience !== "global"}
                  onChange={(event) =>
                    flagForm.setFieldValue(
                      "defaultEnabled",
                      event.target.checked,
                    )
                  }
                  type="checkbox"
                />
                {t("web.admin.featureFlags.globalDefaultEnabled")}
              </label>
              <Button
                disabled={mutation.pending}
                onClick={() => void flagForm.handleSubmit()}
                type="button"
              >
                <FontAwesomeIcon aria-hidden="true" icon={faCheck} />
                {t("web.action.saveFlag")}
              </Button>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="m-0 mb-3 text-sm font-semibold">
              {t("web.admin.featureFlags.adminOnlyTargeting")}
            </h2>
            <div className="flex gap-2">
              <Input
                onChange={(event) =>
                  searchForm.setFieldValue("query", event.target.value)
                }
                aria-label={t("web.admin.featureFlags.emailUsernameOrName")}
                placeholder={t("web.admin.featureFlags.emailUsernameOrName")}
                value={query}
              />
              <Button
                aria-label={t("web.admin.featureFlags.searchUsers")}
                onClick={() => void searchForm.handleSubmit()}
                size="icon"
                type="button"
                variant="outline"
              >
                <FontAwesomeIcon aria-hidden="true" icon={faMagnifyingGlass} />
              </Button>
            </div>
            <div className="mt-3 grid gap-2">
              {users.map((user) => (
                <Button
                  className="h-auto justify-start px-3 py-2"
                  key={user.clerkId}
                  onClick={() => dispatch({ type: "userSelected", user })}
                  type="button"
                  variant="outline"
                >
                  <FontAwesomeIcon aria-hidden="true" icon={faShield} />
                  <span className="min-w-0 text-left">
                    <span className="block truncate">{user.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {user.email ?? user.username ?? user.clerkId}
                    </span>
                  </span>
                </Button>
              ))}
            </div>
            {selectedUser ? (
              <FeatureFlagTargeting
                key={`${selectedUser.clerkId}:${state.revision}`}
                user={selectedUser}
              />
            ) : null}
          </section>
        </aside>
      </main>
    </AdminPageShell>
  );
}

/**
 * Owns one selected user's targeting lookup and mutation observers.
 * @param props - Current selected Clerk identity.
 * @returns Selected-user targeting controls.
 */
function FeatureFlagTargeting({
  user,
}: {
  /** Current selected identity. */
  user: ClerkUserSearchResult;
}) {
  const { locale } = useLocale();
  /** Formats existing targeting copy.
   * @param key - Existing translation key.
   * @returns Localized targeting copy. */
  const t = (key: TranslationKey) => formatTranslation(key, {}, locale);
  const [state, dispatch] = useEffectReducer<
    FlagTargetState,
    FlagTargetEvent,
    FlagTargetEffect
  >(
    (state, event, exec) => {
      if (event.type === "reloadRequested")
        return {
          ...state,
          error: null,
          request: exec.replace(state.request, { type: "load" }),
        };
      exec.stop(state.request);
      return {
        flags: event.flags ?? state.flags,
        error: event.error ?? null,
        request: undefined,
      };
    },
    (exec) => ({ flags: [], error: null, request: exec({ type: "load" }) }),
    {
      /**
       * Loads targeting only for this selected account's active observer.
       * @param _state - Current targeting feedback.
       * @param _effect - Current selected-user lookup.
       * @param dispatch - Terminal dispatcher.
       * @param context - Current observer lifetime.
       */
      load: (_state, _effect, dispatch, { signal }) => {
        void listAdminTargetingForUser({
          data: { targetClerkId: user.clerkId },
          signal,
        }).then(
          (flags) => {
            if (!signal.aborted) dispatch({ type: "loaded", flags });
          },
          (error: unknown) => {
            if (!signal.aborted)
              dispatch({
                type: "loaded",
                error:
                  error instanceof Error
                    ? error.message
                    : t("web.status.failedToLoad"),
              });
          },
        );
      },
    },
  );
  const mutation = useFeatureFlagMutation(() =>
    dispatch({ type: "reloadRequested" }),
  );
  const targetFlags = state.flags;
  const error = mutation.error || state.error;
  return (
    <>
      {error ? (
        <Badge className="bg-destructive text-destructive-foreground">
          {error}
        </Badge>
      ) : null}
      <div className="mt-4 border-t border-border pt-3">
        <div className="mb-2 text-xs font-semibold text-muted-foreground uppercase">
          {user.name}
        </div>
        <div className="grid gap-2">
          {targetFlags.map((flag) => (
            <Button
              className="justify-between"
              key={flag.slug}
              disabled={mutation.pending || Boolean(state.request)}
              onClick={() =>
                mutation.mutate({
                  kind: "target",
                  enabled: !flag.enabled,
                  slug: flag.slug,
                  targetClerkId: user.clerkId,
                })
              }
              type="button"
              variant="outline"
            >
              <span>{flag.name}</span>
              <span className="flex items-center gap-2 text-xs">
                <FontAwesomeIcon aria-hidden="true" icon={faToggleOff} />
                {flag.enabled
                  ? t("web.status.enabled")
                  : t("web.status.disabled")}
              </span>
            </Button>
          ))}
        </div>
      </div>
    </>
  );
}
