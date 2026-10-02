import {
  formatTranslation,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type AdminErasureStatusView,
  type ErasureTarget,
  findErasureTarget,
  getAdminErasureStatus,
  requestAdminErasure,
  retryAdminErasure,
} from "@/lib/account-erasure";
import { useLocale } from "@/providers/locale-provider";

/** Renders account-erasure lookup, request, and retry controls.
 *
 * @returns The account-erasure administration page.
 */
export function AdminAccountErasurePage() {
  const { locale } = useLocale();
  /** Formats account-erasure copy for the active locale.
   *
   * @param key - Translation key to format.
   * @param params - Values interpolated into the translation.
   * @returns Localized account-erasure copy.
   */
  const t = (
    key: TranslationKey,
    params: Record<string, number | string> = {},
  ) => formatTranslation(key, params, locale);
  const [email, setEmail] = useState("");
  const [target, setTarget] = useState<ErasureTarget | null>(null);
  const [request, setRequest] = useState<AdminErasureStatusView | null>(null);
  const [finding, setFinding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (request?.status !== "processing") return;
    const interval = window.setInterval(() => {
      void getAdminErasureStatus({ data: { requestId: request.requestId } })
        .then((next) => {
          if (next) setRequest(next);
        })
        .catch(() => setFailed(true));
    }, 3000);
    return () => window.clearInterval(interval);
  }, [request]);

  const statusCopy = request
    ? t(
        request.status === "completed"
          ? "web.erasure.status.completed"
          : request.status === "needs_support"
            ? "web.erasure.status.needsSupport"
            : "web.erasure.status.processing",
      )
    : "";

  return (
    <AppShell title={t("web.erasure.admin.title")}>
      <main className="grid max-w-3xl gap-6 px-4 py-6 md:px-6">
        <p className="m-0 text-sm text-muted-foreground">
          {t("web.erasure.admin.description")}
        </p>
        <form
          className="grid gap-4 rounded-lg border border-border bg-card p-5"
          onSubmit={async (event) => {
            event.preventDefault();
            setFinding(true);
            setFailed(false);
            setNotFound(false);
            try {
              const result = await findErasureTarget({ data: { email } });
              setTarget(result);
              setNotFound(!result);
            } catch {
              setFailed(true);
            } finally {
              setFinding(false);
            }
          }}
        >
          <label
            className="grid gap-2 text-sm font-medium"
            htmlFor="erasure-email"
          >
            {t("web.erasure.admin.emailLabel")}
            <Input
              autoComplete="off"
              id="erasure-email"
              onChange={(event) => {
                setEmail(event.target.value);
                setTarget(null);
                setRequest(null);
              }}
              placeholder={t("web.erasure.admin.emailPlaceholder")}
              required
              type="email"
              value={email}
            />
          </label>
          <Button
            className="justify-self-start"
            disabled={finding}
            type="submit"
          >
            {t(
              finding
                ? "web.erasure.admin.findingTarget"
                : "web.erasure.admin.findTarget",
            )}
          </Button>
          {notFound ? (
            <p aria-live="polite" className="m-0 text-sm text-destructive">
              {t("web.erasure.admin.targetNotFound")}
            </p>
          ) : null}
        </form>

        {target && !request ? (
          <AdminTargetForm
            email={email}
            onCreated={setRequest}
            onFailed={() => setFailed(true)}
            saving={saving}
            setSaving={setSaving}
            t={t}
            target={target}
          />
        ) : null}

        {request ? (
          <section
            aria-live="polite"
            className="grid gap-3 rounded-lg border border-border bg-card p-5"
          >
            <h2 className="m-0 text-lg font-semibold">
              {t("web.erasure.admin.requestTitle")}
            </h2>
            {target ? (
              <p className="m-0 text-sm">
                <span className="font-medium">
                  {t("web.erasure.admin.targetLabel")}:
                </span>{" "}
                {target.name} ({target.email})
              </p>
            ) : null}
            <p className="m-0 text-sm">
              {t("web.erasure.admin.statusLabel", { status: statusCopy })}
            </p>
            <code className="w-fit rounded bg-muted px-3 py-2 text-sm">
              {t("web.erasure.status.requestId", {
                requestId: request.requestId,
              })}
            </code>
            {request.errorCode ? (
              <p className="m-0 text-sm text-destructive">
                {t("web.erasure.admin.errorLabel", {
                  errorCode: request.errorCode,
                })}
              </p>
            ) : null}
            {request.status === "needs_support" ? (
              <Button
                className="justify-self-start"
                disabled={saving}
                onClick={async () => {
                  setSaving(true);
                  setFailed(false);
                  try {
                    setRequest(
                      await retryAdminErasure({
                        data: { requestId: request.requestId },
                      }),
                    );
                  } catch {
                    setFailed(true);
                  } finally {
                    setSaving(false);
                  }
                }}
                type="button"
              >
                {t(
                  saving
                    ? "web.erasure.admin.retrying"
                    : "web.erasure.admin.retry",
                )}
              </Button>
            ) : null}
          </section>
        ) : null}

        {failed ? (
          <p aria-live="polite" className="m-0 text-sm text-destructive">
            {t("web.erasure.admin.failure")}
          </p>
        ) : null}
      </main>
    </AppShell>
  );
}

