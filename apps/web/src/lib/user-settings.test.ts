import { beforeEach, describe, expect, it, vi } from "vitest";

/** Direct server-function input used by the test builder. */
type ServerFunctionInput = {
  /** Untrusted request data. */
  data: unknown;
};

/** Mutable authentication result used by settings tests. */
const auth = vi.hoisted(() => vi.fn());
/** Persisted settings patch spy. */
const patchForClerkId = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ activeAuth: auth }));
vi.mock("@/lib/services", () => ({
  s: { db: { userSettings: { patchForClerkId } } },
}));
vi.mock("@tanstack/react-start", () => ({
  /**
   * Exposes server handlers directly while preserving their validators.
   *
   * @returns Minimal server-function builder for unit tests.
   */
  createServerFn() {
    /**
     * Exposes an unvalidated handler.
     *
     * @param handler - Server handler under test.
     * @returns The handler unchanged.
     */
    function exposeHandler(handler: CallableFunction) {
      return handler;
    }

    /**
     * Applies a validator before exposing a server handler.
     *
     * @param validator - Input validator under test.
     * @returns Minimal validated handler builder.
     */
    function applyValidator(validator: CallableFunction) {
      /**
       * Validates data before invoking the server handler.
       *
       * @param handler - Validated server handler.
       * @returns Directly callable test handler.
       */
      function exposeValidatedHandler(handler: CallableFunction) {
        /**
         * Validates one direct server-function call.
         *
         * @param input - Untrusted test input.
         * @returns The server handler result.
         */
        function validateAndHandle(input: ServerFunctionInput) {
          return handler({ data: validator(input.data) });
        }
        return validateAndHandle;
      }
      return { handler: exposeValidatedHandler };
    }

    return { handler: exposeHandler, validator: applyValidator };
  },
}));

import { defaultUserSettings, patchCurrentUserSettings } from "./user-settings";

describe("public Trends setting", () => {
  beforeEach(() => vi.clearAllMocks());

  it("defaults to private", () => {
    expect(defaultUserSettings.publishTrends).toBe(false);
  });

  it("does not allow an unauthenticated request to publish Trends", async () => {
    auth.mockResolvedValueOnce({ isAuthenticated: false, userId: null });

    await expect(
      patchCurrentUserSettings({ data: { publishTrends: true } }),
    ).resolves.toBeNull();
    expect(patchForClerkId).not.toHaveBeenCalled();
  });

  it("persists a boolean publication preference for the authenticated owner", async () => {
    auth.mockResolvedValueOnce({ isAuthenticated: true, userId: "user_123" });
    patchForClerkId.mockResolvedValueOnce({
      ...defaultUserSettings,
      publishTrends: true,
      userId: 1000,
    });

    await expect(
      patchCurrentUserSettings({ data: { publishTrends: true } }),
    ).resolves.toEqual({ ...defaultUserSettings, publishTrends: true });
    expect(patchForClerkId).toHaveBeenCalledWith("user_123", {
      publishTrends: true,
    });
  });
});

describe("profile visibility setting", () => {
  beforeEach(() => vi.clearAllMocks());

  it("defaults profiles to private", () => {
    expect(defaultUserSettings.isProfilePublic).toBe(false);
  });

  it("persists a strict boolean for the authenticated owner", async () => {
    auth.mockResolvedValueOnce({ isAuthenticated: true, userId: "user_123" });
    patchForClerkId.mockResolvedValueOnce({
      ...defaultUserSettings,
      isProfilePublic: true,
      userId: 1000,
    });

    await expect(
      patchCurrentUserSettings({ data: { isProfilePublic: true } }),
    ).resolves.toEqual({ ...defaultUserSettings, isProfilePublic: true });
    expect(patchForClerkId).toHaveBeenCalledWith("user_123", {
      isProfilePublic: true,
    });
  });

  it("always applies visibility changes to the authenticated account", async () => {
    auth.mockResolvedValueOnce({ isAuthenticated: true, userId: "user_123" });
    patchForClerkId.mockResolvedValueOnce({
      ...defaultUserSettings,
      isProfilePublic: true,
      userId: 1000,
    });

    await patchCurrentUserSettings({
      data: { isProfilePublic: true, targetUserId: "user_other" },
    });

    expect(patchForClerkId).toHaveBeenCalledWith("user_123", {
      isProfilePublic: true,
    });
  });

  it("rejects non-boolean profile visibility", () => {
    expect(() =>
      patchCurrentUserSettings({ data: { isProfilePublic: "true" } }),
    ).toThrow("Expected a user settings object.");
    expect(auth).not.toHaveBeenCalled();
  });
});
