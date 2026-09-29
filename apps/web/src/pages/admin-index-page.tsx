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
  MessageSquare,
  PackageX,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useLocale } from "@/providers/locale-provider";

export function AdminIndexPage() {
  const { locale } = useLocale();
  const t = (key: TranslationKey) => formatTranslation(key, {}, locale);
  const sidebarSections = [
    {
      icon: MessageSquare,
      label: t("web.feedback.title"),
      links: [
        {
          icon: ListTodo,
          label: t("web.feedback.admin.navigation.allActive"),
          to: "/admin/feedback" as const,
        },
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
      ],
      to: "/admin/feedback" as const,
    },
    {
      icon: Bell,
      label: t("web.admin.notifications.title"),
      links: [
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
      ],
      to: "/notifications" as const,
    },
    {
      icon: Flag,
      label: t("web.admin.featureFlags.featureFlags"),
      links: [],
      to: "/admin/settings/feature-flags" as const,
    },
    {
      icon: Trash2,
      label: t("web.admin.trash.title"),
      links: [
        {
          icon: PackageX,
          label: t("web.resources.trash.adminTitle"),
          to: "/admin/trash/resources" as const,
        },
        {
          icon: ImageOff,
          label: t("web.admin.hub.catalogImageTrash"),
          to: "/admin/trash/catalog-images" as const,
        },
      ],
      to: "/admin/trash" as const,
    },
  ];
  const mainLinks = [
    {
      icon: MessageSquare,
      label: t("web.feedback.title"),
      to: "/admin/feedback" as const,
    },
    {
      icon: Bell,
      label: t("web.admin.notifications.title"),
      to: "/notifications" as const,
    },
  ];

  return (
    <AppShell title={t("web.admin.hub.title")}>
      <main className="grid w-full max-w-6xl gap-6 p-4 md:grid-cols-[16rem_minmax(0,1fr)] md:p-6">
        <aside>
          <nav aria-label={t("web.admin.hub.title")} className="grid gap-3">
            {sidebarSections.map(
              ({ icon: Icon, label, links, to: sectionTo }) => (
                <div key={sectionTo}>
                  <Link
                    className={`flex items-center gap-3 border border-border bg-card px-4 py-3 font-semibold text-card-foreground hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      links.length ? "rounded-t-lg" : "rounded-lg"
                    }`}
                    to={sectionTo}
                  >
                    <Icon aria-hidden="true" className="size-5" />
                    {label}
                  </Link>
                  {links.length ? (
                    <ul className="m-0 grid list-none gap-1 rounded-b-lg border-x border-b border-border bg-card px-3 py-2 text-sm text-muted-foreground">
                      {links.map(({ icon: LinkIcon, label: linkLabel, to }) => (
                        <li key={to}>
                          <Link
                            className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            to={to}
                          >
                            <LinkIcon aria-hidden="true" className="size-3.5" />
                            {linkLabel}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ),
            )}
          </nav>
        </aside>
        <section
          aria-label={t("web.admin.hub.description")}
          className="grid content-start gap-4"
        >
          <div className="flex items-center gap-3">
            <ShieldCheck aria-hidden="true" className="size-6" />
            <p className="m-0 text-sm text-muted-foreground">
              {t("web.admin.hub.description")}
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {mainLinks.map(({ icon: Icon, label, to }) => (
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