/** Renders the verified erasure-request form for a selected account.
 *
 * @param props - Target form properties.
 * @param props.email - Verified target email address.
 * @param props.onCreated - Receives the newly created erasure request.
 * @param props.onFailed - Reports request creation failure.
 * @param props.saving - Whether an erasure request is being created.
 * @param props.setSaving - Updates the shared saving state.
 * @param props.t - Localizes form copy.
 * @param props.target - Clerk account selected for erasure.
 * @returns The administrator erasure-request form.
 */
function AdminTargetForm({
  email,
  onCreated,
  onFailed,
  saving,
  setSaving,
  t,
  target,
}: {
  /** Verified target email address. */
  email: string;
  /** Reports a newly created erasure request.
   *
   * @param request - Created request status.
   */
  onCreated: (request: AdminErasureStatusView) => void;
  /** Reports that erasure request creation failed. */
  onFailed: () => void;
  /** Whether an erasure request is being created. */
  saving: boolean;
  /** Updates the shared saving state.
   *
   * @param saving - Next saving state.
   */
  setSaving: (saving: boolean) => void;
  /** Formats account-erasure copy.
   *
   * @param key - Translation key to format.
   * @param params - Values interpolated into the translation.
   * @returns Localized account-erasure copy.
   */
  t: (key: TranslationKey, params?: Record<string, number | string>) => string;
  /** Clerk account selected for erasure. */
  target: ErasureTarget;
}) {
  const [method, setMethod] = useState<
    "authenticated_request" | "verified_email"
  >("authenticated_request");
  const [reference, setReference] = useState("");

  return (
    <form
      className="grid gap-4 rounded-lg border border-destructive/40 bg-card p-5"
      onSubmit={async (event) => {
        event.preventDefault();
        setSaving(true);
        try {
          onCreated(
            await requestAdminErasure({
              data: {
                email,
                targetClerkId: target.clerkId,
                verificationMethod: method,
                verificationReference: reference,
              },
            }),
          );
        } catch {
          onFailed();
        } finally {
          setSaving(false);
        }
      }}
    >
      <div className="grid gap-1 text-sm">
        <span className="font-medium">
          {t("web.erasure.admin.targetLabel")}
        </span>
        <span>{target.name}</span>
        <span>{target.email}</span>
        <code>{target.clerkId}</code>
      </div>
      <label
        className="grid gap-2 text-sm font-medium"
        htmlFor="verification-method"
      >
        {t("web.erasure.admin.verificationMethodLabel")}
        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          id="verification-method"
          onChange={(event) =>
            setMethod(
              event.target.value === "verified_email"
                ? "verified_email"
                : "authenticated_request",
            )
          }
          value={method}
        >
          <option value="authenticated_request">
            {t("web.erasure.admin.authenticatedRequest")}
          </option>
          <option value="verified_email">
            {t("web.erasure.admin.verifiedEmail")}
          </option>
        </select>
      </label>
      <label
        className="grid gap-2 text-sm font-medium"
        htmlFor="verification-reference"
      >
        {t("web.erasure.admin.referenceLabel")}
        <Input
          aria-describedby="verification-reference-help"
          id="verification-reference"
          maxLength={120}
          onChange={(event) => setReference(event.target.value)}
          pattern="[A-Za-z0-9:_-]+"
          required
          value={reference}
        />
      </label>
      <p
        className="m-0 text-xs text-muted-foreground"
        id="verification-reference-help"
      >
        {t("web.erasure.admin.referenceDescription")}
      </p>
      <Button
        className="justify-self-start"
        disabled={saving}
        type="submit"
        variant="destructive"
      >
        {t(saving ? "web.erasure.admin.starting" : "web.erasure.admin.start")}
      </Button>
    </form>
  );
}
