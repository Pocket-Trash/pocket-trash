import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { AppShell, type AppShellProps } from "@/components/app-shell";

/** Routes supported by the shared admin and user sidebars. */
type SidebarPath =
  | "/admin"
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
  | "/notifications"
  | "/resources/add"
  | "/user/account"
  | "/user/collections"
  | "/user/collections/add"
  | "/user/resources"
  | "/user/resources/trash"
  | "/user/settings"
  | "/user/settings/beta-features";

/** One top-level sidebar destination and its optional active subroutes. */
export type SidebarLink = {
  /** Whether the top-level destination is active. */
  active?: boolean;
  /** Icon rendered with the top-level destination. */
  icon: LucideIcon;
  /** Localized destination label. */
  label: string;
  /** Subroutes shown while the top-level destination is active. */
  links?: Array<{
    /** Localized subroute label. */
    label: string;
    /** Subroute destination. */
    to: SidebarPath;
  }>;
  /** Top-level destination. */
  to: SidebarPath;
};

/**
 * Renders shared application chrome with a responsive sidebar and content area.
 *
 * @param props - Sidebar page shell properties.
 * @param props.children - Page content rendered beside the sidebar.
 * @param props.sidebar - Sidebar navigation rendered before the page content.
 * @returns The shared sidebar page layout.
 */
export function SidebarPageShell({
  children,
  sidebar,
  ...shellProps
}: AppShellProps & {
  /** Sidebar navigation rendered before the page content. */
  sidebar: ReactNode;
}) {
  return (
    <AppShell {...shellProps}>
      <div className="grid w-full flex-1 md:grid-cols-[12rem_minmax(0,1fr)]">
        <aside className="border-b border-border p-3 md:border-r md:border-b-0">
          {sidebar}
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </AppShell>
  );
}

/**
 * Renders primary and utility sidebar destinations.
 *
 * @param props - Sidebar navigation properties.
 * @param props.ariaLabel - Accessible navigation label.
 * @param props.primaryLinks - Main destinations shown at the top.
 * @param props.utilityLinks - Secondary destinations shown at the bottom.
 * @returns The shared sidebar navigation.
 */
export function SidebarNavigation({
  ariaLabel,
  primaryLinks,
  utilityLinks = [],
}: {
  /** Accessible navigation label. */
  ariaLabel: string;
  /** Main destinations shown at the top. */
  primaryLinks: SidebarLink[];
  /** Secondary destinations shown at the bottom. */
  utilityLinks?: SidebarLink[];
}) {
  return (
    <nav aria-label={ariaLabel} className="flex h-full flex-col gap-6">
      <div className="grid gap-1">
        {primaryLinks.map((link) => (
          <SidebarNavigationGroup key={link.to} {...link} />
        ))}
      </div>
      <div className="grid gap-1 md:mt-auto">
        {utilityLinks.map((link) => (
          <SidebarNavigationGroup key={link.to} {...link} />
        ))}
      </div>
    </nav>
  );
}

/**
 * Renders a top-level sidebar destination and its active subroutes.
 *
 * @param props - Sidebar navigation group properties.
 * @param props.active - Whether the top-level destination is active.
 * @param props.icon - Icon rendered with the top-level destination.
 * @param props.label - Localized destination label.
 * @param props.links - Subroutes shown while active.
 * @param props.to - Top-level destination.
 * @returns One sidebar navigation group.
 */
function SidebarNavigationGroup({
  active = false,
  icon: Icon,
  label,
  links,
  to,
}: SidebarLink) {
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
