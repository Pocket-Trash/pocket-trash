import {
  formatTranslation,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { AdminPageShell } from "@/components/admin-page-shell";
import { useLocale } from "@/providers/locale-provider";

export function AdminNotificationsIndexPage() {
  const { sessionClaims, userId } = useAuth();
  const actor = userId ? normalizeActor(userId, sessionClaims) : undefined;
  const { locale } = useLocale();
  const t = (key: TranslationKey) => formatTranslation(key, {}, locale);
  const links = [
    ...(hasPermission(actor, "feedback.manage")
      ? [
          {
            label: t("web.feedback.notification.title"),
            to: "/admin/notifications/feedback" as const,
          },
        ]
      : []),
    ...(hasPermission(actor, "resources.manage")
      ? [
          {
            label: t("web.resources.notification.title"),
            to: "/admin/notifications/resources" as const,
          },
        ]
      : []),
  ];

  return (
    <AdminPageShell
      breadcrumbItems={[{ label: t("web.navigation.admin"), to: "/admin" }]}
      section="notifications"
      title={t("web.admin.notifications.title")}
    >
      <main className="grid w-full max-w-3xl gap-3 p-4 md:grid-cols-2 md:p-6">
        {links.map(({ label, to }) => (
          <Link
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-5 text-card-foreground hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            key={to}
            to={to}
          >
            <Bell aria-hidden="true" className="size-5" />
            <span className="font-semibold">{label}</span>
          </Link>
        ))}
      </main>
    </AdminPageShell>
  );
}

import { useAuth } from "@clerk/tanstack-react-start";
import { hasPermission, normalizeActor } from "@package/services/authorization";
