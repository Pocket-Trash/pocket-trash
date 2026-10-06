import { useStore } from "@nanostores/react";
import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { type ReactNode, useContext } from "react";
import { AppShell, type AppShellProps } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import {
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  $uiPreferences,
  InitialUiPreferencesContext,
  setSidebarOpen,
} from "@/lib/ui-preferences";
import { cn } from "@/lib/utils";

/** Routes supported by the shared admin and user sidebars. */
type SidebarPath =
  | "/admin"
  | "/admin/audit"
  | "/admin/feedback"
  | "/admin/feedback/archive"
  | "/admin/feedback/planned"
  | "/admin/feedback/requests"
  | "/admin/materials"
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

/** One button rendered after the sidebar utility destinations. */
type SidebarAction = {
  /** Icon rendered with the action. */
  icon: LucideIcon;
  /** Localized action label. */
  label: string;
  /** Callback invoked when the action is selected. */
  onSelect: () => void;
};

/**
 * Renders shared application chrome with a responsive sidebar and content area.
 *
 * @param props - Sidebar page shell properties.
 * @param props.children - Page content rendered beside the sidebar.
 * @param props.headerActions - Optional controls rendered beside the sidebar toggle.
 * @param props.sidebar - Sidebar navigation rendered before the page content.
 * @param props.sidebarTitle - Localized sidebar heading.
 * @returns The shared sidebar page layout.
 */
export function SidebarPageShell({
  children,
  headerActions,
  sidebar,
  sidebarTitle,
  ...shellProps
}: AppShellProps & {
  /** Sidebar navigation rendered before the page content. */
  sidebar: ReactNode;
  /** Localized sidebar heading. */
  sidebarTitle: string;
}) {
  const initialPreferences = useContext(InitialUiPreferencesContext);
  const preferences = useStore($uiPreferences, {
    /**
     * Returns the request-scoped preferences used to hydrate the shell.
     *
     * @returns Initial interface preferences.
     */
    ssr: () => initialPreferences,
  });

  return (
    <SidebarProvider
      defaultOpenMobile
      onOpenChange={setSidebarOpen}
      open={!preferences.sidebarCollapsed}
    >
      <AppShell
        {...shellProps}
        headerActions={
          <>
            <MobileSidebarTrigger />
            {headerActions}
          </>
        }
      >
        <SidebarPageLayout sidebar={sidebar} title={sidebarTitle}>
          {children}
        </SidebarPageLayout>
      </AppShell>
    </SidebarProvider>
  );
}

/**
 * Renders the sidebar toggle with its current expanded state.
 *
 * @param props - Sidebar toggle properties.
 * @param props.className - Optional trigger classes.
 * @returns The accessible sidebar toggle.
 */
function SidebarPageTrigger({
  className,
}: {
  /** Optional trigger classes. */
  className?: string;
}) {
  const { isMobile, open, openMobile } = useSidebar();

  return (
    <SidebarTrigger
      aria-controls="page-sidebar"
      aria-expanded={isMobile ? openMobile : open}
      className={className}
    />
  );
}

/**
 * Restores the sidebar from the page header after it is closed on mobile.
 *
 * @returns The mobile restore control while the sidebar is closed.
 */
function MobileSidebarTrigger() {
  const { isMobile, openMobile } = useSidebar();

  return isMobile && !openMobile ? <SidebarPageTrigger /> : null;
}

/**
 * Renders page content beside the currently visible sidebar.
 *
 * @param props - Sidebar layout properties.
 * @param props.children - Page content rendered beside the sidebar.
 * @param props.sidebar - Navigation shown while the sidebar is expanded.
 * @param props.title - Localized sidebar heading.
 * @returns The collapsible sidebar layout.
 */
