import { useAuth, useClerk } from "@clerk/tanstack-react-start";
import {
  faArrowRightFromBracket,
  faChartBar,
  faFiles,
  faFlask,
  faFolder,
  faGear,
  faShield,
  faUser,
} from "@fortawesome/pro-light-svg-icons";
import {
  hasStaffPermission,
  normalizeActor,
} from "@package/services/authorization";
import {
  formatTranslation,
  type TranslationKey,
} from "@pocket-trash/localizations";
import type { AppShellProps } from "@/components/app-shell";
import {
  type SidebarLink,
  SidebarNavigation,
  SidebarPageShell,
} from "@/components/sidebar-page-shell";
import { cn } from "@/lib/utils";
import { useLocale } from "@/providers/locale-provider";

/** User sidebar section identifiers. */
export type UserSection =
  | "account"
  | "beta-features"
  | "collections"
  | "resources"
  | "settings"
  | "trends";

/**
 * Renders a user-account page inside the shared application shell.
 *
 * @param props - User page shell properties.
 * @param props.breadcrumbItems - Additional breadcrumbs shown after the user root.
 * @param props.children - User page content.
 * @param props.contentClassName - Optional classes for the page content wrapper.
 * @param props.headerActions - Optional controls rendered in the page header.
 * @param props.meta - Optional supporting page metadata.
 * @param props.section - Navigation section to highlight.
 * @param props.title - Current user page title.
 * @returns The user-account page layout.
 * @throws {Error} If the required locale provider is missing.
 */
export function UserPageShell({
  breadcrumbItems = [],
  children,
  contentClassName,
  headerActions,
  meta,
  section,
  title,
}: Pick<
  AppShellProps,
  "breadcrumbItems" | "children" | "headerActions" | "meta" | "title"
> & {
  /** Optional classes for the page content wrapper. */
  contentClassName?: string;
  /** Navigation section to highlight. */
  section?: UserSection;
}) {
  const { sessionClaims, userId } = useAuth();
  const clerk = useClerk();
  const actor = userId ? normalizeActor(userId, sessionClaims) : undefined;
  const { locale } = useLocale();
  /**
   * Formats a user-navigation translation for the active locale.
   *
   * @param key - User-navigation localization key.
   * @returns The localized user-navigation text.
   */
  const t = (key: TranslationKey) => formatTranslation(key, {}, locale);
  const userTitle = t("web.navigation.user");
  const primaryLinks: SidebarLink[] = [
    {
      active: section === "collections",
      icon: faFolder,
      label: t("web.navigation.collections"),
      links: [
        {
          label: t("web.action.addCollection"),
          to: "/user/collections/add",
        },
      ],
      to: "/user/collections",
    },
    {
      active: section === "trends",
      icon: faChartBar,
      label: t("web.trends.title"),
      to: "/user/trends",
    },
    {
      active: section === "resources",
      icon: faFiles,
      label: t("web.navigation.resources"),
      links: [
        { label: t("web.resources.action.add"), to: "/resources/add" },
        {
          label: t("web.resources.trash.ownerTitle"),
          to: "/user/resources/trash",
        },
      ],
      to: "/user/resources",
    },
    {
      active: section === "account",
      icon: faUser,
      label: t("web.navigation.account"),
      to: "/user/account",
    },
  ];
  const utilityLinks: SidebarLink[] = [
    ...(hasStaffPermission(actor)
      ? [
          {
            icon: faShield,
            label: t("web.navigation.admin"),
            to: "/admin" as const,
          },
        ]
      : []),
    {
      active: section === "settings",
      icon: faGear,
      label: t("web.settings.settings"),
      to: "/user/settings",
    },
    {
      active: section === "beta-features",
      icon: faFlask,
      label: t("web.navigation.betaFeatures"),
      to: "/user/settings/beta-features",
    },
  ];

  return (
    <SidebarPageShell
      breadcrumbItems={[
        ...(title === userTitle
          ? []
          : [{ label: userTitle, to: "/user" as const }]),
        ...breadcrumbItems,
      ]}
      headerActions={headerActions}
      meta={meta}
      sidebar={
        <SidebarNavigation
          action={{
            icon: faArrowRightFromBracket,
            label: t("web.action.signOut"),
            /** Signs out the current user and returns to the home page. */
            onSelect: () => {
              void clerk.signOut({ redirectUrl: "/" });
            },
          }}
          ariaLabel={userTitle}
          primaryLinks={primaryLinks}
          utilityLinks={utilityLinks}
        />
      }
      sidebarTitle={t("web.sidebar.profile")}
      title={title}
    >
      <div className={cn("w-full px-4 py-6 md:px-6", contentClassName)}>
        {children}
      </div>
    </SidebarPageShell>
  );
}
