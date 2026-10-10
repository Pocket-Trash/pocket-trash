import { useAuth } from "@clerk/tanstack-react-start";
import {
  DEFAULT_LOCALE,
  formatTranslation,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Home } from "lucide-react";
import type * as React from "react";
import { toast } from "sonner";
import { LanguageSelect } from "@/components/language-select";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";
import { updateLocaleSetting } from "@/lib/locale-api";
import { cn } from "@/lib/utils";
import { useLocale, useOptionalLocale } from "@/providers/locale-provider";

/** Content and navigation rendered by the shared application shell. */
export type AppShellProps = {
  /** Optional breadcrumb links shown above the page title. */
  breadcrumbItems?: Array<
    | {
        /** Breadcrumb label. */
        label: string;
        /** Supported static destination for this breadcrumb. */
        to?:
          | "/admin"
          | "/admin/config"
          | "/admin/feedback"
          | "/admin/materials"
          | "/admin/makers"
          | "/admin/trash"
          | "/collections"
          | "/changelog"
          | "/help"
          | "/materials"
          | "/makers"
          | "/products"
          | "/notifications"
          | "/user"
          | "/user/account"
          | "/user/collections";
      }
    | {
        /** General material breadcrumb label. */
        label: string;
        /** Stable parent material slug. */
        params: { /** Parent material route slug. */ materialSlug: string };
        /** General material destination. */
        to: "/materials/$materialSlug";
      }
    | {
        /** Breadcrumb label. */
        label: string;
        /** Parameters for the user collection route. */
        params: {
          /** Numeric collection owner identifier. */
          userId: number;
        };
        /** User collection destination. */
        to: "/collections/$userId";
      }
  >;
  /** Page content rendered below the shared header. */
  children: React.ReactNode;
  /** Whether to constrain the shell to the application container width. @default true */
  contained?: boolean;
  /** Optional controls rendered at the end of the page header. */
  headerActions?: React.ReactNode;
  /** Optional supporting page metadata rendered with the header. */
  meta?: React.ReactNode;
  /** Whether provider-dependent language, theme, and account controls render. @default true */
  showControls?: boolean;
  /** Current page title. */
  title: string;
};

/**
 * Renders the shared page header, breadcrumbs, controls, and content region.
 *
 * @param props - App shell properties.
 * @param props.breadcrumbItems - Breadcrumbs preceding the current page. Defaults to none.
 * @param props.children - Page content rendered below the header.
 * @param props.contained - Whether to constrain the shell width. Defaults to `true`.
 * @param props.headerActions - Optional controls rendered at the end of the header.
 * @param props.meta - Optional supporting page metadata.
 * @param props.showControls - Whether provider-dependent header controls render. Defaults to `true`.
 * @param props.title - Current page title.
 * @returns The shared application page layout.
 * @throws {Error} If header controls are enabled without their required providers.
 */
export function AppShell({
  breadcrumbItems = [],
  children,
  contained = true,
  headerActions,
  meta,
  showControls = true,
  title,
}: AppShellProps) {
  const locale = useOptionalLocale() ?? DEFAULT_LOCALE;
  const siteName = formatTranslation("web.site.name", {}, locale);

  return (
    <div
      className={cn(
        "flex flex-1 flex-col bg-background text-foreground",
        contained && "container mx-auto",
      )}
    >
      <header className="relative sticky top-0 z-30 flex flex-wrap items-start gap-x-4 gap-y-3 border-b border-border bg-background/90 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 backdrop-blur">
        <div className="min-w-0 flex-1">
          <h1 className="m-0 text-lg font-bold tracking-[0.5px]">
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
              {breadcrumbItems.map((item, index) => (
                <span className="contents" key={`${item.label}-${index}`}>
                  <ChevronRight
                    aria-hidden="true"
                    className="size-3.5 shrink-0"
                  />
                  {item.to === "/collections/$userId" ? (
                    <Link
                      className="truncate hover:text-foreground"
                      params={item.params}
                      to={item.to}
                    >
                      {item.label}
                    </Link>
                  ) : item.to === "/materials/$materialSlug" ? (
                    <Link
                      activeOptions={{ exact: true }}
                      className="truncate hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      params={item.params}
                      search={{ productsPage: 1, collectionItemsPage: 1 }}
                      to={item.to}
                    >
                      {item.label}
                    </Link>
                  ) : item.to ? (
                    <Link
                      className="truncate hover:text-foreground"
                      to={item.to}
                    >
                      {item.label}
                    </Link>
                  ) : (
                    <span className="truncate">{item.label}</span>
                  )}
                </span>
              ))}
              <ChevronRight aria-hidden="true" className="size-3.5 shrink-0" />
              <span aria-current="page" className="truncate text-foreground">
                {title}
              </span>
            </nav>
          ) : null}
        </div>
        {showControls ? <AppShellControls /> : null}
        {meta || headerActions ? (
          <div className="flex w-full flex-wrap items-center gap-3">
            {meta ? (
              <span className="text-sm text-muted-foreground">{meta}</span>
            ) : null}
            {headerActions ? (
              <div className="ml-auto flex flex-1 flex-wrap items-center justify-end gap-2">
                {headerActions}
              </div>
            ) : null}
          </div>
        ) : null}
      </header>
      <div
        className={cn(
          "flex flex-1 flex-col",
          contained && "[&>*]:mx-auto [&>*]:w-full",
        )}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Renders header controls backed by authentication, locale, and theme providers.
 *
 * @returns The shared language, theme, and account controls.
 * @throws {Error} When a required provider is unavailable.
 */
function AppShellControls() {
  const { isLoaded, isSignedIn } = useAuth();
  const { locale, setLocale } = useLocale();
  /**
   * Formats an application-shell translation for the active locale.
   *
   * @param key - Application-shell localization key.
   * @returns The localized application-shell text.
   */
  const t = (key: TranslationKey) => formatTranslation(key, {}, locale);
  /**
   * Applies a locale immediately and requests persistence for loaded signed-in users.
   * Failed requests show a settings error without reverting the applied locale.
   *
   * @param nextLocale - Locale selected by the user.
   */
  const onLocaleChange = (nextLocale: typeof locale) => {
    setLocale(nextLocale);

    if (isLoaded && isSignedIn) {
      void updateLocaleSetting(nextLocale).catch(() => {
        toast.error(t("web.error.settingsSaveFailed"));
      });
    }
  };

  return (
    <div className="ml-auto flex shrink-0 items-center gap-2">
      <LanguageSelect
        className="w-[9.5rem] max-sm:w-[8.5rem]"
        locale={locale}
        onLocaleChange={onLocaleChange}
      />
      <ThemeToggle />
      <UserMenu />
    </div>
  );
}
