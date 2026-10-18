import { describe, expect, it } from "vitest";
import { parseSearchPageSearch } from "./search";

describe("parseSearchPageSearch", () => {
  it("omits defaults and normalizes invalid values", () => {
    expect(parseSearchPageSearch({})).toEqual({});
    expect(
      parseSearchPageSearch({ page: "1", q: "  ", type: "unknown" }),
    ).toEqual({});
    expect(
      parseSearchPageSearch({ page: "3", q: "  bolt pen  ", type: "makers" }),
    ).toEqual({ page: 3, q: "bolt pen", type: "makers" });
    expect(
      parseSearchPageSearch({ page: "1.5", q: "bolt", type: "all" }),
    ).toEqual({ q: "bolt" });
  });
});
