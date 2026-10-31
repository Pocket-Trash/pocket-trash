import { useAuth } from "@clerk/tanstack-react-start";
import {
  faCheck,
  faShieldMinus,
  faTrash,
  faUserXmark,
} from "@fortawesome/pro-light-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  formatTranslation,
  type SupportedLocale,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { useForm, useStore } from "@tanstack/react-form";
import { Link, useRouter } from "@tanstack/react-router";
import { useCallback, useRef } from "react";
import { toast } from "sonner";
import {
  type EffectEntity,
  type EffectFunction,
  useEffectReducer,
} from "use-effect-reducer";
import { AdminPageShell } from "@/components/admin-page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { listResourceNotifications } from "@/lib/resources";
import {
  markResourceNotificationRead,
  markResourcePrivate,
} from "@/lib/resources";
import { useLocale } from "@/providers/locale-provider";

/** Resource notification displayed to administrators. */
type Notification = Awaited<
  ReturnType<typeof listResourceNotifications>
>[number];

/** Resource notification controls and scoped mutation lifetimes. */
type NotificationState = {
  /** Independent read acknowledgements in flight. */
  accepting: ReadonlyMap<
    number,
    EffectEntity<NotificationState, NotificationEvent>
  >;
  /** Acknowledgements confirmed by the server and refreshed loader. */
  accepted: ReadonlySet<number>;
  /** Notification currently selected for staff privacy confirmation. */
  moderating: Notification | null;
  /** Confirmed staff-privacy mutation in flight. */
  privateRequest:
    | EffectEntity<NotificationState, NotificationEvent>
    | undefined;
};
/** Notification selection, mutation intent, and terminal cleanup. */
type NotificationEvent =
  | {
      /** Starts one unread notification acknowledgement. */
      type: "acceptRequested";
      /** Notification identifier. */
      notificationId: number;
    }
  | {
      /** Settles one acknowledgement and its loader refresh. */
      type: "acceptFinished";
      /** Current notification identifier. */
      notificationId: number;
      /** Whether both mutation and refresh succeeded. */
      success: boolean;
    }
  | {
      /** Opens staff moderation for one current notification. */
      type: "moderationOpened";
      /** Captured resource notification. */
      notification: Notification;
    }
  | {
      /** Dismisses staff moderation. */
      type: "moderationDismissed";
    }
  | {
      /** Starts one validated staff-privacy request. */
      type: "privateRequested";
      /** Existing unmodified staff reason. */
      reason: string;
    }
  | {
      /** Settles privacy and its refreshed route data. */
      type: "privateFinished";
      /** Whether both mutation and refresh succeeded. */
      success: boolean;
    };
/** Captured notification mutation and current resource metadata. */
type NotificationEffect =
  | {
      /** Read acknowledgement implementation. */
      type: "accept";
      /** Notification whose read state is changing. */
      notificationId: number;
    }
  | {
      /** Staff privacy implementation. */
      type: "makePrivate";
      /** Resource notification captured at confirmation. */
      notification: Notification;
      /** Existing validated staff reason. */
      reason: string;
    };
/** Mutation/refresh completion retained across Activity resumption. */
type NotificationTask = {
  /** Descriptor whose mutation must not replay. */
  effect: NotificationEffect;
  /** Durable mutation completion. */
  promise: Promise<boolean>;
  /** Successful server mutation retained when only loader refresh fails. */
  committed?: boolean;
  /** Loader invalidation started only by an active observer. */
  refresh?: Promise<boolean>;
};

/** Renders resource notifications with read and moderation controls.
 *
 * @param props - Notification page properties.
 * @param props.initialNotifications - Notifications loaded for the initial render.
 * @returns The resource notification administration page.
 */
export function AdminResourceNotificationsPage({
  initialNotifications,
}: {
  /** Notifications loaded for the initial render. */
  initialNotifications: Notification[];
}) {
  const { userId } = useAuth();
  return (
    <ResourceNotificationsContent
      key={userId}
      initialNotifications={initialNotifications}
    />
  );
}

/**
 * Owns one administrator's notification controls while the route owns its list data.
 * @param props - Current loader notification rows.
 * @returns Scoped notification administration content.
 */
