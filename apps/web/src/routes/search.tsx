import type { SearchGroup } from "@package/services";
import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import * as React from "react";
import { SEARCH_QUERY_MAX_LENGTH } from "@/lib/search-constants";
import {
  type SearchNavigationOptions,
  SearchPage,
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

/** Defines the shareable public search route. */
export const Route = createFileRoute("/search")({
  component: SearchRoute,
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
  const search = Route.useSearch();
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
      void navigate({
        replace: options.replace,
        search: nextSearch,
        to: "/search",
      });
    },
    [navigate],
  );

  React.useEffect(() => {
    const current = new URLSearchParams(window.location.search);
    const canonical = new URLSearchParams();
    if (search.q) canonical.set("q", search.q);
    if (search.type) canonical.set("type", search.type);
    if (search.page) canonical.set("page", String(search.page));
    if (current.toString() !== canonical.toString()) {
      onNavigate(search, { replace: true });
    }
  }, [onNavigate, search]);

  return <SearchPage onNavigate={onNavigate} search={search} />;
}
