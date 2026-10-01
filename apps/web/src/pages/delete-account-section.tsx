import { useReverification } from "@clerk/tanstack-react-start";
import {
  formatTranslation,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { requestSelfErasure } from "@/lib/account-erasure";
import { useLocale } from "@/providers/locale-provider";

/**
 * Renders the confirmed, reverified account-deletion flow.
 *
 * @returns The account-deletion section and confirmation dialog.
 */
export function DeleteAccountSection() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);
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
        onClick={() => dialog.current?.showModal()}
        type="button"
        variant="destructive"
      >
        {t("web.erasure.self.open")}
      </Button>
      <dialog
        aria-labelledby="delete-account-title"
        className="m-auto w-[min(36rem,calc(100%-2rem))] rounded-lg border border-border bg-card p-0 text-card-foreground shadow-xl backdrop:bg-black/50"
        ref={dialog}
      >
        <form
          className="grid gap-5 p-6"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!confirmed || submitting) return;
            setFailed(false);
            setSubmitting(true);
            try {
              await startErasure({ data: { confirmed: true } });
              dialog.current?.close();
              await navigate({ to: "/account-erasure" });
            } catch {
              setFailed(true);
              setSubmitting(false);
            }
          }}
        >
          <div className="grid gap-2">
            <h2 className="m-0 text-xl font-semibold" id="delete-account-title">
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
              onChange={(event) => setConfirmed(event.target.checked)}
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
              onClick={() => dialog.current?.close()}
              type="button"
              variant="outline"
            >
              {t("action.cancel")}
            </Button>
            <Button
              disabled={!confirmed || submitting}
              type="submit"
              variant="destructive"
            >
              {t("web.erasure.self.submit")}
            </Button>
          </div>
        </form>
      </dialog>
    </section>
  );
}
