import { createInMemoryQueueAdapter } from "@package/queue";
import { describe, expect, it, vi } from "vitest";
import { createDeliveryQueueRuntime } from "./queue.js";

describe("delivery queue runtime", () => {
  it("escapes operational IDs for BullMQ without conflating literal escapes", async () => {
    const adapter = createInMemoryQueueAdapter();
    const define = adapter.define.bind(adapter);
    const ids: string[] = [];
    vi.spyOn(adapter, "define").mockImplementation((definition) => {
      const queue = define(definition);
      const enqueue = queue.enqueue.bind(queue);
      vi.spyOn(queue, "enqueue").mockImplementation((input) => {
        ids.push(input.id);
        return enqueue(input);
      });
      return queue;
    });
    const runtime = createDeliveryQueueRuntime({ adapter, deliver: vi.fn() });
    const notification = {
      description: "test",
      occurredAt: new Date().toISOString(),
      provenance: "test",
      source: "test",
      status: "test",
      tags: [],
      title: "test",
      tone: "warning" as const,
    };
    for (const id of [
      "axiom-parser-error:message",
      "axiom-parser-error%3Amessage",
    ]) {
      await runtime.enqueue({
        id,
        name: "health",
        payload: {
          deliveryId: id,
          destinationChannelId: "123456789012345678",
          kind: "system",
          notification,
          version: 1,
        },
      });
    }
    expect(ids).toEqual([
      "axiom-parser-error%3Amessage",
      "axiom-parser-error%253Amessage",
    ]);
    await runtime.close();
  });
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
