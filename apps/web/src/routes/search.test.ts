import { describe, expect, it } from "vitest";
import { SEARCH_QUERY_MAX_LENGTH } from "@/lib/search-constants";
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
    expect(
      parseSearchPageSearch({
        q: ` ${"x".repeat(SEARCH_QUERY_MAX_LENGTH + 1)} `,
      }),
    ).toEqual({ q: "x".repeat(SEARCH_QUERY_MAX_LENGTH) });
  });
});
