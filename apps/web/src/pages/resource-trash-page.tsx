import { useAuth } from "@clerk/tanstack-react-start";
import { faArrowRotateLeft, faTrash } from "@fortawesome/pro-light-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  formatTranslation,
  type SupportedLocale,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { useForm, useStore } from "@tanstack/react-form";
import { useCallback, useReducer, useRef } from "react";
import { toast } from "sonner";
import { type EffectEntity, useEffectReducer } from "use-effect-reducer";
import { AdminPageShell } from "@/components/admin-page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserPageShell } from "@/components/user-page-shell";
import type { listAdminResourceTrash } from "@/lib/resources";
import { permanentlyDeleteResource, restoreResource } from "@/lib/resources";
import { useLocale } from "@/providers/locale-provider";

/** A recoverable resource trash item. */
type TrashItem = Awaited<ReturnType<typeof listAdminResourceTrash>>[number];

/** One pending resource restore or permanent deletion. */
type ResourceTrashRequest = {
  /** Current row operation. */
  kind: "restore" | "delete";
  /** Committed mutation effect. */
  effect: EffectEntity<ResourceTrashState, ResourceTrashEvent>;
};
/** Recoverable rows and their independent mutation lifetimes. */
type ResourceTrashState = {
  /** Current recoverable resources. */
  resources: TrashItem[];
  /** One active mutation per row. */
  pending: ReadonlyMap<number, ResourceTrashRequest>;
};
/** Explicit row mutation requests and terminal results. */
type ResourceTrashEvent =
  | {
      /** Requests an authorized row mutation. */
      type: "requested";
      /** Restore or confirmed permanent deletion. */
      kind: "restore" | "delete";
      /** Row whose request owns feedback. */
      resource: TrashItem;
      /** Existing optional moderation reason. */
      reason?: string;
    }
  | {
      /** Stops a completed row mutation. */
      type: "finished";
      /** Current resource identifier. */
      resourceId: number;
      /** Whether the mutation committed. */
      success: boolean;
    };
/** Captured resource restore/deletion request. */
type ResourceTrashEffect = {
  /** Mutation implementation. */
  type: "commit";
  /** Restore or permanent deletion. */
  kind: "restore" | "delete";
  /** Captured row metadata. */
  resource: TrashItem;
  /** Existing optional moderation reason. */
  reason?: string;
};

/**
 * Renders the signed-in owner's resource trash.
 *
 * @param props - Owner resource trash properties.
 * @param props.initialResources - Recoverable resources shown initially.
 * @returns The owner resource trash page.
 */
export function OwnerResourceTrashPage({
  initialResources,
}: {
  /** Recoverable resources shown initially. */
  initialResources: TrashItem[];
}) {
  const { locale } = useLocale();
  const { userId } = useAuth();
  return (
    <UserPageShell
      section="resources"
      title={formatTranslation("web.resources.trash.ownerTitle", {}, locale)}
    >
      <ResourceTrashList
        key={userId}
        emptyKey="web.resources.trash.ownerEmpty"
        initialResources={initialResources}
        locale={locale}
        showPermanentDelete={false}
        showActor={false}
      />
    </UserPageShell>
  );
}

/**
 * Renders administrative resource trash controls.
 *
 * @param props - Admin resource trash properties.
 * @param props.initialResources - Recoverable resources shown initially.
 * @returns The admin resource trash page.
 */
export function AdminResourceTrashPage({
  initialResources,
}: {
  /** Recoverable resources shown initially. */
  initialResources: TrashItem[];
}) {
  const { locale } = useLocale();
  const { userId } = useAuth();
  return (
    <AdminPageShell
      breadcrumbItems={[
        {
          label: formatTranslation("web.navigation.admin", {}, locale),
          to: "/admin",
        },
        {
          label: formatTranslation("web.admin.trash.title", {}, locale),
          to: "/admin/trash",
        },
      ]}
      section="trash"
      title={formatTranslation("web.resources.trash.adminTitle", {}, locale)}
    >
      <main className="w-full max-w-5xl px-4 py-6 md:px-6">
        <ResourceTrashList
          key={userId}
          emptyKey="web.resources.trash.adminEmpty"
          initialResources={initialResources}
          locale={locale}
          showPermanentDelete
          showActor
        />
      </main>
    </AdminPageShell>
  );
}

