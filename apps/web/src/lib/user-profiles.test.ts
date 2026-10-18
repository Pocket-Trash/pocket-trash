import { beforeEach, describe, expect, it, vi } from "vitest";

/** Direct server-function input used by the test builder. */
type ServerFunctionInput = {
  /** Untrusted request data. */
  data: unknown;
};

/** Exact username lookup spy. */
const getByUsername = vi.hoisted(() => vi.fn());

vi.mock("@/lib/services", () => ({ s: { db: { users: { getByUsername } } } }));
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

import { getPublicUserProfile } from "./user-profiles";

describe("getPublicUserProfile", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns only the public username", async () => {
    getByUsername.mockResolvedValueOnce({ id: 1000, username: "SearchPerson" });

    await expect(
      getPublicUserProfile({ data: { username: "SearchPerson" } }),
    ).resolves.toEqual({ username: "SearchPerson" });
  });

  it("returns not-found for a user without a username", async () => {
    getByUsername.mockResolvedValueOnce({ id: 1000, username: null });

    await expect(
      getPublicUserProfile({ data: { username: "former-user" } }),
    ).resolves.toBeNull();
  });
});
