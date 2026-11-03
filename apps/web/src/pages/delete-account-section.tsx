import { useAuth, useReverification } from "@clerk/tanstack-react-start";
import {
  formatTranslation,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { useForm, useStore } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useConfirmedDeletion } from "@/hooks/use-confirmed-deletion";
import { requestSelfErasure } from "@/lib/account-erasure";
import { useLocale } from "@/providers/locale-provider";

/**
 * Renders the confirmed, reverified account-deletion flow.
 *
 * @returns The account-deletion section and confirmation dialog.
 */
export function DeleteAccountSection() {
  const { userId } = useAuth();
  return <DeleteAccountForm key={userId} />;
}

/**
 * Owns one account's explicit confirmation and strict-reverification lifetime.
 * @returns Scoped self-erasure confirmation.
 */
function DeleteAccountForm() {
  const dialog = useRef<HTMLDialogElement>(null);
  const { locale } = useLocale();
  const navigate = useNavigate();
  const startErasure = useReverification(requestSelfErasure);
  /**
   * Formats localized account-deletion copy.
   *
   * @param key - Translation key.
   * @returns The localized message.
   */
  const t = (key: TranslationKey) => formatTranslation(key, {}, locale);

  const form = useForm({
    defaultValues: { confirmed: false },
    validators: {
      /**
       * Requires the existing explicit account-erasure confirmation.
       * @param input - Current confirmation field.
       * @returns Existing failure feedback when unconfirmed.
       */
      onSubmit: ({ value }): string | undefined =>
        value.confirmed ? undefined : "web.erasure.self.failure",
    },
    /** Queues only a validated, explicitly confirmed erasure request. */
    onSubmit: () => {
      deletion.confirm();
    },
  });
  const confirmed = useStore(form.store, (state) => state.values.confirmed);
  const failed = useStore(form.store, (state) =>
    Boolean(state.errorMap.onSubmit),
  );
  const eligible = useStore(
    form.store,
    (state) => state.values.confirmed && !state.isSubmitting,
  );
  const deletion = useConfirmedDeletion(
    async () => {
      await startErasure({ data: { confirmed: true } });
    },
    () => navigate({ to: "/account-erasure" }),
    () => {
      form.setErrorMap({ onSubmit: "web.erasure.self.failure" });
    },
  );
  const submitting = deletion.submitting;
  /** Dismisses only explicit user intent and resets its confirmation. */
  const dismiss = () => {
    if (submitting) return;
    form.reset();
    deletion.dismiss();
  };
  /**
   * Owns the committed confirmation dialog without treating Activity cleanup as cancellation.
   * @param node - Current dialog node.
   * @returns Cleanup closing only the current DOM dialog.
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
    <section className="mt-8 grid gap-4 rounded-lg border border-destructive/40 bg-card p-6 shadow-sm">
      <div className="grid gap-1">
        <h2 className="m-0 text-lg font-semibold text-destructive">
          {t("web.erasure.self.title")}
        </h2>
        <p className="m-0 text-sm text-muted-foreground">
          {t("web.erasure.self.description")}
        </p>
      </div>
      <Button
        className="justify-self-start"
        onClick={() => {
          if (deletion.open) return;
          form.reset();
          deletion.openConfirmation();
        }}
        type="button"
        variant="destructive"
      >
        {t("web.erasure.self.open")}
      </Button>
      {deletion.open ? (
        <dialog
          aria-labelledby="delete-account-title"
          className="m-auto w-[min(36rem,calc(100%-2rem))] rounded-lg border border-border bg-card p-0 text-card-foreground shadow-xl backdrop:bg-black/50"
          ref={bindDialog}
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
            <div className="grid gap-2">
              <h2
                className="m-0 text-xl font-semibold"
                id="delete-account-title"
              >
                {t("web.erasure.self.dialogTitle")}
              </h2>
              <p className="m-0 text-sm font-medium">
                {t("web.erasure.self.dialogIntro")}
              </p>
            </div>
            <ul className="m-0 grid gap-2 pl-5 text-sm text-muted-foreground">
              <li>{t("web.erasure.self.deletedData")}</li>
              <li>{t("web.erasure.self.productsRemain")}</li>
              <li>{t("web.erasure.self.retention")}</li>
              <li>{t("web.erasure.self.publicCopies")}</li>
            </ul>
            <label className="flex items-start gap-3 text-sm">
              <input
                checked={confirmed}
                className="mt-0.5 size-4"
                disabled={submitting}
                onChange={(event) =>
                  form.setFieldValue("confirmed", event.target.checked)
                }
                type="checkbox"
              />
              <span>{t("web.erasure.self.confirm")}</span>
            </label>
            {failed ? (
              <p aria-live="polite" className="m-0 text-sm text-destructive">
                {t("web.erasure.self.failure")}
              </p>
            ) : null}
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                disabled={submitting}
                onClick={dismiss}
                type="button"
                variant="outline"
              >
                {t("action.cancel")}
              </Button>
              <Button
                disabled={!eligible || submitting}
                type="submit"
                variant="destructive"
              >
                {t("web.erasure.self.submit")}
              </Button>
            </div>
          </form>
        </dialog>
      ) : null}
    </section>
  );
}
