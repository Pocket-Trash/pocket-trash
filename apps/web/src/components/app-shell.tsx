import {
  formatTranslation,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Home } from "lucide-react";
import type * as React from "react";
import { LanguageSelect } from "@/components/language-select";
import { PageFooter } from "@/components/page-footer";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";
import { useLocale } from "@/providers/locale-provider";

type AppShellProps = {
  breadcrumbItems?: Array<{
    label: string;
    to: "/collections" | "/products" | "/user/account";
  }>;
  children: React.ReactNode;
  headerActions?: React.ReactNode;
  meta?: React.ReactNode;
  title: string;
};

export function AppShell({
  breadcrumbItems = [],
  children,
  headerActions,
  meta,
  title,
}: AppShellProps) {
  const { locale, setLocale } = useLocale();
  const t = (key: TranslationKey) => formatTranslation(key, {}, locale);
  const siteName = t("web.site.name");

  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <header className="sticky top-0 z-30 flex flex-wrap items-start gap-x-4 gap-y-3 border-b border-border bg-background/90 px-3.5 pt-[max(0.625rem,env(safe-area-inset-top))] pb-2.5 backdrop-blur md:px-5 md:pt-[max(0.875rem,env(safe-area-inset-top))] md:pb-3.5">
        <div className="min-w-0 flex-1">
          <h1 className="m-0 text-[16px] font-bold tracking-[0.5px] md:text-lg">
            <Link className="hover:text-primary" to="/">
              {siteName}
            </Link>
          </h1>
          {title !== siteName ? (
            <nav className="mt-1 flex min-w-0 items-center gap-1 text-sm text-muted-foreground">
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
                  <Link className="truncate hover:text-foreground" to={item.to}>
                    {item.label}
                  </Link>
                </span>
              ))}
              <ChevronRight aria-hidden="true" className="size-3.5 shrink-0" />
              <span aria-current="page" className="truncate text-foreground">
                {title}
              </span>
            </nav>
          ) : null}
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <LanguageSelect
            className="w-[9.5rem] max-sm:w-[8.5rem]"
            locale={locale}
            onLocaleChange={setLocale}
          />
          <ThemeToggle />
          <UserMenu />
        </div>
        {meta || headerActions ? (
          <div className="flex w-full flex-wrap items-center gap-3">
            {meta ? (
              <span className="text-xs text-muted-foreground md:text-sm">
                {meta}
              </span>
            ) : null}
            {headerActions ? (
              <div className="ml-auto flex flex-1 flex-wrap items-center justify-end gap-2">
                {headerActions}
              </div>
            ) : null}
          </div>
        ) : null}
      </header>
      <div className="flex-1">{children}</div>
      <PageFooter />
    </div>
  );
}
