import { useAuth } from "@clerk/tanstack-react-start";
import { useForm, useStore } from "@tanstack/react-form";
import { useCallback, useId, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useConfirmedDeletion } from "@/hooks/use-confirmed-deletion";
import { useCatalogCopy } from "@/lib/catalog-copy";

/**
 * Renders explicit permanent-deletion confirmation without changing ownership rules.
 *
 * @param props - Target label, target type, staff reason requirement, and deletion callback.
 * @returns Accessible permanent deletion controls shared by products and collection items.
 */
export function PermanentDeletionControls(props: PermanentDeletionProperties) {
  const { userId } = useAuth();
  return (
    <PermanentDeletionForm
      key={`${userId}:${props.reasonRequired}:${props.targetType ?? "product"}`}
      {...props}
    />
  );
}

/** Backward-compatible confirmed deletion properties with optional post-commit completion. */
type PermanentDeletionProperties = Parameters<typeof PermanentDeletionForm>[0];

/**
 * Owns one account/target confirmation form without binding cleanup to user dismissal.
 * @param props - Existing deletion contract and optional post-commit completion.
 * @returns Explicit permanent deletion controls.
 */
function PermanentDeletionForm({
  name,
  onDelete,
  onDeleted,
  reasonRequired,
  targetType = "product",
}: {
  /** Entity name shown in the warning. */
  name: string;
  /** Whether cross-owner staff intervention needs a reason. */
  reasonRequired: boolean;
  /** Entity whose deletion consequences are shown; defaults to a catalog product. */
  targetType?: "product" | "collection_item";
  /**
   * Deletes the confirmed entity.
   *
   * @param reason - Required staff reason, absent for an owner deletion.
   * @returns Completion after deletion commits.
   * @rejects When deletion is blocked or fails.
   */
  onDelete(reason?: string): Promise<void>;
  /**
   * Completes existing post-delete navigation only after the current observer sees acknowledgement.
   * @returns Completion after the existing post-delete action.
   * @rejects When completion fails.
   */
  onDeleted?: () => Promise<unknown> | void;
}) {
  const t = useCatalogCopy();
  const item = targetType === "collection_item";
  const action = t(
    item
      ? "web.collections.deletion.itemAction"
      : "web.catalog.deletion.action",
  );
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const reasonId = useId();
  const form = useForm({
    defaultValues: { confirmed: false, reason: "" },
    validators: {
      /**
       * Requires the existing explicit confirmation and optional trimmed staff reason.
       * @param input - Current confirmation fields.
       * @returns Existing failure key when confirmation is incomplete.
       */
      onSubmit: ({ value }): string | undefined =>
        !value.confirmed || (reasonRequired && !value.reason.trim())
          ? item
            ? "error.generic"
            : "web.catalog.deletion.failed"
          : undefined,
    },
    /**
     * Captures one validated deletion intent without changing its caller contract.
     * @param input - Current confirmation and optional reason.
     * @returns Nothing.
     */
    onSubmit: ({ value }) =>
      deletion.confirm(reasonRequired ? value.reason.trim() : undefined),
  });
  const { confirmed, reason } = useStore(form.store, (state) => state.values);
  const failure = useStore(form.store, (state) => state.errorMap.onSubmit);
  const eligible = useStore(
    form.store,
    (state) =>
      !state.isSubmitting &&
      state.values.confirmed &&
      (!reasonRequired || Boolean(state.values.reason.trim())),
  );
  const deletion = useConfirmedDeletion(onDelete, onDeleted, (error) => {
    form.setErrorMap({
      onSubmit:
        error instanceof Error &&
        !item &&
        error.message === "web.catalog.deletion.blocked"
          ? error.message
          : item
            ? "error.generic"
            : "web.catalog.deletion.failed",
    });
  });
  const submitting = deletion.submitting;
  /** Dismisses only explicit user intent, preserving the form through Activity cleanup. */
  const dismiss = () => {
    if (submitting) return;
    form.reset();
    deletion.dismiss();
  };
  /**
   * Owns the committed dialog DOM lifetime.
   * @param node - Current confirmation dialog.
   * @returns Cleanup closing only this mounted dialog.
   */
  const bindDialog = useCallback((node: HTMLDialogElement | null) => {
    dialog.current = node;
    if (!node) return;
    node.showModal();
    return () => {
      node.close();
      if (dialog.current === node) dialog.current = null;
    };
  }, []);
  return (
    <>
      <Button
        type="button"
        variant="destructive"
        onClick={() => {
          if (deletion.open) return;
          form.reset();
          deletion.openConfirmation();
        }}
      >
        {action}
      </Button>
      {deletion.open ? (
        <dialog
          ref={bindDialog}
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
          className="m-auto w-[min(36rem,calc(100%-2rem))] rounded-lg border border-border bg-card p-0 text-card-foreground shadow-xl backdrop:bg-black/50"
          onCancel={(event) => {
            event.preventDefault();
            dismiss();
          }}
        >
          <form
            className="grid gap-5 p-6"
            onSubmit={(event) => {
              event.preventDefault();
              if (submitting) return;
              form.setErrorMap({ onSubmit: undefined });
              void form.handleSubmit();
            }}
          >
            <h2 className="text-xl font-semibold" id={titleId}>
              {item ? action : t("web.catalog.deletion.title")}
            </h2>
            <p className="text-sm text-muted-foreground" id={descriptionId}>
              {t(
                item
                  ? "web.collections.deletion.itemDescription"
                  : "web.catalog.deletion.description",
                { name },
              )}
            </p>
            {reasonRequired ? (
              <div className="grid gap-2">
                <label htmlFor={reasonId}>
                  {t("web.resources.moderation.reasonLabel")}
                </label>
                <textarea
                  id={reasonId}
                  className="min-h-20 rounded-md border border-input bg-background p-3 text-foreground"
                  required
                  maxLength={1000}
                  disabled={submitting}
                  value={reason}
                  onChange={(event) =>
                    form.setFieldValue("reason", event.target.value)
                  }
                />
              </div>
            ) : null}
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 size-4"
                checked={confirmed}
                disabled={submitting}
                onChange={(event) =>
                  form.setFieldValue("confirmed", event.target.checked)
                }
              />
              <span>
                {t(
                  item
                    ? "web.collections.deletion.itemConfirmation"
                    : "web.catalog.deletion.confirmation",
                )}
              </span>
            </label>
            {failure ? (
              <p className="text-sm text-destructive" role="alert">
                {t(failure)}
              </p>
            ) : null}
            <div className="flex flex-wrap justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={submitting}
                onClick={dismiss}
              >
                {t("action.cancel")}
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={submitting || !eligible}
              >
                {action}
              </Button>
            </div>
          </form>
        </dialog>
      ) : null}
    </>
  );
}
