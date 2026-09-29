import {
  formatTranslation,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { Link } from "@tanstack/react-router";
import {
  Archive,
  Bell,
  Flag,
  ImageOff,
  Inbox,
  ListTodo,
  PackageX,
  ShieldCheck,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useLocale } from "@/providers/locale-provider";

export function AdminIndexPage() {
  const { locale } = useLocale();
  const t = (key: TranslationKey) => formatTranslation(key, {}, locale);
  const links = [
    {
      icon: Inbox,
      label: t("web.feedback.admin.navigation.requests"),
      to: "/admin/feedback/requests" as const,
    },
    {
      icon: ListTodo,
      label: t("web.feedback.admin.navigation.active"),
      to: "/admin/feedback/planned" as const,
    },
    {
      icon: Archive,
      label: t("web.feedback.admin.navigation.archive"),
      to: "/admin/feedback/archive" as const,
    },
    {
      icon: Bell,
      label: t("web.feedback.notification.title"),
      to: "/admin/notifications/feedback" as const,
    },
    {
      icon: Bell,
      label: t("web.resources.notification.title"),
      to: "/admin/notifications/resources" as const,
    },
    {
      icon: PackageX,
      label: t("web.resources.trash.adminTitle"),
      to: "/admin/resources/trash" as const,
    },
    {
      icon: ImageOff,
      label: t("web.admin.hub.catalogImageTrash"),
      to: "/admin/catalog-images/trash" as const,
    },
    {
      icon: Flag,
      label: t("web.admin.featureFlags.featureFlags"),
      to: "/admin/settings/feature-flags" as const,
    },
  ];

  return (
    <AppShell title={t("web.admin.hub.title")}>
      <main className="grid w-full max-w-4xl gap-4 p-4 md:p-6">
        <div className="flex items-center gap-3">
          <ShieldCheck aria-hidden="true" className="size-6" />
          <p className="m-0 text-sm text-muted-foreground">
            {t("web.admin.hub.description")}
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {links.map(({ icon: Icon, label, to }) => (
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
      </main>
    </AppShell>
  );
}