function SidebarPageLayout({
  children,
  sidebar,
  title,
}: {
  /** Page content rendered beside the sidebar. */
  children: ReactNode;
  /** Navigation shown while the sidebar is expanded. */
  sidebar: ReactNode;
  /** Localized sidebar heading. */
  title: string;
}) {
  const { isMobile, open, openMobile } = useSidebar();
  const expanded = isMobile ? openMobile : open;

  return (
    <div
      className={cn(
        "grid w-full flex-1",
        expanded
          ? "md:grid-cols-[12rem_minmax(0,1fr)]"
          : "md:grid-cols-[3rem_minmax(0,1fr)]",
      )}
    >
      <aside
        aria-labelledby="page-sidebar-title"
        className={cn(
          "flex min-h-0 flex-col border-b border-border p-3 md:border-r md:border-b-0",
          !expanded && "md:px-2",
        )}
        data-state={expanded ? "expanded" : "collapsed"}
        hidden={!expanded && isMobile}
        id="page-sidebar"
      >
        <div className="mb-3 flex min-h-7 items-center gap-2">
          <h2
            className={cn(
              "truncate text-sm font-semibold",
              !expanded && "md:sr-only",
            )}
            id="page-sidebar-title"
          >
            {title}
          </h2>
          <SidebarPageTrigger
            className={cn("ml-auto shrink-0", !expanded && "md:mx-auto")}
          />
        </div>
        <div className="min-h-0 flex-1">{sidebar}</div>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/**
 * Renders primary and utility sidebar destinations.
 *
 * @param props - Sidebar navigation properties.
 * @param props.ariaLabel - Accessible navigation label.
 * @param props.action - Optional action rendered after the utility links.
 * @param props.primaryLinks - Main destinations shown at the top.
 * @param props.utilityLinks - Secondary destinations shown at the bottom.
 * @returns The shared sidebar navigation.
 */
export function SidebarNavigation({
  action,
  ariaLabel,
  primaryLinks,
  utilityLinks = [],
}: {
  /** Optional action rendered after the utility links. */
  action?: SidebarAction;
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
      <div className="mt-auto grid gap-1">
        {utilityLinks.map((link) => (
          <SidebarNavigationGroup key={link.to} {...link} />
        ))}
        {action ? <SidebarNavigationAction {...action} /> : null}
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
  const { isMobile, open, openMobile } = useSidebar();
  const expanded = isMobile ? openMobile : open;

  return (
    <div className="grid gap-1">
      <Tooltip>
        <TooltipTrigger
          render={
            <Link
              className={cn(
                "flex min-h-10 items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active ? "text-foreground" : "text-muted-foreground",
                !expanded && "md:justify-center md:px-2",
              )}
              to={to}
            />
          }
        >
          <Icon aria-hidden="true" className="size-4 shrink-0" />
          <span className={cn(!expanded && "md:sr-only")}>{label}</span>
        </TooltipTrigger>
        <TooltipContent
          align="center"
          hidden={expanded || isMobile}
          side="right"
          sideOffset={6}
        >
          {label}
        </TooltipContent>
      </Tooltip>
      {expanded && active && links ? (
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

/**
 * Renders a sidebar action with the same collapsed tooltip as navigation links.
 *
 * @param props - Sidebar action properties.
 * @returns One sidebar action.
 */
function SidebarNavigationAction({
  icon: Icon,
  label,
  onSelect,
}: SidebarAction) {
  const { isMobile, open, openMobile } = useSidebar();
  const expanded = isMobile ? openMobile : open;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            className={cn(
              "min-h-10 w-full justify-start px-3 py-2",
              !expanded && "md:justify-center md:px-2",
            )}
            onClick={onSelect}
            type="button"
          />
        }
      >
        <Icon aria-hidden="true" className="size-4 shrink-0" />
        <span className={cn(!expanded && "md:sr-only")}>{label}</span>
      </TooltipTrigger>
      <TooltipContent
        align="center"
        hidden={expanded || isMobile}
        side="right"
        sideOffset={6}
      >
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
