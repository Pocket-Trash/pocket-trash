import { describe, expect, it, vi } from "vitest";

vi.mock("@/env/server", () => ({
  serverEnv: {
    CLERK_SECRET_KEY: "sk_test_example",
    ERASURE_HMAC_SECRET: "test-erasure-hmac-secret-at-least-32-characters",
  },
}));

import {
  parseAdminErasureInput,
  parseSelfErasureInput,
  selfErasureClerkId,
} from "./account-erasure";

describe("account erasure input", () => {
  it("requires an explicit self-service confirmation", () => {
    expect(parseSelfErasureInput({ confirmed: true })).toEqual({
      confirmed: true,
    });
    expect(() => parseSelfErasureInput({ confirmed: false })).toThrow();
  });

  it("distinguishes Clerk deletion from a status lookup failure", () => {
    expect(
      selfErasureClerkId({ isAuthenticated: false, userId: null }),
    ).toBeNull();
    expect(
      selfErasureClerkId({ isAuthenticated: true, userId: "user_123" }),
    ).toBe("user_123");
  });

  it("accepts only bounded, opaque admin verification evidence", () => {
    expect(
      parseAdminErasureInput({
        email: " USER@example.com ",
        targetClerkId: "user_123",
        verificationMethod: "verified_email",
        verificationReference: "privacy_request:123",
      }),
    ).toEqual({
      email: "user@example.com",
      targetClerkId: "user_123",
      verificationMethod: "verified_email",
      verificationReference: "privacy_request:123",
    });
    expect(() =>
      parseAdminErasureInput({
        email: "user@example.com",
        targetClerkId: "user_456",
        verificationMethod: "unverified",
        verificationReference: "contains personal data",
      }),
    ).toThrow();
  });
});