/**
 * Renders recoverable resources for an owner or administrator.
 *
 * @param props - Trash contents and display permissions.
 * @param props.emptyKey - Localization key for the empty state.
 * @param props.initialResources - Recoverable resources shown initially.
 * @param props.locale - Locale used for copy and dates.
 * @param props.showPermanentDelete - Whether permanent deletion is available.
 * @param props.showActor - Whether deletion attribution is shown.
 * @returns The resource trash list.
 */
function ResourceTrashList({
  emptyKey,
  initialResources,
  locale,
  showPermanentDelete,
  showActor,
}: {
  /** Localization key for the empty state. */
  emptyKey: TranslationKey;
  /** Recoverable resources shown initially. */
  initialResources: TrashItem[];
  /** Locale used for copy and dates. */
  locale: SupportedLocale;
  /** Whether permanent deletion is available. */
  showPermanentDelete: boolean;
  /** Whether deletion attribution is shown. */
  showActor: boolean;
}) {
  const tasks = useRef(
    new Map<
      number,
      {
        /** Descriptor whose mutation must not replay. */
        effect: ResourceTrashEffect;
        /** Completion retained across suspended observers. */
        promise: Promise<boolean>;
      }
    >(),
  );
  const [state, dispatch] = useEffectReducer<
    ResourceTrashState,
    ResourceTrashEvent,
    ResourceTrashEffect
  >(
    (state, event, exec) => {
      const pending = new Map(state.pending);
      if (event.type === "requested") {
        if (pending.has(event.resource.id)) return state;
        pending.set(event.resource.id, {
          kind: event.kind,
          effect: exec({
            type: "commit",
            kind: event.kind,
            resource: event.resource,
            reason: event.reason,
          }),
        });
        return { ...state, pending };
      }
      const request = pending.get(event.resourceId);
      if (!request) return state;
      exec.stop(request.effect);
      pending.delete(event.resourceId);
      return {
        resources: event.success
          ? state.resources.filter(({ id }) => id !== event.resourceId)
          : state.resources,
        pending,
      };
    },
    { resources: initialResources, pending: new Map() },
    {
      /**
       * Observes one row mutation without replaying it after lifecycle resumption.
       * @param _state - Current recoverable rows.
       * @param effect - Captured authorized operation.
       * @param dispatch - Terminal row dispatcher.
       * @param context - Current observer lifetime.
       */
      commit: (_state, effect, dispatch, { signal }) => {
        if (tasks.current.get(effect.resource.id)?.effect !== effect)
          tasks.current.set(effect.resource.id, {
            effect,
            promise: Promise.resolve()
              .then(() =>
                effect.kind === "restore"
                  ? restoreResource({
                      data: {
                        reason: effect.reason,
                        resourceId: effect.resource.id,
                      },
                    })
                  : permanentlyDeleteResource({
                      data: {
                        reason: effect.reason ?? "",
                        resourceId: effect.resource.id,
                      },
                    }),
              )
              .then(
                () => true,
                () => false,
              ),
          });
        void tasks.current.get(effect.resource.id)?.promise.then((success) => {
          if (signal.aborted) return;
          tasks.current.delete(effect.resource.id);
          dispatch({
            type: "finished",
            resourceId: effect.resource.id,
            success,
          });
          const key =
            effect.kind === "restore"
              ? success
                ? "web.resources.trash.restoreSuccess"
                : "web.resources.trash.restoreFailure"
              : success
                ? "web.resources.trash.permanentSuccess"
                : "web.resources.trash.permanentFailure";
          toast[success ? "success" : "error"](
            t(key, { name: effect.resource.name }),
          );
        });
      },
    },
  );
  const { resources, pending } = state;
  /**
   * Formats localized resource trash copy.
   *
   * @param key - Localization key.
   * @param params - Values interpolated into the translation.
   * @returns The formatted translation.
   */
  const t = (
    key: TranslationKey,
    params: Record<string, number | string> = {},
  ) => formatTranslation(key, params, locale);

  if (resources.length === 0) {
    return (
      <p className="m-0 rounded-lg border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
        {t(emptyKey)}
      </p>
    );
  }

  return (
    <div className="grid gap-4">
      {resources.map((resource) => (
        <article
          className="grid gap-4 rounded-lg border border-border bg-card p-5 text-card-foreground shadow-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
          key={resource.id}
        >
          <div className="grid min-w-0 gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="m-0 truncate text-lg font-semibold">
                {resource.name}
              </h2>
              <Badge variant="secondary">
                {t(
                  resource.isPrivate
                    ? "web.resources.visibility.private"
                    : "web.resources.visibility.public",
                )}
              </Badge>
            </div>
            <p className="m-0 text-sm text-muted-foreground">
              {t("web.resources.trash.deletedOn", {
                date: formatDate(resource.deletedAt, locale),
              })}
            </p>
            {showActor ? (
              <div className="grid gap-1 text-sm text-muted-foreground">
                <span>
                  {t("web.resources.trash.deletedBy", {
                    user: resource.deletedByUsername,
                  })}
                </span>
                <span>
                  {t(
                    resource.deletedByRole === "admin"
                      ? "web.resources.trash.deletionRoleAdmin"
                      : "web.resources.trash.deletionRoleOwner",
                  )}
                </span>
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              disabled={pending.has(resource.id)}
              onClick={() => {
                const reason = showPermanentDelete
                  ? window
                      .prompt(t("web.resources.moderation.reasonLabel"))
                      ?.trim()
                  : undefined;
                if (showPermanentDelete && !reason) {
                  toast.error(t("web.resources.moderation.reasonRequired"));
                  return;
                }
                dispatch({
                  type: "requested",
                  kind: "restore",
                  resource,
                  reason,
                });
              }}
              type="button"
              variant="outline"
            >
              <FontAwesomeIcon aria-hidden="true" icon={faArrowRotateLeft} />
              {t("web.resources.action.restore")}
            </Button>
            {showPermanentDelete ? (
              <PermanentDeleteButton
                disabled={pending.has(resource.id)}
                deleting={pending.get(resource.id)?.kind === "delete"}
                onDelete={(reason) =>
                  dispatch({
                    type: "requested",
                    kind: "delete",
                    resource,
                    reason,
                  })
                }
                resource={resource}
                t={t}
              />
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}

/**
 * Renders the permanent deletion confirmation flow.
 *
 * @param props - Resource, callback, and localized copy.
 * @param props.onDelete - Requests the confirmed row deletion.
 * @param props.disabled - Whether another row mutation prevents opening confirmation.
 * @param props.deleting - Whether the confirmed deletion is pending.
 * @param props.resource - Resource to delete permanently.
 * @param props.t - Resource translation formatter.
 * @returns The permanent deletion button and dialog.
 */
function PermanentDeleteButton({
  onDelete,
  disabled,
  deleting,
  resource,
  t,
}: {
  /**
   * Requests one confirmed row deletion.
   * @param reason - Required staff reason.
   */
  onDelete(reason: string): void;
  /** Whether another row mutation prevents confirmation from opening. */
  disabled: boolean;
  /** Whether the confirmed deletion is pending. */
  deleting: boolean;
  /** Resource to delete permanently. */
  resource: TrashItem;
  /**
   * Formats localized resource copy.
   *
   * @param key - Localization key.
   * @param params - Values interpolated into the translation.
   * @returns The formatted translation.
   */
  t: (key: TranslationKey, params?: Record<string, number | string>) => string;
}) {
  const [open, dispatch] = useReducer(
    (_state: boolean, event: "opened" | "dismissed") => event === "opened",
    false,
  );
  const form = useForm({
    defaultValues: { reason: "" },
    validators: {
      /**
       * Requires the existing nonblank staff reason before permanent deletion.
       * @param input - Current confirmation fields.
       * @returns Existing required-reason feedback when blank.
       */
      onSubmit: ({ value }): string | undefined =>
        value.reason.trim()
          ? undefined
          : "web.resources.moderation.reasonRequired",
    },
    /**
     * Queues a confirmed deletion through its row owner.
     * @param input - Validated staff reason.
     */
    onSubmit: ({ value }) => {
      if (!deleting) onDelete(value.reason);
    },
  });
  const reason = useStore(form.store, (state) => state.values.reason);
  const canDelete = useStore(
    form.store,
    (state) => state.values.reason.trim().length > 0,
  );
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = `permanently-delete-resource-${resource.id}`;
  /**
   * Owns the confirmation dialog through its committed DOM lifetime.
   * @param node - Current dialog node.
   * @returns Cleanup closing only this mounted dialog.
   */
  const bindDialog = useCallback((node: HTMLDialogElement | null) => {
    dialogRef.current = node;
    if (!node) return;
    node.showModal();
    return () => {
      node.close();
      if (dialogRef.current === node) dialogRef.current = null;
    };
  }, []);

  return (
    <>
      <Button
        disabled={disabled}
        onClick={() => dispatch("opened")}
        type="button"
        variant="destructive"
      >
        <FontAwesomeIcon aria-hidden="true" icon={faTrash} />
        {t("web.resources.action.permanentlyDelete")}
      </Button>
      {open ? (
        <dialog
          aria-labelledby={titleId}
          className="m-auto w-[min(32rem,calc(100%-2rem))] rounded-lg border border-border bg-card p-0 text-card-foreground shadow-xl backdrop:bg-black/50"
          ref={bindDialog}
          onCancel={(event) => {
            event.preventDefault();
            if (!deleting) dispatch("dismissed");
          }}
        >
          <div className="grid gap-5 p-6">
            <div className="grid gap-2">
              <h2 className="m-0 text-xl font-semibold" id={titleId}>
                {t("web.resources.trash.permanentConfirmationTitle")}
              </h2>
              <p className="m-0 text-sm text-muted-foreground">
                {t("web.resources.trash.permanentConfirmationDescription", {
                  name: resource.name,
                })}
              </p>
            </div>
            <label className="grid gap-2 text-sm font-medium">
              {t("web.resources.moderation.reasonLabel")}
              <textarea
                className="min-h-24 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                maxLength={1000}
                onChange={(event) =>
                  form.setFieldValue("reason", event.currentTarget.value)
                }
                placeholder={t("web.resources.moderation.reasonPlaceholder")}
                required
                value={reason}
              />
            </label>
            <div className="flex justify-end gap-2">
              <Button
                disabled={deleting}
                onClick={() => dispatch("dismissed")}
                type="button"
                variant="outline"
              >
                {t("action.cancel")}
              </Button>
              <Button
                disabled={deleting || !canDelete}
                onClick={() => {
                  form.setErrorMap({ onSubmit: undefined });
                  void form.handleSubmit();
                }}
                type="button"
                variant="destructive"
              >
                <FontAwesomeIcon aria-hidden="true" icon={faTrash} />
                {t("web.resources.action.permanentlyDelete")}
              </Button>
            </div>
          </div>
        </dialog>
      ) : null}
    </>
  );
}

/**
 * Formats a resource deletion date and time.
 *
 * @param value - Date to format.
 * @param locale - Locale used for formatting.
 * @returns The localized date and time.
 */
function formatDate(value: Date, locale: SupportedLocale) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
