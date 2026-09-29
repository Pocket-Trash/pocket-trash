import { useClerk } from "@clerk/tanstack-react-start";
import {
  formatTranslation,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { Link } from "@tanstack/react-router";
import { CircleCheck, LoaderCircle, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  type ErasureStatusView,
  getSelfErasureStatus,
} from "@/lib/account-erasure";
import { useLocale } from "@/providers/locale-provider";

export function AccountErasureStatusPage({
  initialStatus,
}: {
  initialStatus: ErasureStatusView;
}) {
  const [status, setStatus] = useState(initialStatus);
  const clerk = useClerk();

  useEffect(() => {
    if (status.status !== "processing") return;
    const interval = window.setInterval(() => {
      void getSelfErasureStatus()
        .then((next) => {
          if (next === "signed_out") {
            void clerk.signOut({ redirectUrl: "/account-erased" });
            return;
          }
          if (next) setStatus(next);
        })
        .catch(() => undefined);
    }, 3000);
    return () => window.clearInterval(interval);
  }, [clerk, status.status]);

  return <AccountErasureState status={status} />;
}

export function AccountErasureState({ status }: { status: ErasureStatusView }) {
  const { locale } = useLocale();
  const t = (
    key: TranslationKey,
    params: Record<string, number | string> = {},
  ) => formatTranslation(key, params, locale);
  const copy =
    status.status === "needs_support"
      ? {
          description: "web.erasure.status.needsSupportDescription" as const,
          icon: TriangleAlert,
          title: "web.erasure.status.needsSupport" as const,
        }
      : status.status === "completed"
        ? {
            description: "web.erasure.status.completedDescription" as const,
            icon: CircleCheck,
            title: "web.erasure.status.completed" as const,
          }
        : {
            description: "web.erasure.status.processingDescription" as const,
            icon: LoaderCircle,
            title: "web.erasure.status.processing" as const,
          };
  const Icon = copy.icon;

  return (
    <AppShell title={t("web.erasure.status.title")}>
      <main
        aria-live="polite"
        className="grid max-w-2xl gap-5 px-4 py-12 md:px-6"
      >
        <Icon
          aria-hidden="true"
          className={
            status.status === "processing" ? "size-8 animate-spin" : "size-8"
          }
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

export function AccountErasedPage() {
  const { locale } = useLocale();
  const t = (key: TranslationKey) => formatTranslation(key, {}, locale);
  return (
    <AppShell title={t("web.erasure.status.title")}>
      <main className="grid max-w-2xl gap-5 px-4 py-12 md:px-6">
        <CircleCheck aria-hidden="true" className="size-8" />
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
