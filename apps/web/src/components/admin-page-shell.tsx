import { useAuth } from "@clerk/tanstack-react-start";
import { hasPermission, normalizeActor } from "@package/services/authorization";
import {
  formatTranslation,
  type TranslationKey,
} from "@pocket-trash/localizations";
import {
  Bell,
  Boxes,
  Factory,
  Flag,
  MessageSquare,
  ScrollText,
  SlidersHorizontal,
  Trash2,
  UsersRound,
} from "lucide-react";
import type { ReactNode } from "react";
import type { AppShellProps } from "@/components/app-shell";
import {
  type SidebarLink,
  SidebarNavigation,
  SidebarPageShell,
} from "@/components/sidebar-page-shell";
import { useLocale } from "@/providers/locale-provider";

/** Administrator navigation section identifiers. */
type AdminSection =
  | "audit"
  | "feedback"
  | "materials"
  | "makers"
  | "magnet-presets"
  | "notifications"
  | "trash"
  | "users";
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
  const { locale } = useLocale();

  return (
    <SidebarPageShell
      breadcrumbItems={breadcrumbItems}
      sidebar={<AdminSidebar section={section} />}
      sidebarTitle={formatTranslation("web.sidebar.adminMenu", {}, locale)}
      title={title}
    >
      {children}
    </SidebarPageShell>
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
  const canManageMaterials = hasPermission(actor, "products.manage");
  const canManageResources = hasPermission(actor, "resources.manage");
  const canManageMakers = hasPermission(actor, "products.manage");
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
  const primaryLinks: SidebarLink[] = [
    ...(canManageMakers
      ? [
          {
            icon: Factory,
            active: section === "makers",
            label: t("web.admin.makers.title"),
            to: "/admin/makers" as const,
          },
        ]
      : []),
    ...(canManageUsers
      ? [
          {
            icon: UsersRound,
            active: section === "users",
            label: t("web.admin.users.title"),
            to: "/admin/users" as const,
          },
        ]
      : []),
    ...(canReadAudit
      ? [
          {
            icon: ScrollText,
            active: section === "audit",
            label: t("web.admin.audit.title"),
            to: "/admin/audit" as const,
          },
        ]
      : []),
    ...(canManageMaterials
      ? [
          {
            icon: Boxes,
            active: section === "materials",
            label: t("web.admin.hub.materials"),
            to: "/admin/materials" as const,
          },
          {
            icon: SlidersHorizontal,
            active: section === "magnet-presets",
            label: t("web.slider.magnet.presets" as TranslationKey),
            to: "/admin/slider-magnet-presets" as const,
          },
        ]
      : []),
    ...(canManageFeedback || canManageResources
      ? [
          {
            icon: Bell,
            active: section === "notifications",
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
            to: "/notifications" as const,
          },
        ]
      : []),
    ...(canManageFeedback
      ? [
          {
            icon: MessageSquare,
            active: section === "feedback",
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
            to: "/admin/feedback" as const,
          },
        ]
      : []),
  ];
  const utilityLinks: SidebarLink[] = [
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
            active: section === "trash",
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
            to: "/admin/trash" as const,
          },
        ]
      : []),
  ];

  return (
    <SidebarNavigation
      ariaLabel={t("web.admin.hub.title")}
      primaryLinks={primaryLinks}
      utilityLinks={utilityLinks}
    />
  );
}
