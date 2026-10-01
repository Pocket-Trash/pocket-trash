import {
  type ChangelogCategorySlug,
  changelogCategories,
  DEFAULT_LOCALE,
  getChangelogCategoryTitle,
} from "@pocket-trash/localizations";
import { createFileRoute, notFound } from "@tanstack/react-router";
import {
  getChangelogEntries,
  getChangelogEntry,
  paginateChangelog,
  parseChangelogPage,
} from "@/lib/changelog-content";
import type { UserSettingsState } from "@/lib/user-settings";
import { ChangelogEntryPage, ChangelogListPage } from "@/pages/changelog-pages";
import { useLocale } from "@/providers/locale-provider";

/** Optional normalized page search state. */
type ChangelogSearch = {
  /** One-based page number, omitted for the first page. */
  page?: number;
};

/** Route match fields needed to read root loader data. */
type RouteMatch = {
  /** Loader result for the matched route. */
  loaderData: unknown;
  /** Stable TanStack route identifier. */
  routeId: string;
};

/** Root loader subset used to localize server-rendered metadata. */
type RootLoaderData = {
  /** Current visitor settings when available. */
  settingsState?: UserSettingsState | null;
};

/** Public permanent-entry and category changelog route. */
export const Route = createFileRoute("/changelog/$slug")({
  component: ChangelogSlugRoute,
  /**
   * Normalizes untrusted pagination input.
   *
   * @param search - Raw route search parameters.
   * @returns Normalized changelog search state.
   */
  validateSearch: (search: Record<string, unknown>): ChangelogSearch => {
    const page = parseChangelogPage(search.page);
    return page === 1 ? {} : { page };
  },
  /**
   * Exposes the normalized page to the server loader.
   *
   * @param root0 - Validated route search state.
   * @returns Loader dependencies for the requested page.
   */
  loaderDeps: ({ search }) => ({ page: search.page ?? 1 }),
  /**
   * Resolves the slug as an entry first, then as a category.
   *
   * @param root0 - Route parameters and loader dependencies.
   * @returns The resolved entry or category state.
   * @throws When the slug or category page does not exist.
   */
  loader: ({ deps, params }) => {
    const entry = getChangelogEntry("en-US", params.slug);
    if (entry) return { kind: "entry", slug: entry.slug } as const;
    if (!isCategorySlug(params.slug)) throw notFound();

    const page = paginateChangelog(
      getChangelogEntries("en-US", params.slug),
      deps.page,
    );
    if (!page) throw notFound();
    return {
      category: params.slug,
      kind: "category",
      page: page.page,
    } as const;
  },
  /**
   * Builds localized document metadata from root settings.
   *
   * @param root0 - Resolved loader data and active route matches.
   * @returns Localized route metadata.
   */
  head: ({ loaderData, matches }) => {
    if (!loaderData) return {};
    const routeMatches = matches as unknown as RouteMatch[];
    const locale =
      (
        routeMatches.find(({ routeId }) => routeId === "__root__")
          ?.loaderData as RootLoaderData | undefined
      )?.settingsState?.settings.locale ?? DEFAULT_LOCALE;
    const title =
      loaderData.kind === "entry"
        ? getChangelogEntry(locale, loaderData.slug)?.title
        : getChangelogCategoryTitle(loaderData.category, locale);
    return title ? { meta: [{ title }] } : {};
  },
});

/**
 * Renders a localized entry or category page from resolved loader data.
 *
 * @returns The public changelog page.
 * @throws When localized loader data can no longer resolve an entry or page.
 */
function ChangelogSlugRoute() {
  const data = Route.useLoaderData();
  const { locale } = useLocale();

  if (data.kind === "entry") {
    const entry = getChangelogEntry(locale, data.slug);
    if (!entry) throw notFound();
    return <ChangelogEntryPage entry={entry} />;
  }

  const changelogPage = paginateChangelog(
    getChangelogEntries(locale, data.category),
    data.page,
  );
  if (!changelogPage) throw notFound();
  return (
    <ChangelogListPage category={data.category} changelogPage={changelogPage} />
  );
}

/**
 * Checks whether a route slug names a supported changelog category.
 *
 * @param value - Untrusted route slug.
 * @returns Whether the slug is a category.
 */
function isCategorySlug(value: string): value is ChangelogCategorySlug {
  return value in changelogCategories;
}
