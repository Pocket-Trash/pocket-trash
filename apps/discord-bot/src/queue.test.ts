import { createInMemoryQueueAdapter } from "@package/queue";
import { describe, expect, it, vi } from "vitest";
import { createDeliveryQueueRuntime } from "./queue.js";

describe("delivery queue runtime", () => {
  it("starts continuously and closes its worker, queue, and adapter", async () => {
    const adapter = createInMemoryQueueAdapter();
    const pendingDelivery = { resolve: undefined as (() => void) | undefined };
    const delivery = new Promise<void>((resolve) => {
      pendingDelivery.resolve = resolve;
    });
    const deliver = vi.fn(() => delivery);
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
          notification: {
            description: "Queue test",
            occurredAt: "2026-10-17T23:00:00.000Z",
            provenance: "test",
            source: "System",
            status: "Test",
            tags: ["test"],
            title: "Queue test",
            tone: "info",
          },
          version: 1,
        },
      }),
    ).toEqual({ accepted: true, replacedCompleted: false });
    await vi.waitFor(() => expect(deliver).toHaveBeenCalledOnce());

    let closed = false;
    const close = runtime.close().then(() => {
      closed = true;
    });
    await Promise.resolve();
    expect(closed).toBe(false);
    pendingDelivery.resolve?.();
    await close;
    expect(runtime.started()).toBe(false);
    await expect(
      runtime.enqueue({
        id: "delivery-2",
        name: "notification",
        payload: {
          deliveryId: "delivery-2",
          destinationChannelId: "123456789012345678",
          kind: "system",
          notification: {
            description: "Queue test",
            occurredAt: "2026-10-17T23:00:00.000Z",
            provenance: "test",
            source: "System",
            status: "Test",
            tags: ["test"],
            title: "Queue test",
            tone: "info",
          },
          version: 1,
        },
      }),
    ).rejects.toThrow("closed");
  });
});
