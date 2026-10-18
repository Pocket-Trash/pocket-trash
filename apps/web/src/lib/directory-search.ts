import type { SearchKind, SearchResult } from "@package/services";
import { SEARCH_QUERY_MAX_LENGTH } from "./search-constants";

/** URL state shared by public directory searches. */
export type DirectorySearch = {
  /** Normalized search query. */
  q?: string;
};

/**
 * Normalizes untrusted public-directory route search.
 *
 * @param value - Untrusted route search values.
 * @returns Canonical query with blank values omitted.
 */
export function parseDirectorySearch(
  value: Record<string, unknown>,
): DirectorySearch {
  const q =
    typeof value.q === "string"
      ? value.q.trim().slice(0, SEARCH_QUERY_MAX_LENGTH).trim()
      : "";
  return q ? { q } : {};
}

/**
 * Extracts ranked directory identifiers, optionally rolling nested matches up.
 *
 * @param results - Ranked central-index matches.
 * @param directKinds - Kinds whose own identifier is displayed.
 * @param childKinds - Kinds whose parent identifier is displayed.
 * @returns Deduplicated identifiers in central-index rank order.
 */
export function rankedDirectoryIds(
  results: SearchResult[],
  directKinds: ReadonlySet<SearchKind>,
  childKinds: ReadonlySet<SearchKind> = new Set(),
) {
  const ids: number[] = [];
  const seen = new Set<number>();
  for (const result of results) {
    const id = directKinds.has(result.kind)
      ? result.id
      : childKinds.has(result.kind)
        ? result.parentId
        : undefined;
    if (id !== undefined && !seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}
