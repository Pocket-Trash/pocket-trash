import { describe, expect, it, vi } from "vitest";
import { createApp, createWebhookIntake } from "./app.js";

describe("Discord bot HTTP app", () => {
  it("reports health only when every runtime dependency is ready", async () => {
    const check = vi
      .fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true });
    const app = createApp({ readiness: { check } });

    expect((await app.request("/health")).status).toBe(503);
    expect((await app.request("/health")).status).toBe(200);
  });

  it("maps unavailable queue storage to a webhook 503", async () => {
    const handle = createWebhookIntake({
      enqueue: vi.fn().mockRejectedValue(new Error("Redis unavailable")),
      /**
       * Produces one normalized fixture delivery.
       *
       * @returns The normalized fixture delivery.
       */
      normalize: async () => ({ id: "delivery", payload: { version: 1 } }),
    });
    const app = createApp({
      readiness: { check: vi.fn().mockResolvedValue({ ok: true }) },
      webhookRoutes: [{ handle, path: "/webhooks/source" }],
    });

    expect(
      (await app.request("/webhooks/source", { method: "POST" })).status,
    ).toBe(503);
  });
});
