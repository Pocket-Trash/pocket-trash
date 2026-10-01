import { createHmac } from "node:crypto";
import { createNoopLogger } from "@package/logger";
import type { FeedbackService } from "@package/services";
import { describe, expect, it, vi } from "vitest";
import { createLinearWebhookHandler } from "./linear-webhooks.js";

const signingSecret = "linear-webhook-test-secret";
const now = new Date("2026-09-30T12:05:00Z");

describe("Linear webhooks", () => {
  it("verifies the exact body and forwards a current lifecycle event", async () => {
    const syncLinearStatus = vi.fn().mockResolvedValue("updated");
    const handle = createLinearWebhookHandler({
      feedback: { syncLinearStatus } as Pick<
        FeedbackService,
        "syncLinearStatus"
      >,
      logger: createNoopLogger(),
      now: () => now,
      signingSecret,
    });
    const body = JSON.stringify({
      action: "update",
      createdAt: "2026-09-30T12:04:00.000Z",
      data: {
        archivedAt: null,
        id: "11111111-1111-4111-8111-111111111111",
        state: { type: "started" },
        updatedAt: "2026-09-30T12:04:00.000Z",
      },
      type: "Issue",
      webhookTimestamp: now.getTime(),
    });

    const response = await handle(signedRequest(body));

    expect(response.status).toBe(200);
    expect(syncLinearStatus).toHaveBeenCalledWith({
      action: "update",
      archived: false,
      entityType: "issue",
      entityUuid: "11111111-1111-4111-8111-111111111111",
      occurredAt: new Date("2026-09-30T12:04:00.000Z"),
      stateType: "started",
    });
  });

  it("rejects invalid signatures and stale signed payloads before handling", async () => {
    const syncLinearStatus = vi.fn();
    const handle = createLinearWebhookHandler({
      feedback: { syncLinearStatus } as Pick<
        FeedbackService,
        "syncLinearStatus"
      >,
      logger: createNoopLogger(),
      now: () => now,
      signingSecret,
    });

    const invalid = await handle(
      new Request("https://api.example.test/api/v0/webhooks/linear", {
        body: "not-json",
        headers: { "linear-signature": "00".repeat(32) },
        method: "POST",
      }),
    );
    const staleBody = JSON.stringify({
      action: "remove",
      createdAt: "2026-09-30T12:03:00.000Z",
      data: { id: "11111111-1111-4111-8111-111111111111" },
      type: "Project",
      webhookTimestamp: now.getTime() - 60_001,
    });
    const stale = await handle(signedRequest(staleBody));

    expect(invalid.status).toBe(401);
    expect(stale.status).toBe(401);
    expect(syncLinearStatus).not.toHaveBeenCalled();
  });
});

function signedRequest(body: string) {
  return new Request("https://api.example.test/api/v0/webhooks/linear", {
    body,
    headers: {
      "content-type": "application/json",
      "linear-delivery": "22222222-2222-4222-8222-222222222222",
      "linear-signature": createHmac("sha256", signingSecret)
        .update(body)
        .digest("hex"),
    },
    method: "POST",
  });
}
