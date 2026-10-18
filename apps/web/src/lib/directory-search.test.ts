import { describe, expect, it } from "vitest";
import { parseDirectorySearch, rankedDirectoryIds } from "./directory-search";

describe("public directory search", () => {
  it("normalizes URL query state", () => {
    expect(parseDirectorySearch({ q: "  maker  " })).toEqual({ q: "maker" });
    expect(parseDirectorySearch({ q: "   " })).toEqual({});
  });

  it("keeps rank while rolling child matches up to unique parents", () => {
    expect(
      rankedDirectoryIds(
        [
          {
            highlights: [],
            href: "/collections/1/8/items/4",
            id: 4,
            kind: "collection_item",
            parentId: 8,
            title: "Item",
          },
          {
            highlights: [],
            href: "/collections/1/8",
            id: 8,
            kind: "collection",
            title: "Collection",
          },
          {
            highlights: [],
            href: "/collections/1/9",
            id: 9,
            kind: "collection",
            title: "Other",
          },
        ],
        new Set(["collection"]),
        new Set(["collection_item"]),
      ),
    ).toEqual([8, 9]);
  });

  it("keeps directory scopes isolated while rolling material details up", () => {
    expect(
      rankedDirectoryIds(
        [
          {
            highlights: [],
            href: "/makers/acme",
            id: 1,
            kind: "maker",
            title: "Acme",
          },
          {
            highlights: [],
            href: "/materials/aluminum/6061",
            id: 22,
            kind: "material_detail",
            parentId: 2,
            title: "Aluminum 6061",
          },
          {
            highlights: [],
            href: "/materials/aluminum",
            id: 2,
            kind: "material",
            title: "Aluminum",
          },
        ],
        new Set(["material"]),
        new Set(["material_detail"]),
      ),
    ).toEqual([2]);
  });
});
