import { describe, expect, it, vi } from "vitest";
import { drainAuditQueue } from "./audit.js";

describe("audit delivery runtime", () => {
  it("drains only the bounded due queue", async () => {
    const processDue = vi.fn().mockResolvedValue(true);
    await expect(drainAuditQueue({ processDue }, 3)).resolves.toBe(3);
    expect(processDue).toHaveBeenCalledTimes(3);
  });
});