function ResourceNotificationsContent({
  initialNotifications,
}: {
  /** Current loader-owned rows. */ initialNotifications: Notification[];
}) {
  const { locale } = useLocale();
  const notifications = initialNotifications;
  const router = useRouter();
  const tasks = useRef(new Map<string, NotificationTask>());
  const dialogRef = useRef<HTMLDialogElement>(null);
  const form = useForm({
    defaultValues: { reason: "" },
    validators: {
      /**
       * Requires the existing staff reason before confirmed privacy.
       * @param input - Current reason field.
       * @returns Existing required-reason feedback when blank.
       */
      onSubmit: ({ value }): string | undefined =>
        value.reason.trim()
          ? undefined
          : "web.resources.moderation.reasonRequired",
    },
    /** Reports the existing missing-reason feedback without dropping the draft. */
    onSubmitInvalid: () => {
      toast.error(t("web.resources.moderation.reasonRequired"));
    },
    /**
     * Captures one validated staff-privacy intent.
     * @param input - Current reason field.
     */
    onSubmit: ({ value }) => {
      dispatch({ type: "privateRequested", reason: value.reason });
    },
  });
  const reason = useStore(form.store, (state) => state.values.reason);
  const canModerate = useStore(
    form.store,
    (state) => state.values.reason.trim().length > 0 && !state.isSubmitting,
  );
  /**
   * Persists one notification action, then invalidates its existing route loader.
   * @param _state - Current scoped controls.
   * @param effect - Captured acknowledgement or privacy intent.
   * @param dispatch - Terminal dispatcher.
   * @param context - Current observer cancellation lifetime.
   */
  const executeMutation: EffectFunction<
    NotificationState,
    NotificationEvent,
    NotificationEffect
  > = (_state, effect, dispatch, { signal }) => {
    const key =
      effect.type === "accept"
        ? `accept:${effect.notificationId}`
        : `private:${effect.notification.resourceId}`;
    const previous = tasks.current.get(key);
    if (tasks.current.get(key)?.effect !== effect)
      tasks.current.set(key, {
        effect,
        committed: previous?.committed,
        promise: previous?.committed
          ? previous.promise
          : Promise.resolve()
              .then(() =>
                effect.type === "accept"
                  ? markResourceNotificationRead({
                      data: { notificationId: effect.notificationId },
                    })
                  : markResourcePrivate({
                      data: {
                        reason: effect.reason,
                        resourceId: effect.notification.resourceId,
                      },
                    }),
              )
              .then(
                () => true,
                () => false,
              ),
      });
    const task = tasks.current.get(key);
    if (!task) return;
    /**
     * Delivers terminal feedback only to this current administrator observer.
     * @param success - Whether mutation and loader refresh succeeded.
     */
    const finish = (success: boolean) => {
      if (signal.aborted) return;
      if (success || !task.committed) tasks.current.delete(key);
      if (effect.type === "accept") {
        dispatch({
          type: "acceptFinished",
          notificationId: effect.notificationId,
          success,
        });
        toast[success ? "success" : "error"](
          t(
            success
              ? "web.resources.notification.accepted"
              : "web.resources.notification.acceptFailed",
          ),
        );
      } else {
        dispatch({ type: "privateFinished", success });
        toast[success ? "success" : "error"](
          t(
            success
              ? "web.resources.moderation.success"
              : "web.resources.moderation.failure",
            success ? { name: effect.notification.resourceName } : {},
          ),
        );
      }
    };
    void task.promise.then((mutated) => {
      task.committed = mutated;
      if (signal.aborted) return;
      if (!mutated) {
        finish(false);
        return;
      }
      task.refresh ??= router.invalidate().then(
        () => true,
        () => false,
      );
      void task.refresh.then(finish);
    });
  };
  const [state, dispatch] = useEffectReducer<
    NotificationState,
    NotificationEvent,
    NotificationEffect
  >(
    (state, event, exec) => {
      switch (event.type) {
        case "acceptRequested": {
          if (
            state.accepting.has(event.notificationId) ||
            state.accepted.has(event.notificationId)
          )
            return state;
          const accepting = new Map(state.accepting);
          accepting.set(
            event.notificationId,
            exec({ type: "accept", notificationId: event.notificationId }),
          );
          return { ...state, accepting };
        }
        case "acceptFinished": {
          const current = state.accepting.get(event.notificationId);
          if (!current) return state;
          exec.stop(current);
          const accepting = new Map(state.accepting);
          accepting.delete(event.notificationId);
          return {
            ...state,
            accepting,
            accepted: event.success
              ? new Set(state.accepted).add(event.notificationId)
              : state.accepted,
          };
        }
        case "moderationOpened":
          return state.privateRequest
            ? state
            : { ...state, moderating: event.notification };
        case "moderationDismissed":
          return state.privateRequest ? state : { ...state, moderating: null };
        case "privateRequested":
          return state.privateRequest || !state.moderating
            ? state
            : {
                ...state,
                privateRequest: exec({
                  type: "makePrivate",
                  notification: state.moderating,
                  reason: event.reason,
                }),
              };
        case "privateFinished":
          exec.stop(state.privateRequest);
          return {
            ...state,
            privateRequest: undefined,
            moderating: event.success ? null : state.moderating,
          };
      }
    },
    {
      accepting: new Map(),
      accepted: new Set(),
      moderating: null,
      privateRequest: undefined,
    },
    { accept: executeMutation, makePrivate: executeMutation },
  );
  const { moderating } = state;
  const markingPrivate = Boolean(state.privateRequest);
  /**
   * Owns staff confirmation through its committed DOM lifetime.
   * @param node - Current dialog node.
   * @returns Cleanup closing only this mounted confirmation.
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
  /** Formats resource notification copy for the active locale.
   *
   * @param key - Translation key to format.
   * @param params - Values interpolated into the translation.
   * @returns Localized notification copy.
   */
  const t = (
    key: TranslationKey,
    params: Record<string, number | string> = {},
  ) => formatTranslation(key, params, locale);

  return (
    <AdminPageShell
      breadcrumbItems={[
        { label: t("web.navigation.admin"), to: "/admin" },
        { label: t("web.admin.notifications.title"), to: "/notifications" },
      ]}
      section="notifications"
      title={t("web.resources.notification.title")}
    >
      <main className="grid w-full max-w-5xl gap-6 px-4 py-6 md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="m-0 text-sm text-muted-foreground">
            {t("web.resources.notification.description")}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              nativeButton={false}
              render={<Link to="/admin/account-erasure" />}
              variant="outline"
            >
              <FontAwesomeIcon aria-hidden="true" icon={faUserXmark} />
              {t("web.erasure.admin.navigation")}
            </Button>
            <Button
              nativeButton={false}
              render={<Link to="/admin/trash/catalog-images" />}
              variant="outline"
            >
              <FontAwesomeIcon aria-hidden="true" icon={faTrash} />
              {t("web.resources.upload.imagesLabel")}
            </Button>
            <Button
              nativeButton={false}
              render={<Link to="/admin/trash/resources" />}
              variant="outline"
            >
              <FontAwesomeIcon aria-hidden="true" icon={faTrash} />
              {t("web.resources.trash.adminTitle")}
            </Button>
          </div>
        </div>
        {notifications.length === 0 ? (
          <p className="m-0 rounded-lg border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
            {t("web.resources.notification.empty")}
          </p>
        ) : (
          <div className="grid gap-4">
            {notifications.map((notification) => (
              <article
                className="grid gap-4 rounded-lg border border-border bg-card p-5 text-card-foreground shadow-sm md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
                key={notification.id}
              >
                <div className="grid min-w-0 gap-2 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>
                      {t(
                        notification.type === "resource_created"
                          ? "web.resources.notification.resourceCreated"
                          : "web.resources.notification.categoryCreated",
                      )}
                    </Badge>
                    <Badge
                      variant={notification.readAt ? "outline" : "secondary"}
                    >
                      {t(
                        notification.readAt
                          ? "web.resources.notification.read"
                          : "web.resources.notification.unread",
                      )}
                    </Badge>
                  </div>
                  {notification.type === "resource_created" ? (
                    <Link
                      className="font-medium text-primary underline-offset-4 hover:underline"
                      params={{ resourceId: String(notification.resourceId) }}
                      to="/resources/$resourceId"
                    >
                      {t("web.resources.notification.resourceName", {
                        name: notification.resourceName,
                      })}
                    </Link>
                  ) : (
                    <span className="font-medium">
                      {t("web.resources.notification.categoryName", {
                        name: notification.categoryName ?? "",
                      })}
                    </span>
                  )}
                  <span className="text-muted-foreground">
                    {t("web.resources.notification.categories", {
                      categories: notification.categories.join(", "),
                    })}
                  </span>
                  <span className="text-muted-foreground">
                    {t("web.resources.notification.uploader", {
                      uploader: notification.uploaderUsername,
                    })}
                  </span>
                  <span className="text-muted-foreground">
                    {t("web.resources.notification.createdAt", {
                      date: formatDate(notification.createdAt, locale),
                    })}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 md:flex-col">
                  <Button
                    disabled={
                      Boolean(notification.readAt) ||
                      state.accepting.has(notification.id) ||
                      state.accepted.has(notification.id)
                    }
                    onClick={() =>
                      dispatch({
                        type: "acceptRequested",
                        notificationId: notification.id,
                      })
                    }
                    type="button"
                    variant="outline"
                  >
                    <FontAwesomeIcon aria-hidden="true" icon={faCheck} />
                    {t("web.resources.action.accept")}
                  </Button>
                  {!notification.isPrivate ? (
                    <Button
                      onClick={() => {
                        if (markingPrivate) return;
                        form.reset();
                        dispatch({ type: "moderationOpened", notification });
                      }}
                      type="button"
                      variant="destructive"
                    >
                      <FontAwesomeIcon
                        aria-hidden="true"
                        icon={faShieldMinus}
                      />
                      {t("web.resources.action.markPrivate")}
                    </Button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
        {moderating ? (
          <dialog
            aria-labelledby="mark-resource-private-title"
            className="m-auto w-[min(32rem,calc(100%-2rem))] rounded-lg border border-border bg-card p-0 text-card-foreground shadow-xl backdrop:bg-black/50"
            ref={bindDialog}
            onCancel={(event) => {
              event.preventDefault();
              if (!markingPrivate) dispatch({ type: "moderationDismissed" });
            }}
          >
            <form
              className="grid gap-5 p-6"
              onSubmit={(event) => {
                event.preventDefault();
                if (markingPrivate) return;
                form.setErrorMap({ onSubmit: undefined });
                void form.handleSubmit();
              }}
            >
              <div className="grid gap-2">
                <h2
                  className="m-0 text-xl font-semibold"
                  id="mark-resource-private-title"
                >
                  {t("web.resources.moderation.confirmationTitle")}
                </h2>
                <p className="m-0 text-sm text-muted-foreground">
                  {t("web.resources.moderation.confirmationDescription", {
                    name: moderating?.resourceName ?? "",
                  })}
                </p>
              </div>
              <label
                className="grid gap-2 text-sm font-medium"
                htmlFor="private-resource-reason"
              >
                {t("web.resources.moderation.reasonLabel")}
                <textarea
                  className="min-h-28 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  id="private-resource-reason"
                  maxLength={1000}
                  onChange={(event) =>
                    form.setFieldValue("reason", event.target.value)
                  }
                  placeholder={t("web.resources.moderation.reasonPlaceholder")}
                  required
                  value={reason}
                />
              </label>
              <div className="flex justify-end gap-2">
                <Button
                  disabled={markingPrivate}
                  onClick={() => dispatch({ type: "moderationDismissed" })}
                  type="button"
                  variant="outline"
                >
                  {t("action.cancel")}
                </Button>
                <Button
                  disabled={markingPrivate || !canModerate}
                  type="submit"
                  variant="destructive"
                >
                  {t("web.resources.action.markPrivate")}
                </Button>
              </div>
            </form>
          </dialog>
        ) : null}
      </main>
    </AdminPageShell>
  );
}

/** Formats a notification timestamp for the active locale.
 *
 * @param value - Timestamp to format.
 * @param locale - Locale controlling date and time formatting.
 * @returns The localized medium-date and short-time label.
 */
function formatDate(value: Date, locale: SupportedLocale) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
