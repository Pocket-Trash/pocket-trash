import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useCatalogCopy } from "@/lib/catalog-copy";

/**
 * Renders explicit permanent-deletion confirmation without changing ownership rules.
 *
 * @param props - Target label, target type, staff reason requirement, and deletion callback.
 * @returns Accessible permanent deletion controls shared by products and collection items.
 */
export function PermanentDeletionControls({
  name,
  onDelete,
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
  const [confirmed, setConfirmed] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  return (
    <>
      <Button
        type="button"
        variant="destructive"
        onClick={() => dialog.current?.showModal()}
      >
        {action}
      </Button>
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="m-auto w-[min(36rem,calc(100%-2rem))] rounded-lg border border-border bg-card p-0 text-card-foreground shadow-xl backdrop:bg-black/50"
        onCancel={(event) => {
          if (submitting) event.preventDefault();
        }}
        onClose={() => {
          setConfirmed(false);
          setReason("");
          setFailure(null);
        }}
      >
        <form
          className="grid gap-5 p-6"
          onSubmit={async (event) => {
            event.preventDefault();
            if (submitting || !confirmed || (reasonRequired && !reason.trim()))
              return;
            setSubmitting(true);
            setFailure(null);
            try {
              await onDelete(reasonRequired ? reason.trim() : undefined);
              dialog.current?.close();
            } catch (error) {
              setFailure(
                error instanceof Error &&
                  !item &&
                  error.message === "web.catalog.deletion.blocked"
                  ? error.message
                  : item
                    ? "error.generic"
                    : "web.catalog.deletion.failed",
              );
            } finally {
              setSubmitting(false);
            }
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
                onChange={(event) => setReason(event.target.value)}
              />
            </div>
          ) : null}
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 size-4"
              checked={confirmed}
              disabled={submitting}
              onChange={(event) => setConfirmed(event.target.checked)}
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
              onClick={() => dialog.current?.close()}
            >
              {t("action.cancel")}
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={
                submitting || !confirmed || (reasonRequired && !reason.trim())
              }
            >
              {action}
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
