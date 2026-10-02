import {
  type ChangelogCategorySlug,
  changelogCategories,
  formatTranslation,
  getChangelogCategoryTitle,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { ChevronLeft, ChevronRight, Copy } from "lucide-react";
import * as React from "react";
import { AppShell } from "@/components/app-shell";
import { MarkdownContent } from "@/components/markdown-content";
import { badgeVariants } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import type { ChangelogEntry, ChangelogPage } from "@/lib/changelog-content";
import { absoluteUrl } from "@/lib/site-url";
import { cn } from "@/lib/utils";
import { useLocale } from "@/providers/locale-provider";

/** Inputs for a changelog list or category page. */
type ChangelogListPageProps = {
  /** Optional category whose entries are shown. */
  category?: ChangelogCategorySlug;
  /** Current page of localized entries. */
  changelogPage: ChangelogPage;
};

/** Inputs for a permanent changelog entry page. */
type ChangelogEntryPageProps = {
  /** Localized entry to render. */
  entry: ChangelogEntry;
};

/**
 * Renders a paginated changelog list or category view.
 *
 * @param props - Changelog page and optional active category.
 * @returns The public changelog list page.
 */
export function ChangelogListPage({
  category,
  changelogPage,
}: ChangelogListPageProps) {
  const { locale } = useLocale();
  /**
   * Formats a changelog translation in the active locale.
   *
   * @param key - Translation key to resolve.
   * @param values - Optional interpolation values.
   * @returns The localized string.
   */
  const t = (
    key: TranslationKey,
    values: Record<string, string | number> = {},
  ) => formatTranslation(key, values, locale);
  const changelogTitle = t("web.navigation.changelog");
  const pageTitle = category
    ? getChangelogCategoryTitle(category, locale)
    : changelogTitle;
  useDocumentTitle(pageTitle);

  return (
    <AppShell title={changelogTitle}>
      <main className="mx-auto grid w-full gap-8 p-3 md:p-[18px_22px_22px] lg:max-w-[75%]">
        <nav
          aria-label={t("web.changelog.allCategories")}
          className="flex flex-wrap gap-2"
        >
          <a
            className={badgeVariants({
              variant: category ? "outline" : "default",
            })}
            href="/changelog"
          >
            {t("web.changelog.allCategories")}
          </a>
          {Object.keys(changelogCategories).map((slug) => {
            const categorySlug = slug as ChangelogCategorySlug;
            return (
              <a
                className={badgeVariants({
                  variant: category === categorySlug ? "default" : "outline",
                })}
                href={`/changelog/${categorySlug}`}
                key={categorySlug}
              >
                {getChangelogCategoryTitle(categorySlug, locale)}
              </a>
            );
          })}
        </nav>

        {category ? (
          <h2 className="text-xl font-semibold">{pageTitle}</h2>
        ) : null}

        {changelogPage.entries.length ? (
          <div className="grid gap-10">
            {changelogPage.entries.map((entry) => (
              <ChangelogArticle entry={entry} key={entry.slug} />
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">
            {t(
              category ? "web.changelog.emptyCategory" : "web.changelog.empty",
            )}
          </p>
        )}

        {changelogPage.pageCount > 1 ? (
          <nav
            aria-label={t("web.navigation.changelog")}
            className="flex items-center justify-center gap-3"
          >
            <a
              aria-disabled={changelogPage.page === 1}
              aria-label={t("web.changelog.previousPage")}
              className={cn(
                buttonVariants({ size: "icon", variant: "outline" }),
                changelogPage.page === 1 && "pointer-events-none opacity-50",
              )}
              href={
                changelogPage.page === 1
                  ? undefined
                  : pageHref(category, changelogPage.page - 1)
              }
              role={changelogPage.page === 1 ? "link" : undefined}
              tabIndex={changelogPage.page === 1 ? -1 : undefined}
            >
              <ChevronLeft aria-hidden="true" />
            </a>
            <output aria-live="polite" className="text-sm">
              {t("web.changelog.pageStatus", {
                page: changelogPage.page,
                pageCount: changelogPage.pageCount,
              })}
            </output>
            <a
              aria-disabled={changelogPage.page === changelogPage.pageCount}
              aria-label={t("web.changelog.nextPage")}
              className={cn(
                buttonVariants({ size: "icon", variant: "outline" }),
                changelogPage.page === changelogPage.pageCount &&
                  "pointer-events-none opacity-50",
              )}
              href={
                changelogPage.page === changelogPage.pageCount
                  ? undefined
                  : pageHref(category, changelogPage.page + 1)
              }
              role={
                changelogPage.page === changelogPage.pageCount
                  ? "link"
                  : undefined
              }
              tabIndex={
                changelogPage.page === changelogPage.pageCount ? -1 : undefined
              }
            >
              <ChevronRight aria-hidden="true" />
            </a>
          </nav>
        ) : null}
      </main>
    </AppShell>
  );
}

/**
 * Renders one permanent changelog entry page.
 *
 * @param props - Localized changelog entry.
 * @returns The public changelog entry page.
 */
export function ChangelogEntryPage({ entry }: ChangelogEntryPageProps) {
  const { locale } = useLocale();
  const [copyStatus, setCopyStatus] = React.useState<
    "copied" | "failed" | null
  >(null);
  /**
   * Formats a changelog translation in the active locale.
   *
   * @param key - Translation key to resolve.
   * @returns The localized string.
   */
  const t = (key: TranslationKey) => formatTranslation(key, {}, locale);
  const changelogTitle = t("web.navigation.changelog");
  const entryHref = `/changelog/${entry.slug}`;
  useDocumentTitle(entry.title);

  /** Copies the permanent absolute URL and exposes a localized result. */
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(absoluteUrl(entryHref));
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
  };

  return (
    <AppShell
      breadcrumbItems={[{ label: changelogTitle, to: "/changelog" }]}
      title={entry.title}
    >
      <main className="mx-auto grid w-full gap-6 p-3 md:p-[18px_22px_22px] lg:max-w-[75%]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <EntryHeading entry={entry} />
          <div className="flex items-center gap-3">
            <Button onClick={copyLink} type="button" variant="outline">
              <Copy aria-hidden="true" />
              {t("web.changelog.copyLink")}
            </Button>
            <span aria-live="polite" role="status">
              {copyStatus === "copied"
                ? t("web.changelog.linkCopied")
                : copyStatus === "failed"
                  ? t("web.changelog.copyFailed")
                  : null}
            </span>
          </div>
        </div>
        <EntryDate entry={entry} />
        <EntryCategories entry={entry} />
        <MarkdownContent markdown={entry.body} trustedCodeBlocks />
      </main>
    </AppShell>
  );
}

/**
 * Renders one full entry inside a changelog list.
 *
 * @param props - Entry to render.
 * @returns The full changelog article.
 */
function ChangelogArticle({ entry }: ChangelogEntryPageProps) {
  return (
    <article className="grid gap-4 border-b border-border pb-10 last:border-0 last:pb-0">
      <EntryHeading entry={entry} />
      <EntryDate entry={entry} />
      <EntryCategories entry={entry} />
      <MarkdownContent markdown={entry.body} trustedCodeBlocks />
    </article>
  );
}

/**
 * Renders a changelog heading linked to its permanent page.
 *
 * @param props - Entry whose title is rendered.
 * @returns The linked entry heading.
 */
function EntryHeading({ entry }: ChangelogEntryPageProps) {
  return (
    <h2 className="text-2xl font-semibold">
      <a
        className="rounded-sm hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        href={`/changelog/${entry.slug}`}
      >
        {entry.title}
      </a>
    </h2>
  );
}

/**
 * Renders the publication or latest modification date.
 *
 * @param props - Entry whose date is rendered.
 * @returns The labeled entry date.
 */
function EntryDate({ entry }: ChangelogEntryPageProps) {
  const { locale } = useLocale();
  const modified = entry.dateModified;
  const date = modified ?? entry.datePublished;
  const label = formatTranslation(
    modified ? "web.changelog.dateModified" : "web.changelog.datePublished",
    {},
    locale,
  );

  return (
    <p className="text-sm text-muted-foreground">
      {label}: <time dateTime={date}>{date}</time>
    </p>
  );
}

/**
 * Renders permanent category links for an entry.
 *
 * @param props - Entry whose categories are rendered.
 * @returns The linked category badges.
 */
function EntryCategories({ entry }: ChangelogEntryPageProps) {
  const { locale } = useLocale();

  return (
    <div className="flex flex-wrap gap-2">
      {entry.categories.map((category) => (
        <a
          className={badgeVariants({ variant: "outline" })}
          href={`/changelog/${category}`}
          key={category}
        >
          {getChangelogCategoryTitle(category, locale)}
        </a>
      ))}
    </div>
  );
}

/**
 * Builds a changelog list URL while omitting the first-page search parameter.
 *
 * @param category - Optional active category.
 * @param page - One-based destination page.
 * @returns The relative changelog URL.
 */
function pageHref(category: ChangelogCategorySlug | undefined, page: number) {
  const pathname = category ? `/changelog/${category}` : "/changelog";
  return page <= 1 ? pathname : `${pathname}?page=${page}`;
}

/**
 * Keeps the client document title aligned with the active locale.
 *
 * @param title - Localized page title without the site name.
 */
function useDocumentTitle(title: string) {
  const { locale } = useLocale();

  React.useEffect(() => {
    document.title = `${title} · ${formatTranslation("web.site.name", {}, locale)}`;
  }, [locale, title]);
}
