import { Switch as SwitchPrimitive } from "@base-ui/react/switch";
import { useAuth } from "@clerk/tanstack-react-start";
import {
  formatTranslation,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { useForm, useStore } from "@tanstack/react-form";
import { useCallback, useId, useRef } from "react";
import { toast } from "sonner";
import { type EffectEntity, useEffectReducer } from "use-effect-reducer";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { markResourcePrivate, setResourceVisibility } from "@/lib/resources";
import { useLocale } from "@/providers/locale-provider";

/**
 * Renders a localized switch for controlled public-resource state.
 *
 * @param props - Public resource switch properties.
 * @param props.checked - Whether the resource is public.
 * @param props.disabled - Whether interaction is disabled.
 * @param props.onCheckedChange - Receives public-state changes.
 * @returns The public-resource switch UI.
 * @throws {Error} When rendered outside `LocaleProvider`.
 */
export function PublicResourceSwitch({
  checked,
  disabled = false,
  onCheckedChange,
}: {
  /**
   * Whether the resource is public.
   */
  checked: boolean;
  /**
   * Whether interaction is disabled.
   *
   * @default false
   */
  disabled?: boolean;
  /**
   * Reports public-state changes.
   *
   * @param checked - Whether the resource should be public.
   */
  onCheckedChange(checked: boolean): void;
}) {
  const id = useId();
  const { locale } = useLocale();
  const publicLabel = formatTranslation(
    "web.resources.visibility.public",
    {},
    locale,
  );
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border border-border p-3">
      <label className="text-sm font-medium" htmlFor={id}>
        {publicLabel}
      </label>
      <SwitchPrimitive.Root
        aria-label={publicLabel}
        checked={checked}
        className="flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full bg-muted-foreground/35 p-0.5 outline-none transition-colors data-[checked]:bg-green-600 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:data-[checked]:bg-green-500"
        disabled={disabled}
        id={id}
        onCheckedChange={onCheckedChange}
      >
        <SwitchPrimitive.Thumb className="size-5 rounded-full bg-white shadow-sm transition-transform data-[checked]:translate-x-5" />
      </SwitchPrimitive.Root>
    </div>
  );
}

/** Resource visibility state and permissions shared by its public boundary. */
type ResourceVisibilityProps = {
  /**
   * Whether the viewer may moderate another user's resource.
   */
  canAdminister: boolean;
  /**
   * Whether staff forced the resource private.
   */
  isAdminPrivate: boolean;
  /**
   * Whether the viewer owns the resource.
   */
  isOwner: boolean;
  /**
   * Initial private-resource state.
   */
  isPrivate: boolean;
  /**
   * Resource name shown in moderation feedback.
   */
  name: string;
  /**
   * Resource identifier sent to visibility mutations.
   */
  resourceId: number;
};

/** Resource visibility and its current moderation dialog/save. */
type VisibilityState = {
  /** Last route-owned privacy flag reconciled into the control. */
  sourcePrivate: boolean;
  /** Last route-owned forced-privacy flag. */
  sourceAdminPrivate: boolean;
  /** Current durable public state. */
  isPublic: boolean;
  /** Whether staff privacy confirmation is open. */
  dialogOpen: boolean;
  /** Current committed visibility mutation. */
  save: EffectEntity<VisibilityState, VisibilityEvent> | undefined;
};
/** Visibility intent, confirmation disclosure, and terminal feedback. */
type VisibilityEvent =
  | {
      /** Reconciles refreshed visibility without replacing the reason form. */
      type: "visibilityReceived";
      /** Current route-owned privacy. */
      isPrivate: boolean;
      /** Current route-owned forced privacy. */
      isAdminPrivate: boolean;
    }
  | {
      /** Opens staff privacy confirmation. */
      type: "moderationOpened";
    }
  | {
      /** Dismisses staff privacy confirmation. */
      type: "moderationDismissed";
    }
  | {
      /** Queues a validated visibility change. */
      type: "saveRequested";
      /** Requested public state. */
      isPublic: boolean;
      /** Whether this is a staff-forced privacy mutation. */
      adminPrivate: boolean;
      /** Existing moderation reason. */
      reason?: string;
    }
  | {
      /** Stops the completed visibility mutation. */
      type: "saveFinished";
      /** Durable public state on success. */
      isPublic?: boolean;
    };
/** Committed visibility mutation inputs. */
type VisibilityEffect = {
  /** Save implementation. */
  type: "save";
  /** Requested public state. */
  isPublic: boolean;
  /** Whether staff-forced privacy uses its dedicated endpoint. */
  adminPrivate: boolean;
  /** Existing moderation reason. */
  reason?: string;
};

