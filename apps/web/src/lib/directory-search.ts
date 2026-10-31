import type { SearchGroup, SearchKind, SearchResult } from "@package/services";
import { searchPublic } from "./search";
import {
  SEARCH_QUERY_MAX_LENGTH,
  SEARCH_QUERY_MIN_LENGTH,
} from "./search-constants";

/** Route-owned public-directory results and inline request feedback. */
export type DirectorySearchState = {
  /** Ranked public-index matches. */
  items: SearchResult[];
  /** Route request feedback. */
  status: "idle" | "loading" | "ready" | "error";
};

/**
 * Loads ranked public-directory matches under the router's cancellation lifetime.
 * @param query - Normalized URL-backed query.
 * @param group - Public directory scope; private and people search are excluded.
 * @param signal - Router-owned cancellation signal.
 * @returns Ranked matches or existing inline failure feedback.
 */
export async function loadDirectorySearch(
  query: string,
  group: Exclude<SearchGroup, "all" | "people">,
  signal: AbortSignal,
): Promise<DirectorySearchState> {
  const normalized = query.trim();
  if (normalized.length < SEARCH_QUERY_MIN_LENGTH)
    return { items: [], status: "idle" };
  try {
    const { items } = await searchPublic({
      data: { group, query: normalized, surface: "directory" },
      signal,
    });
    return { items, status: "ready" };
  } catch {
    return { items: [], status: "error" };
  }
}

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
