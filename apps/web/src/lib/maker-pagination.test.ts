import { describe, expect, it } from "vitest";
import {
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
});
