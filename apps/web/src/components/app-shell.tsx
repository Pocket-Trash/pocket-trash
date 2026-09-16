import {
  formatTranslation,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Home } from "lucide-react";
import type * as React from "react";
import { PageFooter } from "@/components/page-footer";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { UserMenu } from "@/components/user-menu";
import { cn } from "@/lib/utils";
import { useLocale } from "@/providers/locale-provider";

type AppShellProps = {
  bottomBar?: React.ReactNode;
  breadcrumbItems?: Array<{
    label: string;
    to: "/collections" | "/products" | "/user/account";
  }>;
  children: React.ReactNode;
  defaultSidebarOpen?: boolean;
  headerActions?: React.ReactNode;
  meta?: React.ReactNode;
  onSidebarOpenChange?: (open: boolean) => void;
  sidebarContent?: React.ReactNode;
  sidebarOpen?: boolean;
  title: string;
};

export function AppShell({
  bottomBar,
  breadcrumbItems = [],
  children,
  defaultSidebarOpen = true,
  headerActions,
  meta,
  onSidebarOpenChange,
  sidebarContent,
  sidebarOpen,
  title,
}: AppShellProps) {
  const { locale } = useLocale();
  const t = (key: TranslationKey) => formatTranslation(key, {}, locale);
  const siteName = t("web.site.name");

  // When a bottom bar is supplied (the archive on compact screens), the header
  // hamburger and inline controls move into the bottom toolbar, and account
  // moves to a top-bar avatar. Pages without a bottom bar keep the original
  // compact header (hamburger opens the sidebar) unchanged.
  const hasBottomBar = Boolean(bottomBar);
  return (
    <SidebarProvider
      defaultOpen={defaultSidebarOpen}
      onOpenChange={onSidebarOpenChange}
      open={sidebarOpen}
      style={
        {
          "--sidebar-width": "18rem",
        } as React.CSSProperties
      }
    >
      <Sidebar className="border-sidebar-border">
        <SidebarHeader className="items-end border-b border-sidebar-border md:hidden">
          <SidebarTrigger aria-label={t("web.sidebar.close")} />
        </SidebarHeader>
        <SidebarContent className="scrollbar-none px-2 py-3">
          {sidebarContent}
        </SidebarContent>
        <SidebarFooter className="gap-8 border-t border-sidebar-border px-3 pt-4 pb-3">
          <ThemeToggle />
          <UserMenu />
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset>
        <div
          className={cn(
            "flex min-h-svh flex-col bg-background text-foreground",
            hasBottomBar &&
              "max-md:pb-[calc(3.5rem+env(safe-area-inset-bottom))]",
          )}
        >
          <header className="sticky top-0 z-30 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border bg-background/90 px-3.5 pt-[max(0.625rem,env(safe-area-inset-top))] pb-2.5 backdrop-blur md:px-5 md:pt-[max(0.875rem,env(safe-area-inset-top))] md:pb-3.5">
            <SidebarTrigger
              aria-label={t("web.sidebar.toggle")}
              className={cn(hasBottomBar && "hidden md:inline-flex")}
            />
            <div className="flex min-w-0 items-center gap-3">
              <h1 className="m-0 shrink-0 text-[16px] font-bold tracking-[0.5px] md:text-lg">
                <Link className="hover:text-primary" to="/">
                  {siteName}
                </Link>
              </h1>
              {title !== siteName ? (
                <nav className="flex min-w-0 items-center gap-1 text-sm text-muted-foreground">
                  <Link
                    aria-label={siteName}
                    className="shrink-0 rounded-sm p-1 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    to="/"
                  >
                    <Home aria-hidden="true" className="size-3.5" />
                  </Link>
                  {breadcrumbItems.map((item) => (
                    <span className="contents" key={item.to}>
                      <ChevronRight
                        aria-hidden="true"
                        className="size-3.5 shrink-0"
                      />
                      <Link
                        className="truncate hover:text-foreground"
                        to={item.to}
                      >
                        {item.label}
                      </Link>
                    </span>
                  ))}
                  <ChevronRight
                    aria-hidden="true"
                    className="size-3.5 shrink-0"
                  />
                  <span
                    aria-current="page"
                    className="truncate text-foreground"
                  >
                    {title}
                  </span>
                </nav>
              ) : null}
            </div>
            {meta ? (
              <span className="text-xs text-muted-foreground md:text-sm">
                {meta}
              </span>
            ) : null}
            <div className="hidden flex-1 md:block" />
            {hasBottomBar ? (
              <div className="ml-auto md:hidden">
                <UserMenu compact />
              </div>
            ) : null}
            <div
              className={hasBottomBar ? "contents max-md:hidden" : "contents"}
            >
              {headerActions}
            </div>
          </header>
          <div className="flex-1">{children}</div>
          <PageFooter />
        </div>
        {bottomBar}
      </SidebarInset>
    </SidebarProvider>
  );
}
