import { useAuth } from "@clerk/tanstack-react-start";
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
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useErasurePolling } from "@/hooks/use-erasure-polling";
import {
  type AdminErasureStatusView,
  type ErasureTarget,
  findErasureTarget,
  requestAdminErasure,
  retryAdminErasure,
} from "@/lib/account-erasure";
import { useLocale } from "@/providers/locale-provider";

/** Current verified target, receipt, and independent operation lifetimes. */
type AdminErasureState = {
  /** Current verified target identity. */
  target: ErasureTarget | null;
  /** Receipt supplied to the polling owner after create/retry. */
  receipt: AdminErasureStatusView | null;
  /** Explicit create/retry generation, including same-ID retries. */
  receiptRevision: number;
  /** Monotonic lookup/target operation lifetime. */
  revision: number;
  /** Current cancellable target lookup. */
  finding: EffectEntity<AdminErasureState, AdminErasureEvent> | undefined;
  /** Current confirmed request/retry mutation. */
  action: EffectEntity<AdminErasureState, AdminErasureEvent> | undefined;
  /** Existing target-not-found feedback. */
  notFound: boolean;
  /** Existing operation failure feedback. */
  failed: boolean;
};
/** Form-owned bounded verification evidence. */
type ErasureVerification = {
  /** Existing verified request method. */
  method: "authenticated_request" | "verified_email";
  /** Existing opaque verification reference. */
  reference: string;
};
/** Explicit target reconciliation and confirmed request/retry intent. */
type AdminErasureEvent =
  | {
      /** Disposes private target/request data when its lookup field changes. */
      type: "emailChanged";
    }
  | {
      /** Searches for a submitted verified email. */
      type: "lookupRequested";
      /** Submitted target email. */
      email: string;
    }
  | {
      /** Stops one current target lookup. */
      type: "lookupFinished";
      /** Lookup lifetime that completed. */
      revision: number;
      /** Verified target, or null when absent. */
      target: ErasureTarget | null;
      /** Whether lookup failed. */
      failed: boolean;
    }
  | {
      /** Requests confirmed erasure with bounded verification evidence. */
      type: "erasureRequested";
      /** Verified target email. */
      email: string;
      /** Captured verification evidence. */
      verification: ErasureVerification;
    }
  | {
      /** Retries the selected receipt after needs-support status. */
      type: "retryRequested";
      /** Current receipt identity. */
      requestId: string;
    }
  | {
      /** Stops one completed request/retry mutation. */
      type: "actionFinished";
      /** Target lifetime that completed. */
      revision: number;
      /** Current created/retried receipt, absent on failure. */
      receipt?: AdminErasureStatusView;
    };
/** Captured target lookup or confirmed privacy operation. */
type AdminErasureEffect = {
  /** Current target lifetime. */
  revision: number;
} & (
  | {
      /** Verified target lookup implementation. */
      type: "lookup";
      /** Submitted target email. */
      email: string;
    }
  | {
      /** Confirmed request creation implementation. */
      type: "create";
      /** Captured verified target identity. */
      target: ErasureTarget;
      /** Verified target email. */
      email: string;
      /** Bounded verification evidence. */
      verification: ErasureVerification;
    }
  | {
      /** Existing request retry implementation. */
      type: "retry";
      /** Current receipt identity. */
      requestId: string;
    }
);

/** Renders account-erasure lookup, request, and retry controls.
 *
 * @returns The account-erasure administration page.
 */
export function AdminAccountErasurePage() {
  const { userId } = useAuth();
  return <AdminErasureContent key={userId} />;
}

/**
 * Owns one administrator's verified target, confirmed request, and retry lifetimes.
 * @returns Scoped account-erasure administration.
 */
