import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath, URL as NodeUrl } from "node:url";
import { createNoopLogger } from "@package/logger";
import type { FeedbackService } from "@package/services";
import { describe, expect, it, vi } from "vitest";
import {
  createLinearWebhookHandler,
  linearWebhookPath,
} from "./linear-webhooks.js";
import { isValidTarget } from "./webhook-forwarding.js";

/** Signing secret used by webhook tests. */
const signingSecret = "linear-webhook-test-secret";
/** Fixed current time used by replay-protection tests. */
const now = new Date("2026-09-30T12:05:00Z");

describe("Linear webhooks", () => {
  it("verifies the exact body and forwards a current lifecycle event", async () => {
    const syncLinearStatus = vi.fn().mockResolvedValue("updated");
    const request = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 200 }));
    const targets = {
      list: vi.fn().mockResolvedValue({
        cacheStatus: null,
        keys: [
          {
            metadata: {
              kind: "preview",
              url: "https://pr-12-pocket-trash-api-preview.example.workers.dev/api/v0/webhooks/linear",
            },
            name: "linear-target:preview:12",
          },
        ],
        list_complete: true,
      }),
    } as unknown as KVNamespace;
    const handle = createLinearWebhookHandler({
      feedback: { syncLinearStatus } as Pick<
        FeedbackService,
        "syncLinearStatus"
      >,
      fetch: request,
      logger: createNoopLogger(),
      /**
       * Returns the fixed test time.
       *
       * @returns The fixed test time.
       */
      now: () => now,
      signingSecret,
      targets,
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

    const response = await handle(signedRequest(body), "development");

    expect(response.status).toBe(200);
    expect(syncLinearStatus).toHaveBeenCalledWith({
      action: "update",
      archived: false,
      entityType: "issue",
      entityUuid: "11111111-1111-4111-8111-111111111111",
      occurredAt: new Date("2026-09-30T12:04:00.000Z"),
      stateType: "started",
    });
    expect(targets.list).toHaveBeenCalledWith({ prefix: "linear-target:" });
    expect(request).toHaveBeenCalledWith(
      "https://pr-12-pocket-trash-api-preview.example.workers.dev/api/v0/webhooks/linear",
      expect.objectContaining({
        headers: {
          "content-type": "application/json",
          "linear-delivery": "22222222-2222-4222-8222-222222222222",
          "linear-event": "Issue",
          "linear-signature": createHmac("sha256", signingSecret)
            .update(body)
            .digest("hex"),
          "linear-timestamp": String(now.getTime()),
        },
        method: "POST",
      }),
    );
    expect(
      new TextDecoder().decode(request.mock.calls[0]?.[1]?.body as ArrayBuffer),
    ).toBe(body);
  });

  it("never forwards from production", async () => {
    const request = vi.fn();
    const handle = createLinearWebhookHandler({
      feedback: { syncLinearStatus: vi.fn().mockResolvedValue("updated") },
      fetch: request,
      logger: createNoopLogger(),
      /**
       * Returns the fixed test time.
       *
       * @returns The fixed test time.
       */
      now: () => now,
      signingSecret,
      targets: {
        list: vi.fn(),
      } as unknown as KVNamespace,
    });
    const body = lifecycleBody();

    const response = await handle(signedRequest(body), "production");

    expect(response.status).toBe(200);
    expect(request).not.toHaveBeenCalled();
  });

  it("isolates and validates Linear targets", () => {
    expect(
      isValidTarget(
        "linear",
        "target:preview:12",
        {
          kind: "preview",
          url: "https://pr-12-pocket-trash-api-preview.example.workers.dev/api/v0/webhooks/linear",
        },
        linearWebhookPath,
      ),
    ).toBe(false);
    expect(
      isValidTarget(
        "linear",
        "linear-target:local:RA",
        {
          kind: "local",
          url: "https://quiet-river.trycloudflare.com/api/v0/webhooks/linear/ra",
        },
        linearWebhookPath,
      ),
    ).toBe(true);
    expect(
      isValidTarget(
        "linear",
        "linear-target:local:RA",
        {
          kind: "local",
          url: "https://attacker.example/api/v0/webhooks/linear/ra",
        },
        linearWebhookPath,
      ),
    ).toBe(false);
  });

  it("returns a retryable failure when forwarding fails", async () => {
    const handle = createLinearWebhookHandler({
      feedback: { syncLinearStatus: vi.fn().mockResolvedValue("updated") },
      fetch: vi.fn().mockResolvedValue(new Response(null, { status: 500 })),
      logger: createNoopLogger(),
      /**
       * Returns the fixed test time.
       *
       * @returns The fixed test time.
       */
      now: () => now,
      signingSecret,
      targets: {
        list: vi.fn().mockResolvedValue({
          keys: [
            {
              metadata: {
                kind: "preview",
                url: "https://pr-12-pocket-trash-api-preview.example.workers.dev/api/v0/webhooks/linear",
              },
              name: "linear-target:preview:12",
            },
          ],
        }),
      } as unknown as KVNamespace,
    });

    const response = await handle(
      signedRequest(lifecycleBody()),
      "development",
    );

    expect(response.status).toBe(500);
  });

  it("registers and removes preview and local Linear targets", () => {
    const deploy = readFileSync(
      fileURLToPath(
        new NodeUrl("../../../.github/workflows/deploy.yml", import.meta.url),
      ),
      "utf8",
    );
    const cleanup = readFileSync(
      fileURLToPath(
        new NodeUrl(
          "../../../.github/workflows/preview-infrastructure-cleanup.yml",
          import.meta.url,
        ),
      ),
      "utf8",
    );
    const local = readFileSync(
      fileURLToPath(
        new NodeUrl("../../../scripts/dev-webhooks.mjs", import.meta.url),
      ),
      "utf8",
    );

    expect(deploy).toContain('kv key put "linear-target:preview:');
    expect(deploy).toContain('kv key delete "linear-target:preview:');
    expect(cleanup).toContain('kv key delete "linear-target:preview:');
    expect(local).toContain("linear-target:local:");
    expect(local).toContain('"cloudflared"');
  });

  it("rejects invalid signatures and stale signed payloads before handling", async () => {
    const syncLinearStatus = vi.fn();
    const handle = createLinearWebhookHandler({
      feedback: { syncLinearStatus } as Pick<
        FeedbackService,
        "syncLinearStatus"
      >,
      logger: createNoopLogger(),
      /**
       * Returns the fixed test time.
       *
       * @returns The fixed test time.
       */
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

/**
 * Creates a signed Linear webhook request.
 *
 * @param body - Serialized webhook payload.
 * @returns A signed request.
 */
function signedRequest(body: string) {
  return new Request("https://api.example.test/api/v0/webhooks/linear", {
    body,
    headers: {
      "content-type": "application/json",
      "linear-delivery": "22222222-2222-4222-8222-222222222222",
      "linear-event": "Issue",
      "linear-signature": createHmac("sha256", signingSecret)
        .update(body)
        .digest("hex"),
      "linear-timestamp": String(now.getTime()),
    },
    method: "POST",
  });
}

/**
 * Creates a current Linear issue lifecycle payload.
 *
 * @returns Serialized webhook payload.
 */
function lifecycleBody() {
  return JSON.stringify({
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
}
