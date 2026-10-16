import { createInMemoryQueueAdapter } from "@package/queue";
import { describe, expect, it, vi } from "vitest";
import { createDeliveryQueueRuntime } from "./queue.js";

describe("delivery queue runtime", () => {
  it("starts continuously and closes its worker, queue, and adapter", async () => {
    const adapter = createInMemoryQueueAdapter();
    const deliver = vi.fn().mockResolvedValue(undefined);
    const runtime = createDeliveryQueueRuntime({ adapter, deliver });

    await runtime.start();
    expect(runtime.started()).toBe(true);
    expect(
      await runtime.enqueue({
        id: "delivery-1",
        name: "notification",
        payload: {
          deliveryId: "delivery-1",
          destinationChannelId: "123456789012345678",
          kind: "system",
          version: 1,
        },
      }),
    ).toEqual({ accepted: true, replacedCompleted: false });
    await vi.waitFor(() => expect(deliver).toHaveBeenCalledOnce());

    await runtime.close();
    expect(runtime.started()).toBe(false);
    await expect(
      runtime.enqueue({
        id: "delivery-2",
        name: "notification",
        payload: {
          deliveryId: "delivery-2",
          destinationChannelId: "123456789012345678",
          kind: "system",
          version: 1,
        },
      }),
    ).rejects.toThrow("closed");
  });
});