function AdminErasureContent() {
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
  const form = useForm({
    defaultValues: { email: "" },
    /**
     * Captures an explicit target lookup from the current email field.
     * @param input - Current lookup field.
     */
    onSubmit: ({ value }) => {
      dispatch({ type: "lookupRequested", email: value.email });
    },
  });
  const email = useStore(form.store, (state) => state.values.email);
  const task = useRef<{
    /** Confirmed mutation descriptor whose write must not replay. */
    effect: AdminErasureEffect;
    /** Retained privacy operation result. */
    promise: Promise<AdminErasureStatusView | undefined>;
  } | null>(null);
  /**
   * Observes one confirmed request/retry without replaying it across Activity.
   * @param _state - Current target/request controls.
   * @param effect - Captured verified privacy operation.
   * @param dispatch - Terminal dispatcher.
   * @param context - Current account/target observer lifetime.
   */
  const executeAction: EffectFunction<
    AdminErasureState,
    AdminErasureEvent,
    Extract<
      AdminErasureEffect,
      {
        /** Confirmed privacy operation discriminant. */
        type: "create" | "retry";
      }
    >
  > = (_state, effect, dispatch, { signal }) => {
    if (task.current?.effect !== effect)
      task.current = {
        effect,
        promise: (async (): Promise<AdminErasureStatusView | undefined> => {
          try {
            return await (effect.type === "create"
              ? requestAdminErasure({
                  data: {
                    email: effect.email,
                    targetClerkId: effect.target.clerkId,
                    verificationMethod: effect.verification.method,
                    verificationReference: effect.verification.reference,
                  },
                })
              : retryAdminErasure({ data: { requestId: effect.requestId } }));
          } catch {
            return undefined;
          }
        })(),
      };
    void task.current.promise.then((receipt) => {
      if (!signal.aborted)
        dispatch({
          type: "actionFinished",
          revision: effect.revision,
          receipt,
        });
    });
  };
  const [state, dispatch] = useEffectReducer<
    AdminErasureState,
    AdminErasureEvent,
    AdminErasureEffect
  >(
    (state, event, exec) => {
      if (event.type === "emailChanged") {
        exec.stop(state.finding);
        exec.stop(state.action);
        return {
          target: null,
          receipt: null,
          receiptRevision: state.receiptRevision + 1,
          revision: state.revision + 1,
          finding: undefined,
          action: undefined,
          notFound: false,
          failed: false,
        };
      }
      if (event.type === "lookupRequested") {
        exec.stop(state.action);
        const revision = state.revision + 1;
        return {
          ...state,
          target: null,
          receipt: null,
          receiptRevision: state.receiptRevision + 1,
          revision,
          action: undefined,
          notFound: false,
          failed: false,
          finding: exec.replace(state.finding, {
            type: "lookup",
            email: event.email,
            revision,
          }),
        };
      }
      if (event.type === "lookupFinished") {
        if (event.revision !== state.revision || !state.finding) return state;
        exec.stop(state.finding);
        return {
          ...state,
          finding: undefined,
          target: event.target,
          notFound: !event.failed && !event.target,
          failed: event.failed,
        };
      }
      if (event.type === "erasureRequested")
        return !state.target || state.action || state.finding
          ? state
          : {
              ...state,
              failed: false,
              action: exec({
                type: "create",
                target: state.target,
                email: event.email,
                verification: event.verification,
                revision: state.revision,
              }),
            };
      if (event.type === "retryRequested")
        return state.action || state.receipt?.requestId !== event.requestId
          ? state
          : {
              ...state,
              failed: false,
              action: exec({
                type: "retry",
                requestId: event.requestId,
                revision: state.revision,
              }),
            };
      if (event.revision !== state.revision || !state.action) return state;
      exec.stop(state.action);
      return {
        ...state,
        action: undefined,
        receipt: event.receipt ?? state.receipt,
        receiptRevision: state.receiptRevision + (event.receipt ? 1 : 0),
        failed: !event.receipt,
      };
    },
    {
      target: null,
      receipt: null,
      receiptRevision: 0,
      revision: 0,
      finding: undefined,
      action: undefined,
      notFound: false,
      failed: false,
    },
    {
      /**
       * Reads a verified target only through the current email/account observer.
       * @param _state - Current target lookup controls.
       * @param effect - Captured email and lookup lifetime.
       * @param dispatch - Terminal lookup dispatcher.
       * @param context - Current cancellation lifetime.
       */
      lookup: (_state, effect, dispatch, { signal }) => {
        void findErasureTarget({ data: { email: effect.email }, signal }).then(
          (target) => {
            if (!signal.aborted)
              dispatch({
                type: "lookupFinished",
                revision: effect.revision,
                target,
                failed: false,
              });
          },
          () => {
            if (!signal.aborted)
              dispatch({
                type: "lookupFinished",
                revision: effect.revision,
                target: null,
                failed: true,
              });
          },
        );
      },
      create: executeAction,
      retry: executeAction,
    },
  );
  const { status: request, failed: pollFailed } = useErasurePolling(
    state.receipt,
    "admin",
    state.receiptRevision,
  );
  const { target, notFound } = state;
  const finding = Boolean(state.finding);
  const saving = Boolean(state.action);
  const failed = state.failed || pollFailed;
  const errorCode =
    request && "errorCode" in request ? request.errorCode : null;
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
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
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
                form.setFieldValue("email", event.target.value);
                dispatch({ type: "emailChanged" });
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
            key={target.clerkId}
            onRequest={(verification) =>
              dispatch({ type: "erasureRequested", email, verification })
            }
            saving={saving}
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
            {errorCode ? (
              <p className="m-0 text-sm text-destructive">
                {t("web.erasure.admin.errorLabel", {
                  errorCode,
                })}
              </p>
            ) : null}
            {request.status === "needs_support" ? (
              <Button
                className="justify-self-start"
                disabled={saving}
                onClick={() =>
                  dispatch({
                    type: "retryRequested",
                    requestId: request.requestId,
                  })
                }
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
 * @param props.onRequest - Queues one validated, verified erasure intent.
 * @param props.saving - Whether an erasure request is being created.
 * @param props.t - Localizes form copy.
 * @param props.target - Clerk account selected for erasure.
 * @returns The administrator erasure-request form.
 */
function AdminTargetForm({
  onRequest,
  saving,
  t,
  target,
}: {
  /**
   * Queues one confirmed request with the existing bounded verification evidence.
   * @param verification - Validated request method and opaque reference.
   */
  onRequest(verification: ErasureVerification): void;
  /** Whether a confirmed erasure request is being created. */
  saving: boolean;
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
  const form = useForm({
    defaultValues: {
      method: "authenticated_request",
      reference: "",
    } as ErasureVerification,
    validators: {
      /**
       * Preserves the existing bounded opaque-reference constraint before confirmation.
       * @param input - Current verification evidence.
       * @returns Existing failure feedback for invalid references.
       */
      onSubmit: ({ value }): string | undefined =>
        value.reference.length <= 120 &&
        /^[A-Za-z0-9:_-]+$/.test(value.reference)
          ? undefined
          : t("web.erasure.admin.failure"),
    },
    /**
     * Captures one validated verification intent for its current selected target.
     * @param input - Current bounded verification evidence.
     */
    onSubmit: ({ value }) => {
      if (!saving) onRequest(value);
    },
  });
  const { method, reference } = useStore(form.store, (state) => state.values);
  const eligible = useStore(
    form.store,
    (state) =>
      !state.isSubmitting &&
      state.values.reference.length <= 120 &&
      /^[A-Za-z0-9:_-]+$/.test(state.values.reference),
  );
  const error = useStore(form.store, (state) => state.errorMap.onSubmit);

  return (
    <form
      className="grid gap-4 rounded-lg border border-destructive/40 bg-card p-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (saving) return;
        form.setErrorMap({ onSubmit: undefined });
        void form.handleSubmit();
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
          disabled={saving}
          onChange={(event) =>
            form.setFieldValue(
              "method",
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
          disabled={saving}
          maxLength={120}
          onChange={(event) =>
            form.setFieldValue("reference", event.target.value)
          }
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
      {error ? (
        <p aria-live="polite" className="m-0 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button
        className="justify-self-start"
        disabled={saving || !eligible}
        type="submit"
        variant="destructive"
      >
        {t(saving ? "web.erasure.admin.starting" : "web.erasure.admin.start")}
      </Button>
    </form>
  );
}
