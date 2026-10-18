import { beforeEach, describe, expect, it, vi } from "vitest";

/** Direct server-function input used by the test builder. */
type ServerFunctionInput = {
  /** Untrusted request data. */
  data: unknown;
};

/** Shared search-service spy. */
const search = vi.hoisted(() => vi.fn());

vi.mock("@/lib/services", () => ({ s: { db: { search: { search } } } }));
vi.mock("@tanstack/react-start", () => ({
  /**
   * Exposes validated server handlers directly for unit tests.
   *
   * @returns Minimal server-function builder.
   */
  createServerFn() {
    return {
      /**
       * Applies the validator before exposing a handler.
       *
       * @param validator - Input validator under test.
       * @returns Minimal validated handler builder.
       */
      validator(validator: CallableFunction) {
        return {
          /**
           * Exposes the validated server handler.
           *
           * @param handler - Validated handler under test.
           * @returns Directly callable handler.
           */
          handler(handler: CallableFunction) {
            return (input: ServerFunctionInput) =>
              handler({ data: validator(input.data) });
          },
        };
      },
    };
  },
}));

import { searchPublic } from "./search";

describe("searchPublic", () => {
  beforeEach(() => vi.clearAllMocks());

  it("passes validated public queries to the shared service", async () => {
    search.mockResolvedValueOnce({ items: [], total: 0 });

    await searchPublic({
      data: { group: "people", page: 2, query: "roy", surface: "page" },
    });

    expect(search).toHaveBeenCalledWith({
      group: "people",
      page: 2,
      query: "roy",
      surface: "page",
    });
  });

  it("rejects invalid search scopes at the server boundary", () => {
    expect(() =>
      searchPublic({
        data: { group: "private", query: "roy", surface: "modal" },
      }),
    ).toThrow();
    expect(search).not.toHaveBeenCalled();
  });
});
