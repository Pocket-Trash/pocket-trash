import { beforeEach, describe, expect, it, vi } from "vitest";

/** Public search boundary used by route directory loaders. */
const searchPublic = vi.hoisted(() => vi.fn());
vi.mock("./search", () => ({ searchPublic }));

import { loadDirectorySearch } from "./directory-search";

describe("public directory result loading", () => {
  beforeEach(() => {
    searchPublic.mockReset();
  });

  it("skips short queries and preserves public directory scope and cancellation", async () => {
    const signal = new AbortController().signal;
    expect(await loadDirectorySearch(" a ", "makers", signal)).toEqual({
      items: [],
      status: "idle",
    });
    expect(searchPublic).not.toHaveBeenCalled();
    const items = [
      {
        highlights: [],
        href: "/makers/acme",
        id: 7,
        kind: "maker",
        title: "Acme",
      },
    ];
    searchPublic.mockResolvedValue({ items });
    expect(await loadDirectorySearch(" ac ", "makers", signal)).toEqual({
      items,
      status: "ready",
    });
    expect(searchPublic).toHaveBeenCalledExactlyOnceWith({
      data: { group: "makers", query: "ac", surface: "directory" },
      signal,
    });
  });

  it("returns inline failure feedback without replacing the directory's base data", async () => {
    searchPublic.mockRejectedValue(new Error("offline"));
    expect(
      await loadDirectorySearch(
        "bolt",
        "resources",
        new AbortController().signal,
      ),
    ).toEqual({ items: [], status: "error" });
  });
});
