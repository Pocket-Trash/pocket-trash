import {
  formatTranslation,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { Link } from "@tanstack/react-router";
import { Bell, Flag, MessageSquare, ShieldCheck, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useLocale } from "@/providers/locale-provider";

export function AdminIndexPage() {
  const { locale } = useLocale();
  const t = (key: TranslationKey) => formatTranslation(key, {}, locale);
  const feedbackLink = {
    icon: MessageSquare,
    label: t("web.feedback.title"),
    to: "/admin/feedback" as const,
  };
  const notificationsLink = {
    icon: Bell,
    label: t("web.admin.notifications.title"),
    to: "/notifications" as const,
  };
  const primaryLinks = [feedbackLink, notificationsLink];
  const sidebarLinks = [notificationsLink, feedbackLink];
  const utilityLinks = [
    {
      icon: Flag,
      label: t("web.admin.featureFlags.featureFlags"),
      to: "/admin/settings/feature-flags" as const,
    },
    {
      icon: Trash2,
      label: t("web.admin.trash.title"),
      to: "/admin/trash" as const,
    },
  ];

  return (
    <AppShell title={t("web.admin.hub.title")}>
      <main className="grid w-full flex-1 md:grid-cols-[12rem_minmax(0,1fr)]">
        <aside className="border-b border-border bg-muted/20 p-3 md:border-r md:border-b-0">
          <nav
            aria-label={t("web.admin.hub.title")}
            className="flex h-full flex-col gap-6"
          >
            <div className="grid gap-1">
              {sidebarLinks.map(({ icon: Icon, label, to }) => (
                <Link
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  key={to}
                  to={to}
                >
                  <Icon aria-hidden="true" className="size-4" />
                  {label}
                </Link>
              ))}
            </div>
            <div className="grid gap-1 md:mt-auto">
              {utilityLinks.map(({ icon: Icon, label, to }) => (
                <Link
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  key={to}
                  to={to}
                >
                  <Icon aria-hidden="true" className="size-4" />
                  {label}
                </Link>
              ))}
            </div>
          </nav>
        </aside>
        <section
          aria-label={t("web.admin.hub.description")}
          className="grid content-start gap-4 p-4 md:p-6"
        >
          <div className="flex items-center gap-3">
            <ShieldCheck aria-hidden="true" className="size-6" />
            <p className="m-0 text-sm text-muted-foreground">
              {t("web.admin.hub.description")}
            </p>
          </div>
          <div className="grid w-full max-w-2xl gap-3 sm:grid-cols-2">
            {primaryLinks.map(({ icon: Icon, label, to }) => (
              <Link
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-5 text-card-foreground hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                key={to}
                to={to}
              >
                <Icon aria-hidden="true" className="size-5" />
                <span className="font-semibold">{label}</span>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </AppShell>
  );
}
