import { useAuth } from "@clerk/tanstack-react-start";
import {
  faCircleCheck,
  faSpinnerScale,
  faTriangleExclamation,
} from "@fortawesome/pro-light-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  formatTranslation,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { Link, Navigate } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Button, buttonVariants } from "@/components/ui/button";
import { useErasurePolling } from "@/hooks/use-erasure-polling";
import type { ErasureStatusView } from "@/lib/account-erasure";
import { useLocale } from "@/providers/locale-provider";

/**
 * Polls and renders the current self-erasure request status.
 *
 * @param root0 - Initial erasure status.
 * @returns The live account-erasure status page.
 */
export function AccountErasureStatusPage({
  initialStatus,
  actorId,
}: {
  /** Account that authorized the loader snapshot. */
  actorId?: string | null;
  /** Status loaded for the active erasure request. */
  initialStatus: ErasureStatusView;
}) {
  const { userId, isLoaded, isSignedIn } = useAuth();
  if (isLoaded && !isSignedIn) return <Navigate to="/account-erased" replace />;
  if (actorId !== undefined && actorId !== userId) return null;
  return <SelfErasureStatus key={userId} initialStatus={initialStatus} />;
}

/**
 * Owns one current account's receipt polling lifetime.
 * @param props - Current account receipt.
 * @returns Current self-erasure progress.
 */
function SelfErasureStatus({
  initialStatus,
}: {
  /** Current authorized receipt. */
  initialStatus: ErasureStatusView;
}) {
  const { status } = useErasurePolling(initialStatus, "self");
  return <AccountErasureState status={status ?? initialStatus} />;
}

/**
 * Renders one account-erasure status and its available next action.
 *
 * @param root0 - Erasure status properties.
 * @returns The account-erasure status UI.
 */
export function AccountErasureState({
  status,
}: {
  /** Current erasure request status. */
  status: ErasureStatusView;
}) {
  const { locale } = useLocale();
  /**
   * Formats localized account-erasure copy.
   *
   * @param key - Translation key.
   * @param params - Translation interpolation values.
   * @returns The localized message.
   */
  const t = (
    key: TranslationKey,
    params: Record<string, number | string> = {},
  ) => formatTranslation(key, params, locale);
  const copy =
    status.status === "needs_support"
      ? {
          description: "web.erasure.status.needsSupportDescription" as const,
          icon: faTriangleExclamation,
          title: "web.erasure.status.needsSupport" as const,
        }
      : status.status === "completed"
        ? {
            description: "web.erasure.status.completedDescription" as const,
            icon: faCircleCheck,
            title: "web.erasure.status.completed" as const,
          }
        : {
            description: "web.erasure.status.processingDescription" as const,
            icon: faSpinnerScale,
            title: "web.erasure.status.processing" as const,
          };
  return (
    <AppShell title={t("web.erasure.status.title")}>
      <main
        aria-live="polite"
        className="grid max-w-2xl gap-5 px-4 py-12 md:px-6"
      >
        <FontAwesomeIcon
          aria-hidden="true"
          className={
            status.status === "processing" ? "size-8 animate-spin" : "size-8"
          }
          icon={copy.icon}
        />
        <div className="grid gap-2">
          <h2 className="m-0 text-2xl font-semibold">{t(copy.title)}</h2>
          <p className="m-0 text-muted-foreground">{t(copy.description)}</p>
        </div>
        <code className="w-fit rounded bg-muted px-3 py-2 text-sm">
          {t("web.erasure.status.requestId", { requestId: status.requestId })}
        </code>
        {status.status === "needs_support" ? (
          <a
            className={buttonVariants({ className: "justify-self-start" })}
            href="https://www.reddit.com/user/BVG_Digital/"
            rel="noopener"
            target="_blank"
          >
            {t("web.erasure.status.support")}
          </a>
        ) : null}
      </main>
    </AppShell>
  );
}

/**
 * Renders the confirmation shown after account erasure completes.
 *
 * @returns The completed account-erasure page.
 */
export function AccountErasedPage() {
  const { locale } = useLocale();
  /**
   * Formats localized completion copy.
   *
   * @param key - Translation key.
   * @returns The localized message.
   */
  const t = (key: TranslationKey) => formatTranslation(key, {}, locale);
  return (
    <AppShell title={t("web.erasure.status.title")}>
      <main className="grid max-w-2xl gap-5 px-4 py-12 md:px-6">
        <FontAwesomeIcon
          aria-hidden="true"
          className="size-8"
          icon={faCircleCheck}
        />
        <div className="grid gap-2">
          <h2 className="m-0 text-2xl font-semibold">
            {t("web.erasure.status.completed")}
          </h2>
          <p className="m-0 text-muted-foreground">
            {t("web.erasure.status.completedDescription")}
          </p>
        </div>
        <Button
          className="justify-self-start"
          nativeButton={false}
          render={<Link to="/" />}
          variant="outline"
        >
          {t("web.page.error.returnHome")}
        </Button>
      </main>
    </AppShell>
  );
}
