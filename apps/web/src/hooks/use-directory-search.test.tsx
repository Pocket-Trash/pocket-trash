/** @vitest-environment jsdom */

import type { SearchGroup, SearchResult } from "@package/services";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Mocked public search request. */
const searchPublic = vi.hoisted(() => vi.fn());
vi.mock("@/lib/search", () => ({ searchPublic }));

import { useDirectorySearch } from "./use-directory-search";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

/** Search-hook probe properties. */
type ProbeProps = {
  /** Search scope. */
  group: SearchGroup;
  /** Search query. */
  query: string;
};

/** Deferred search response used by the hook test. */
type SearchResponse = {
  /** Ranked search results. */
  items: SearchResult[];
};

/**
 * Resolves a deferred search response.
 *
 * @param response - Search response to settle.
 * @returns Nothing.
 */
type ResolveSearch = (response: SearchResponse) => void;

/**
 * Renders public directory-search hook state for assertions.
 *
 * @param props - Probe properties.
 * @returns Serialized hook state.
 */
function Probe({ group, query }: ProbeProps) {
  const state = useDirectorySearch(
    query,
    group as Exclude<SearchGroup, "all" | "people">,
  );
  return (
    <output>{`${state.status}:${state.items.map(({ id }) => id).join(",")}`}</output>
  );
}

describe("useDirectorySearch", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    searchPublic.mockReset();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("queries the selected public scope and skips short input", async () => {
    searchPublic.mockResolvedValueOnce({
      items: [
        {
          highlights: [],
          href: "/makers/acme",
          id: 7,
          kind: "maker",
          title: "Acme",
        },
      ],
    });
    await act(async () => root.render(<Probe group="makers" query="ac" />));

    expect(searchPublic).toHaveBeenCalledWith({
      data: { group: "makers", query: "ac", surface: "directory" },
    });
    expect(container.textContent).toBe("ready:7");

    act(() => root.render(<Probe group="makers" query="a" />));
    expect(searchPublic).toHaveBeenCalledTimes(1);
    expect(container.textContent).toBe("idle:");
  });

  it("ignores results from an older query", async () => {
    let resolveOld: ResolveSearch | undefined;
    /**
     * Captures the deferred search resolver.
     *
     * @param resolve - Promise resolver supplied by the platform.
     */
    function captureResolver(resolve: ResolveSearch) {
      resolveOld = resolve;
    }
    const old = new Promise<SearchResponse>(captureResolver);
    /**
     * Returns the pending older search result.
     *
     * @returns Pending result for the older query.
     */
    function searchOldQuery() {
      return old;
    }
    searchPublic.mockImplementationOnce(searchOldQuery).mockResolvedValueOnce({
      items: [
        {
          highlights: [],
          href: "/makers/new",
          id: 2,
          kind: "maker",
          title: "New",
        },
      ],
    });

    act(() => root.render(<Probe group="makers" query="old" />));
    await act(async () => root.render(<Probe group="makers" query="new" />));
    expect(container.textContent).toBe("ready:2");

    await act(async () =>
      resolveOld?.({
        items: [
          {
            highlights: [],
            href: "/makers/old",
            id: 1,
            kind: "maker",
            title: "Old",
          },
        ],
      }),
    );
    expect(container.textContent).toBe("ready:2");
  });
});
