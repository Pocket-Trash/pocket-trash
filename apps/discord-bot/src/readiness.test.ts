import { describe, expect, it, vi } from "vitest";
import { createReadiness } from "./readiness.js";

describe("bot readiness", () => {
  it("requires Discord, Redis, and the delivery worker", async () => {
    const queueCounts = vi.fn().mockResolvedValue({
      active: 0,
      delayed: 0,
      failed: 0,
      waiting: 0,
    });
    const readiness = createReadiness(queueCounts);

    expect(await readiness.check()).toEqual({ ok: false });
    readiness.setGatewayReady(true);
    readiness.setWorkerStarted(true);
    expect(await readiness.check()).toEqual({ ok: false });
    readiness.setReconcilerStarted(true);
    expect(await readiness.check()).toEqual({ ok: true });

    queueCounts.mockRejectedValueOnce(new Error("Redis unavailable"));
    expect(await readiness.check()).toEqual({ ok: false });
  });
});
