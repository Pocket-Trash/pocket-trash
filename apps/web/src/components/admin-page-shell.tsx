import { useAuth } from "@clerk/tanstack-react-start";
import { hasPermission, normalizeActor } from "@package/services/authorization";
import {
  formatTranslation,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { Link } from "@tanstack/react-router";
import { Bell, Flag, MessageSquare, ScrollText, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { AppShell, type AppShellProps } from "@/components/app-shell";
import { useLocale } from "@/providers/locale-provider";

type AdminSection = "audit" | "feedback" | "notifications" | "trash";
type AdminPath =
  | "/admin/audit"
  | "/admin/feedback"
  | "/admin/feedback/archive"
  | "/admin/feedback/planned"
  | "/admin/feedback/requests"
  | "/admin/notifications/feedback"
  | "/admin/notifications/resources"
  | "/admin/settings/feature-flags"
  | "/admin/trash"
  | "/admin/trash/catalog-images"
  | "/admin/trash/resources"
  | "/notifications";

type AdminPageShellProps = Pick<AppShellProps, "breadcrumbItems" | "title"> & {
  children: ReactNode;
  section?: AdminSection;
};

export function AdminPageShell({
  breadcrumbItems,
  children,
  section,
  title,
}: AdminPageShellProps) {
  return (
    <AppShell breadcrumbItems={breadcrumbItems} title={title}>
      <div className="grid w-full flex-1 md:grid-cols-[12rem_minmax(0,1fr)]">
        <AdminSidebar section={section} />
        <div className="min-w-0">{children}</div>
      </div>
    </AppShell>
  );
}

function AdminSidebar({ section }: { section?: AdminSection }) {
  const { sessionClaims, userId } = useAuth();
  const actor = userId ? normalizeActor(userId, sessionClaims) : undefined;
  const canManageFeedback = hasPermission(actor, "feedback.manage");
  const canManageResources = hasPermission(actor, "resources.manage");
  const canManageCatalog =
    hasPermission(actor, "products.manage") ||
    hasPermission(actor, "collections.manage");
  const canManageFlags = hasPermission(actor, "feature_flags.manage");
  const canReadAudit = hasPermission(actor, "audit.read");
  const { locale } = useLocale();
  const t = (key: TranslationKey) => formatTranslation(key, {}, locale);
  const primaryLinks = [
    ...(canReadAudit
      ? [
          {
            icon: ScrollText,
            label: t("web.admin.audit.title"),
            section: "audit" as const,
            to: "/admin/audit" as const,
          },
        ]
      : []),
    ...(canManageFeedback || canManageResources
      ? [
          {
            icon: Bell,
            label: t("web.admin.notifications.title"),
            links: [
              ...(canManageFeedback
                ? [
                    {
                      label: t("web.feedback.notification.title"),
                      to: "/admin/notifications/feedback" as const,
                    },
                  ]
                : []),
              ...(canManageResources
                ? [
                    {
                      label: t("web.resources.notification.title"),
                      to: "/admin/notifications/resources" as const,
                    },
                  ]
                : []),
            ],
            section: "notifications" as const,
            to: "/notifications" as const,
          },
        ]
      : []),
    ...(canManageFeedback
      ? [
          {
            icon: MessageSquare,
            label: t("web.feedback.title"),
            links: [
              {
                label: t("web.feedback.admin.navigation.allActive"),
                to: "/admin/feedback" as const,
              },
              {
                label: t("web.feedback.admin.navigation.requests"),
                to: "/admin/feedback/requests" as const,
              },
              {
                label: t("web.feedback.admin.navigation.active"),
                to: "/admin/feedback/planned" as const,
              },
              {
                label: t("web.feedback.admin.navigation.archive"),
                to: "/admin/feedback/archive" as const,
              },
            ],
            section: "feedback" as const,
            to: "/admin/feedback" as const,
          },
        ]
      : []),
  ];
  const utilityLinks = [
    ...(canManageFlags
      ? [
          {
            icon: Flag,
            label: t("web.admin.featureFlags.featureFlags"),
            to: "/admin/settings/feature-flags" as const,
          },
        ]
      : []),
    ...(canManageResources || canManageCatalog
      ? [
          {
            icon: Trash2,
            label: t("web.admin.trash.title"),
            links: [
              ...(canManageResources
                ? [
                    {
                      label: t("web.resources.trash.adminTitle"),
                      to: "/admin/trash/resources" as const,
                    },
                  ]
                : []),
              ...(canManageCatalog
                ? [
                    {
                      label: t("web.admin.hub.catalogImageTrash"),
                      to: "/admin/trash/catalog-images" as const,
                    },
                  ]
                : []),
            ],
            section: "trash" as const,
            to: "/admin/trash" as const,
          },
        ]
      : []),
  ];

  return (
    <aside className="border-b border-border p-3 md:border-r md:border-b-0">
      <nav
        aria-label={t("web.admin.hub.title")}
        className="flex h-full flex-col gap-6"
      >
        <div className="grid gap-1">
          {primaryLinks.map((link) => (
            <AdminSidebarGroup
              active={section === link.section}
              key={link.to}
              {...link}
            />
          ))}
        </div>
        <div className="grid gap-1 md:mt-auto">
          {utilityLinks.map((link) => (
            <AdminSidebarGroup
              active={"section" in link && section === link.section}
              key={link.to}
              {...link}
            />
          ))}
        </div>
      </nav>
    </aside>
  );
}

function AdminSidebarGroup({
  active,
  icon: Icon,
  label,
  links,
  to,
}: {
  active: boolean;
  icon: typeof Bell;
  label: string;
  links?: Array<{ label: string; to: AdminPath }>;
  to: AdminPath;
}) {
  return (
    <div className="grid gap-1">
      <Link
        className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active ? "text-foreground" : "text-muted-foreground"}`}
        to={to}
      >
        <Icon aria-hidden="true" className="size-4" />
        {label}
      </Link>
      {active && links ? (
        <div className="grid gap-1 pl-6">
          {links.map((link) => (
            <Link
              className="rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              key={link.to}
              to={link.to}
            >
              {link.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
