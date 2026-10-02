import { useAuth } from "@clerk/tanstack-react-start";
import { hasPermission, normalizeActor } from "@package/services/authorization";
import {
  formatTranslation,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { Link } from "@tanstack/react-router";
import {
  Bell,
  Flag,
  MessageSquare,
  ScrollText,
  Trash2,
  UsersRound,
} from "lucide-react";
import type { ReactNode } from "react";
import { AppShell, type AppShellProps } from "@/components/app-shell";
import { useLocale } from "@/providers/locale-provider";

/** Administrator navigation section identifiers. */
type AdminSection = "audit" | "feedback" | "notifications" | "trash" | "users";
/** Routes available from the administrator shell. */
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
  | "/admin/users"
  | "/notifications";

/** Content and active navigation state for an administrator page. */
type AdminPageShellProps = Pick<AppShellProps, "breadcrumbItems" | "title"> & {
  /** Page content rendered beside the administrator navigation. */
  children: ReactNode;
  /** Navigation group to highlight, when the page belongs to one. */
  section?: AdminSection;
};

/**
 * Renders a standard application shell with permission-filtered admin navigation.
 *
 * @param props - Admin page shell properties.
 * @param props.breadcrumbItems - Breadcrumbs displayed above the page title.
 * @param props.children - Page content rendered beside the admin navigation.
 * @param props.section - Navigation group to highlight.
 * @param props.title - Current page title.
 * @returns The administrator page layout.
 * @throws {Error} If the required locale provider is missing.
 */
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

/**
 * Renders the navigation entries allowed by the current actor's permissions.
 *
 * @param props - Admin sidebar properties.
 * @param props.section - Navigation group to highlight.
 * @returns The permission-filtered administrator navigation.
 * @throws {Error} If the required locale provider is missing.
 */
function AdminSidebar({
  section,
}: {
  /** Navigation group to highlight. */
  section?: AdminSection;
}) {
  const { sessionClaims, userId } = useAuth();
  const actor = userId ? normalizeActor(userId, sessionClaims) : undefined;
  const canManageFeedback = hasPermission(actor, "feedback.manage");
  const canManageResources = hasPermission(actor, "resources.manage");
  const canManageCatalog =
    hasPermission(actor, "products.manage") ||
    hasPermission(actor, "collections.manage");
  const canManageFlags = hasPermission(actor, "feature_flags.manage");
  const canReadAudit = hasPermission(actor, "audit.read");
  const canManageUsers = hasPermission(actor, "users.manage");
  const { locale } = useLocale();
  /**
   * Formats a sidebar translation for the active locale.
   *
   * @param key - Administrator-navigation localization key.
   * @returns The localized sidebar text.
   */
  const t = (key: TranslationKey) => formatTranslation(key, {}, locale);
  const primaryLinks = [
    ...(canManageUsers
      ? [
          {
            icon: UsersRound,
            label: t("web.admin.users.title"),
            section: "users" as const,
            to: "/admin/users" as const,
          },
        ]
      : []),
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

/**
 * Renders a top-level administrator link and its active child links.
 *
 * @param props - Admin sidebar group properties.
 * @param props.active - Whether this navigation group is active.
 * @param props.icon - Icon rendered with the top-level link.
 * @param props.label - Localized top-level link label.
 * @param props.links - Child links shown only while the group is active.
 * @param props.to - Top-level destination.
 * @returns The administrator navigation group.
 */
function AdminSidebarGroup({
  active,
  icon: Icon,
  label,
  links,
  to,
}: {
  /** Whether this navigation group is active. */
  active: boolean;
  /** Icon rendered with the top-level link. */
  icon: typeof Bell;
  /** Localized top-level link label. */
  label: string;
  /** Child links shown only while this group is active. */
  links?: Array<{
    /** Localized child link label. */
    label: string;
    /** Child destination. */
    to: AdminPath;
  }>;
  /** Top-level destination. */
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
