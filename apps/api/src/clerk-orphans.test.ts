import { describe, expect, it, vi } from "vitest";
import { findClerkOrphans } from "./clerk-orphans.js";

describe("Clerk orphan report", () => {
  it("reports local-only users without mutating them", async () => {
    const getUserList = vi.fn().mockResolvedValue({
      data: [{ id: "user_present" }],
      totalCount: 1,
    });
    const listClerkIds = vi
      .fn()
      .mockResolvedValue(["user_present", "user_missing"]);

    await expect(
      findClerkOrphans({ getUserList }, { listClerkIds }),
    ).resolves.toEqual(["user_missing"]);
    expect(getUserList).toHaveBeenCalledOnce();
    expect(listClerkIds).toHaveBeenCalledOnce();
  });
});