/**
 * Renders owner and staff resource visibility controls with moderation-reason flows.
 * Owners cannot change staff-forced privacy without administrative access, and staff changes to another user's resource require a nonblank reason.
 *
 * @param props - Resource visibility state and permissions.
 * @param props.canAdminister - Whether the viewer may moderate another user's resource.
 * @param props.isAdminPrivate - Whether staff forced the resource private.
 * @param props.isOwner - Whether the viewer owns the resource.
 * @param props.isPrivate - Initial private-resource state.
 * @param props.name - Resource name shown in moderation feedback.
 * @param props.resourceId - Resource identifier sent to visibility mutations.
 * @returns The resource visibility control.
 * @throws {Error} When rendered outside `LocaleProvider`.
 */
export function ResourceVisibilityToggle(props: ResourceVisibilityProps) {
  const { userId } = useAuth();
  return (
    <ResourceVisibilityControl
      key={`${userId}:${props.resourceId}:${props.isOwner}:${props.canAdminister}`}
      {...props}
    />
  );
}

/**
 * Owns one resource/permission identity's visibility form and committed mutation.
 * @param props - Visibility state and permission properties.
 * @returns Scoped visibility and moderation controls.
 */
function ResourceVisibilityControl({
  canAdminister,
  isAdminPrivate,
  isOwner,
  isPrivate,
  name,
  resourceId,
}: ResourceVisibilityProps) {
  const { locale } = useLocale();
  const form = useForm({
    defaultValues: { reason: "" },
    validators: {
      /**
       * Requires the existing nonblank staff reason before forced privacy.
       * @param input - Current reason field.
       * @returns Existing required-reason feedback when blank.
       */
      onSubmit: ({ value }): string | undefined =>
        value.reason.trim()
          ? undefined
          : "web.resources.moderation.reasonRequired",
    },
    /**
     * Reports the existing required-reason message without clearing the draft.
     */
    onSubmitInvalid: () => {
      toast.error(t("web.resources.moderation.reasonRequired"));
    },
    /**
     * Captures the existing staff-private request and its unmodified reason.
     * @param input - Validated reason field.
     */
    onSubmit: ({ value }) => {
      dispatch({
        type: "saveRequested",
        isPublic: false,
        adminPrivate: true,
        reason: value.reason,
      });
    },
  });
  const reason = useStore(form.store, (state) => state.values.reason);
  const canSubmit = useStore(
    form.store,
    (state) => state.values.reason.trim().length > 0 && !state.isSubmitting,
  );
  const task = useRef<{
    /** Descriptor whose mutation must not replay. */
    effect: VisibilityEffect;
    /** Completion retained across suspended observers. */
    promise: Promise<boolean>;
  } | null>(null);
  const [visibility, dispatch] = useEffectReducer<
    VisibilityState,
    VisibilityEvent,
    VisibilityEffect
  >(
    (state, event, exec) => {
      if (event.type === "visibilityReceived") {
        exec.stop(state.save);
        return {
          ...state,
          sourcePrivate: event.isPrivate,
          sourceAdminPrivate: event.isAdminPrivate,
          isPublic: !event.isPrivate,
          save: undefined,
        };
      }
      if (event.type === "moderationOpened")
        return { ...state, dialogOpen: true };
      if (event.type === "moderationDismissed")
        return state.save ? state : { ...state, dialogOpen: false };
      if (event.type === "saveRequested") {
        if (state.save) return state;
        return {
          ...state,
          save: exec({
            type: "save",
            isPublic: event.isPublic,
            adminPrivate: event.adminPrivate,
            reason: event.reason,
          }),
        };
      }
      exec.stop(state.save);
      return {
        ...state,
        isPublic: event.isPublic ?? state.isPublic,
        dialogOpen: event.isPublic === undefined ? state.dialogOpen : false,
        save: undefined,
      };
    },
    {
      sourcePrivate: isPrivate,
      sourceAdminPrivate: isAdminPrivate,
      isPublic: !isPrivate,
      dialogOpen: false,
      save: undefined,
    },
    {
      /**
       * Persists one visibility intent and publishes only to the active resource scope.
       * @param _state - Current visibility controls.
       * @param effect - Captured visibility/reason mutation.
       * @param dispatch - Terminal dispatcher.
       * @param context - Current observer lifetime.
       */
      save: (_state, effect, dispatch, { signal }) => {
        if (task.current?.effect !== effect)
          task.current = {
            effect,
            promise: Promise.resolve()
              .then(() =>
                effect.adminPrivate
                  ? markResourcePrivate({
                      data: { reason: effect.reason ?? "", resourceId },
                    })
                  : setResourceVisibility({
                      data: {
                        isPublic: effect.isPublic,
                        reason: effect.reason,
                        resourceId,
                      },
                    }),
              )
              .then(
                () => true,
                () => false,
              ),
          };
        void task.current.promise.then((success) => {
          if (signal.aborted) return;
          dispatch({
            type: "saveFinished",
            isPublic: success ? effect.isPublic : undefined,
          });
          if (!success) {
            toast.error(
              t(
                effect.adminPrivate
                  ? "web.resources.moderation.failure"
                  : "web.resources.error.editFailed",
              ),
            );
            return;
          }
          if (effect.adminPrivate)
            toast.success(t("web.resources.moderation.success", { name }));
        });
      },
    },
  );
  if (
    visibility.sourcePrivate !== isPrivate ||
    visibility.sourceAdminPrivate !== isAdminPrivate
  )
    dispatch({ type: "visibilityReceived", isPrivate, isAdminPrivate });
  const { isPublic } = visibility;
  const saving = Boolean(visibility.save);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const locked = isAdminPrivate && isOwner && !canAdminister;
  /**
   * Formats visibility and moderation copy for the active locale.
   *
   * @param key - Resource translation key.
   * @param params - Translation interpolation values.
   * @returns Localized visibility or moderation text.
   */
  const t = (
    key: TranslationKey,
    params: Record<string, number | string> = {},
  ) => formatTranslation(key, params, locale);

  /**
   * Applies a visibility intent or opens the existing staff confirmation flow.
   * @param nextPublic - Requested public state.
   */
  function updateVisibility(nextPublic: boolean) {
    if (locked || saving) return;
    if (!nextPublic && canAdminister && !isOwner) {
      form.reset();
      dispatch({ type: "moderationOpened" });
      return;
    }
    const reason =
      nextPublic && canAdminister && !isOwner
        ? window.prompt(t("web.resources.moderation.reasonLabel"))?.trim()
        : undefined;
    if (nextPublic && canAdminister && !isOwner && !reason) {
      toast.error(t("web.resources.moderation.reasonRequired"));
      return;
    }
    dispatch({
      type: "saveRequested",
      isPublic: nextPublic,
      adminPrivate: false,
      reason,
    });
  }
  /**
   * Owns the confirmation dialog through its committed DOM lifetime.
   * @param node - Current dialog node.
   * @returns Cleanup that closes only this mounted dialog.
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

  const toggle = (
    <PublicResourceSwitch
      checked={isPublic}
      disabled={locked || saving}
      onCheckedChange={(checked) => void updateVisibility(checked)}
    />
  );

  return (
    <>
      {locked ? (
        <Tooltip>
          <TooltipTrigger render={<div />}>{toggle}</TooltipTrigger>
          <TooltipContent side="top">
            {t("web.resources.visibility.adminPrivateTooltip")}
          </TooltipContent>
        </Tooltip>
      ) : (
        toggle
      )}
      {visibility.dialogOpen ? (
        <dialog
          aria-labelledby={titleId}
          className="m-auto w-[min(32rem,calc(100%-2rem))] rounded-lg border border-border bg-card p-0 text-card-foreground shadow-xl backdrop:bg-black/50"
          ref={bindDialog}
          onCancel={(event) => {
            event.preventDefault();
            if (!saving) dispatch({ type: "moderationDismissed" });
          }}
        >
          <div className="grid gap-5 p-6">
            <div className="grid gap-2">
              <h2 className="m-0 text-xl font-semibold" id={titleId}>
                {t("web.resources.moderation.confirmationTitle")}
              </h2>
              <p className="m-0 text-sm text-muted-foreground">
                {t("web.resources.moderation.confirmationDescription", {
                  name,
                })}
              </p>
            </div>
            <label className="grid gap-2 text-sm font-medium">
              {t("web.resources.moderation.reasonLabel")}
              <textarea
                className="min-h-28 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                maxLength={1000}
                onChange={(event) =>
                  form.setFieldValue("reason", event.target.value)
                }
                placeholder={t("web.resources.moderation.reasonPlaceholder")}
                value={reason}
              />
            </label>
            <div className="flex justify-end gap-2">
              <Button
                disabled={saving}
                onClick={() => dispatch({ type: "moderationDismissed" })}
                type="button"
                variant="outline"
              >
                {t("action.cancel")}
              </Button>
              <Button
                disabled={saving || !canSubmit}
                onClick={() => {
                  form.setErrorMap({ onSubmit: undefined });
                  void form.handleSubmit();
                }}
                type="button"
                variant="destructive"
              >
                {t("web.resources.action.markPrivate")}
              </Button>
            </div>
          </div>
        </dialog>
      ) : null}
    </>
  );
}
