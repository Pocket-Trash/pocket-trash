import { ClerkAPIResponseError } from "@clerk/backend/errors";
import { describe, expect, it, vi } from "vitest";
import { createErasureOperations, drainErasureQueue } from "./erasure.js";

/** Reusable self-service erasure request fixture. */
const request = {
  id: "request_123",
  initiator: "self" as const,
  subjectHmac: "a".repeat(64),
  targetClerkId: "user_123",
};

describe("erasure runtime", () => {
  it("deletes Clerk last, accepts an absent user, and verifies absence", async () => {
    const deleteUser = vi.fn().mockRejectedValue(missingClerkUser());
    const getUser = vi.fn().mockRejectedValue(missingClerkUser());
    const eraseDatabase = vi.fn();
    const makeAccountInaccessible = vi.fn();
    const eraseAccountObjects = vi.fn();
    const snapshotErasureTargets = vi.fn();
    const operations = createErasureOperations({
      clerk: { deleteUser, getUser },
      erasure: { eraseDatabase, makeAccountInaccessible },
      /**
       * Returns the fixed retention timestamp used by assertions.
       *
       * @returns Deterministic test time.
       */
      now: () => new Date("2026-09-29T12:00:00.000Z"),
      storage: { eraseAccountObjects, snapshotErasureTargets },
    });

    await operations.snapshot(request);
    await operations.inaccessible(request);
    await operations.storage(request);
    await operations.database(request);
    await expect(operations.providers(request)).resolves.toMatchObject({
      exceptions: expect.arrayContaining([
        expect.objectContaining({ code: "axiom_30_days" }),
        expect.objectContaining({ code: "clerk_deletion_3_days" }),
        expect.objectContaining({ code: "neon_history_6_hours" }),
      ]),
    });
    await expect(operations.verify(request)).resolves.toBeUndefined();

    expect(snapshotErasureTargets).toHaveBeenCalledWith(
      "request_123",
      "user_123",
    );
    expect(eraseAccountObjects).toHaveBeenCalledWith("request_123", "user_123");
    expect(deleteUser).toHaveBeenCalledWith("user_123");
    expect(getUser).toHaveBeenCalledWith("user_123");
  });

  it("drains only the bounded due queue", async () => {
    const processDue = vi.fn().mockResolvedValue(true);
    await expect(
      drainErasureQueue({ processDue } as never, {} as never, 3),
    ).resolves.toBe(3);
    expect(processDue).toHaveBeenCalledTimes(3);
  });

  it("does not treat other Clerk failures as deletion", async () => {
    const clerkFailure = new ClerkAPIResponseError("Unavailable", {
      data: [],
      status: 503,
    });
    const operations = createErasureOperations({
      clerk: {
        deleteUser: vi.fn().mockRejectedValue(clerkFailure),
        getUser: vi.fn().mockRejectedValue(clerkFailure),
      },
      erasure: {
        eraseDatabase: vi.fn(),
        makeAccountInaccessible: vi.fn(),
      },
      storage: {
        eraseAccountObjects: vi.fn(),
        snapshotErasureTargets: vi.fn(),
      },
    });

    await expect(operations.providers(request)).rejects.toMatchObject({
      code: "clerk_delete_failed",
    });
    await expect(operations.verify(request)).rejects.toMatchObject({
      code: "clerk_verification_failed",
    });
  });
});

/**
 * Creates the Clerk SDK error returned for an absent user.
 *
 * @returns Clerk 404 response error.
 */
function missingClerkUser() {
  return new ClerkAPIResponseError("Not found", {
    data: [],
    status: 404,
  });
}
