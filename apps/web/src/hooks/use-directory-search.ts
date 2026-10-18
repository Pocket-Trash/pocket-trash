import type { SearchGroup, SearchResult } from "@package/services";
import * as React from "react";
import { searchPublic } from "@/lib/search";
import { SEARCH_QUERY_MIN_LENGTH } from "@/lib/search-constants";

/** Current public-directory search request state. */
export type DirectorySearchState = {
  /** Ranked public-index matches. */
  items: SearchResult[];
  /** Request state for inline feedback. */
  status: "idle" | "loading" | "ready" | "error";
};

/**
 * Loads every ranked match for one public directory scope.
 *
 * @param query - URL-backed directory query.
 * @param group - Public search group represented by the directory.
 * @returns Ranked matches and request state.
 */
export function useDirectorySearch(
  query: string,
  group: Exclude<SearchGroup, "all" | "people">,
): DirectorySearchState {
  const request = React.useRef(0);
  const [state, setState] = React.useState<DirectorySearchState>({
    items: [],
    status: "idle",
  });

  React.useEffect(() => {
    const normalizedQuery = query.trim();
    const currentRequest = ++request.current;
    if (normalizedQuery.length < SEARCH_QUERY_MIN_LENGTH) {
      setState({ items: [], status: "idle" });
      return;
    }

    setState({ items: [], status: "loading" });
    void searchPublic({
      data: { group, query: normalizedQuery, surface: "directory" },
    })
      .then(({ items }) => {
        if (request.current === currentRequest) {
          setState({ items, status: "ready" });
        }
      })
      .catch(() => {
        if (request.current === currentRequest) {
          setState({ items: [], status: "error" });
        }
      });
  }, [group, query]);

  return state;
}
