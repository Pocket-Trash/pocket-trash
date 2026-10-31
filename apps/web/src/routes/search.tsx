import type { SearchGroup } from "@package/services";
import { formatTranslation } from "@pocket-trash/localizations";
import {
  createFileRoute,
  redirect,
  useNavigate,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import React from "react";
import { searchPublic } from "@/lib/search";
import {
  SEARCH_QUERY_MAX_LENGTH,
  SEARCH_QUERY_MIN_LENGTH,
} from "@/lib/search-constants";
import { canCommitSearch } from "@/lib/search-navigation";
import {
  type SearchNavigationOptions,
  SearchPage,
  type SearchPageData,
  type SearchPageSearch,
} from "@/pages/search-page";

/** Search groups represented explicitly in the URL. */
const filteredGroups = new Set<Exclude<SearchGroup, "all">>([
  "products",
  "collections",
  "makers",
  "people",
  "materials",
  "resources",
]);

/**
 * Normalizes untrusted `/search` URL parameters.
 *
 * @param value - Untrusted route search values.
 * @returns Canonical search state with defaults omitted.
 */
export function parseSearchPageSearch(
  value: Record<string, unknown>,
): SearchPageSearch {
  const q =
    typeof value.q === "string"
      ? value.q.trim().slice(0, SEARCH_QUERY_MAX_LENGTH).trim()
      : "";
  const type =
    typeof value.type === "string" &&
    filteredGroups.has(value.type as Exclude<SearchGroup, "all">)
      ? (value.type as Exclude<SearchGroup, "all">)
      : undefined;
  const parsedPage =
    typeof value.page === "number"
      ? value.page
      : typeof value.page === "string"
        ? Number(value.page)
        : 1;
  const page =
    Number.isSafeInteger(parsedPage) && parsedPage > 1 ? parsedPage : undefined;

  return {
    ...(page ? { page } : {}),
    ...(q ? { q } : {}),
    ...(type ? { type } : {}),
  };
}

/**
 * Checks normalized search values without treating parameter ordering as meaningful.
 * @param searchString - Raw URL query string.
 * @param search - Validated route search values.
 * @returns Whether defaults, duplicate values, and unknown keys are absent.
 */
export function isCanonicalSearchPageSearch(
  searchString: string,
  search: SearchPageSearch,
) {
  const raw = new URLSearchParams(searchString);
  const entries = Object.entries(search);
  return (
    [...raw.keys()].length === entries.length &&
    entries.every(
      ([key, value]) =>
        raw.getAll(key).length === 1 && raw.get(key) === String(value),
    )
  );
}

/**
 * Replaces untrusted defaults and unknown keys after Router merges validated search.
 * @param searchString - Raw URL query string.
 * @param search - Merged route search values.
 * @throws Replacement redirect when the URL differs from normalized public search.
 */
export function canonicalizeSearchPage(
  searchString: string,
  search: Record<string, unknown>,
) {
  const normalized = parseSearchPageSearch(search);
  if (!isCanonicalSearchPageSearch(searchString, normalized))
    throw redirect({ to: "/search", search: normalized, replace: true });
}

/**
 * Loads one public search page, preserving inline errors and replacing invalid pagination.
 * @param search - Normalized query, group, and page.
 * @param signal - Router-owned cancellation lifetime.
 * @returns Accepted route results or existing feedback status.
 * @rejects With a replacement redirect for an out-of-range page.
 */
export async function loadSearchPage(
  search: SearchPageSearch,
  signal: AbortSignal,
): Promise<SearchPageData> {
  const query = search.q ?? "";
  if (query.length < SEARCH_QUERY_MIN_LENGTH) return { status: "idle" };
  let response;
  try {
    response = await searchPublic({
      data: {
        group: search.type ?? "all",
        page: search.page ?? 1,
        query,
        surface: "page",
      },
      signal: signal,
    });
  } catch {
    return { status: "error" };
  }
  const pageCount = Math.max(1, Math.ceil(response.total / response.pageSize));
  if ((search.page ?? 1) > pageCount)
    throw redirect({
      to: "/search",
      replace: true,
      search: { ...search, page: pageCount === 1 ? undefined : pageCount },
    });
  return { status: "ready", response };
}

/** Defines the shareable public search route. */
export const Route = createFileRoute("/search")({
  component: SearchRoute,
  pendingMs: Infinity,
  /**
   * Replaces malformed or redundant search parameters before loading results.
   * @param context - Route pre-load context.
   * @param context.location - Current raw location.
   * @param context.search - Validated search values.
   * @throws With a replacement redirect when search is not canonical.
   */
  beforeLoad: ({ location, search }) => {
    canonicalizeSearchPage(location.searchStr, search);
  },
  /**
   * Keys loader results by the normalized query, group, and page.
   * @param context - Validated route search context.
   * @param context.search - Normalized URL values.
   * @returns Search request dependencies.
   */
  loaderDeps: ({ search }) => parseSearchPageSearch(search),
  /**
   * Loads one public result page and corrects an out-of-range page with replacement.
   * @param context - Loader request context.
   * @param context.deps - Normalized query, group, and page.
   * @param context.abortController - Router-owned cancellation lifetime.
   * @returns Route-owned results or localized feedback status.
   * @rejects With a replacement redirect for an out-of-range page.
   */
  loader: ({ deps, abortController }) =>
    loadSearchPage(deps, abortController.signal),
  /**
   * Builds document metadata for the search route.
   *
   * @returns Metadata emitted for the route.
   */
  head: () => ({
    meta: [{ title: formatTranslation("web.search.title") }],
  }),
  validateSearch: parseSearchPageSearch,
});

/**
 * Renders the public search route and synchronizes canonical URL state.
 *
 * @returns The public search page.
 */
function SearchRoute() {
  const router = useRouter();
  const { location, isLoading: loading } = useRouterState();
  const search = parseSearchPageSearch(location.search);
  const data = Route.useLoaderData();
  const navigate = useNavigate({ from: "/search" });
  const onNavigate = React.useCallback(
    /**
     * Applies search state to browser history.
     *
     * @param nextSearch - Next normalized search state.
     * @param options - Browser history behavior.
     */
    function navigateSearch(
      nextSearch: SearchPageSearch,
      options: SearchNavigationOptions,
    ) {
      if (!canCommitSearch(router, Route.id)) return;
      void navigate({
        replace: options.replace,
        search: nextSearch,
        to: "/search",
      });
    },
    [navigate, router],
  );

  return (
    <SearchPage
      data={loading ? { status: "loading" } : data}
      onNavigate={onNavigate}
      search={search}
    />
  );
}
