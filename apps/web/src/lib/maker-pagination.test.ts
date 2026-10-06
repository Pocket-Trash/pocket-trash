import { describe, expect, it } from "vitest";
import {
  isCanonicalMakerSearch,
  parseMakerDetailSearch,
  parseMakerPage,
  withMakerPage,
} from "./maker-pagination";

describe("maker pagination", () => {
  it("normalizes missing, invalid, stale, and one-based page values", () => {
    expect(parseMakerPage(undefined)).toBe(1);
    expect(parseMakerPage("nope")).toBe(1);
    expect(parseMakerPage(-4)).toBe(1);
    expect(parseMakerPage("3")).toBe(3);
    expect(
      parseMakerDetailSearch({ collectionItemsPage: "2", productsPage: 1 }),
    ).toEqual({ collectionItemsPage: 2 });
  });

  it("updates either page without discarding the other", () => {
    expect(
      withMakerPage(
        { collectionItemsPage: 4, productsPage: 2 },
        "productsPage",
        5,
      ),
    ).toEqual({ collectionItemsPage: 4, productsPage: 6 });
    expect(
      withMakerPage(
        { collectionItemsPage: 4, productsPage: 2 },
        "collectionItemsPage",
        0,
      ),
    ).toEqual({ collectionItemsPage: undefined, productsPage: 2 });
  });

  it("detects malformed and redundant raw page parameters", () => {
    expect(isCanonicalMakerSearch("?productsPage=2", { productsPage: 2 })).toBe(
      true,
    );
    expect(isCanonicalMakerSearch("?productsPage=0", {})).toBe(false);
    expect(isCanonicalMakerSearch("?productsPage=nope", {})).toBe(false);
    expect(isCanonicalMakerSearch("?collectionItemsPage=1", {})).toBe(false);
    expect(
      isCanonicalMakerSearch("?productsPage=02&collectionItemsPage=3", {
        collectionItemsPage: 3,
        productsPage: 2,
      }),
    ).toBe(false);
  });
});
