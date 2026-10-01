import { DEFAULT_LOCALE, formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute, notFound } from "@tanstack/react-router";
import {
  getChangelogEntries,
  paginateChangelog,
  parseChangelogPage,
} from "@/lib/changelog-content";
import type { UserSettingsState } from "@/lib/user-settings";
import { ChangelogListPage } from "@/pages/changelog-pages";
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

/** Public paginated changelog index route. */
export const Route = createFileRoute("/changelog/")({
  component: ChangelogIndexRoute,
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
   * Validates that the requested page exists.
   *
   * @param root0 - Normalized loader dependencies.
   * @returns The validated one-based page number.
   * @throws When the requested page is beyond the final page.
   */
  loader: ({ deps }) => {
    const page = paginateChangelog(getChangelogEntries("en-US"), deps.page);
    if (!page) throw notFound();
    return page.page;
  },
  /**
   * Builds localized document metadata from root settings.
   *
   * @param root0 - Active route matches.
   * @returns Localized route metadata.
   */
  head: ({ matches }) => {
    const routeMatches = matches as unknown as RouteMatch[];
    const locale =
      (
        routeMatches.find(({ routeId }) => routeId === "__root__")
          ?.loaderData as RootLoaderData | undefined
      )?.settingsState?.settings.locale ?? DEFAULT_LOCALE;
    return {
      meta: [
        { title: formatTranslation("web.navigation.changelog", {}, locale) },
      ],
    };
  },
});

/**
 * Renders the localized public changelog index.
 *
 * @returns The requested changelog page.
 * @throws When the localized page can no longer be resolved.
 */
function ChangelogIndexRoute() {
  const page = Route.useLoaderData();
  const { locale } = useLocale();
  const changelogPage = paginateChangelog(getChangelogEntries(locale), page);
  if (!changelogPage) throw notFound();

  return <ChangelogListPage changelogPage={changelogPage} />;
}
