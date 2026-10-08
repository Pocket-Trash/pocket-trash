import { createHmac } from "node:crypto";
import { createNoopLogger } from "@package/logger";
import { createErasureSubjectHmac } from "@package/services";
import { describe, expect, it, vi } from "vitest";
import {
  clerkWebhookPath,
  createClerkWebhookHandler,
} from "./clerk-webhooks.js";
import { forwardToTargets, isValidTarget } from "./webhook-forwarding.js";

/** Raw bytes encoded into the Clerk test signing secret. */
const secretBytes = "clerk-webhook-test-secret";
/** Clerk-compatible webhook signing secret for test requests. */
const signingSecret = `whsec_${Buffer.from(secretBytes).toString("base64")}`;

/**
 * Creates a valid signed Clerk user webhook request.
 *
 * @param type - Clerk user event type placed in the payload.
 * @returns Request with Svix signature headers.
 */
function signedRequest(type: "user.created" | "user.updated" = "user.created") {
  const body = JSON.stringify({
    data: {
      id: "user_secret",
      updated_at: 1_795_000_000_000,
      username: "roy",
    },
    event_attributes: { http_request: { client_ip: "", user_agent: "" } },
    object: "event",
    type,
  });
  const id = "msg_test";
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = createHmac("sha256", secretBytes)
    .update(`${id}.${timestamp}.${body}`)
    .digest("base64");

  return new Request(`https://api.pocket-trash.app${clerkWebhookPath}`, {
    body,
    headers: {
      "content-type": "application/json",
      "svix-id": id,
      "svix-signature": `v1,${signature}`,
      "svix-timestamp": timestamp,
    },
    method: "POST",
  });
}

describe("Clerk webhooks", () => {
  it("resumes erasure for a verified user.deleted event", async () => {
    const handleClerkDeletion = vi.fn().mockResolvedValue({
      requestId: "request-id",
      unexpected: false,
    });
    const erasureHmacSecret = "test-erasure-hmac-secret-at-least-32-characters";
    const response = await createClerkWebhookHandler({
      erasure: { handleClerkDeletion },
      erasureHmacSecret,
      logger: createNoopLogger(),
      signingSecret,
      users: { syncFromClerk: vi.fn() },
      verify: vi.fn().mockResolvedValue({
        data: { id: "user_secret" },
        type: "user.deleted",
      }) as never,
    })(signedRequest(), "production");

    expect(response.status).toBe(204);
    expect(handleClerkDeletion).toHaveBeenCalledWith({
      subjectHmac: await createErasureSubjectHmac(
        "user_secret",
        erasureHmacSecret,
      ),
      targetClerkId: "user_secret",
    });
  });

  it.each([
    "user.created",
    "user.updated",
  ] as const)("verifies and synchronizes %s", async (type) => {
    const syncFromClerk = vi.fn().mockResolvedValue("inserted");
    const response = await createClerkWebhookHandler({
      logger: createNoopLogger(),
      signingSecret,
      users: { syncFromClerk },
    })(signedRequest(type), "production");

    expect(response.status).toBe(204);
    expect(syncFromClerk).toHaveBeenCalledWith({
      clerkId: "user_secret",
      clerkUpdatedAt: new Date(1_795_000_000_000),
      imageUrl: null,
      username: "roy",
    });
  });

  it.each([
    [true, "https://img.clerk.com/original"],
    [true, "https://img.clerk.com/replacement"],
    [false, null],
  ])("mirrors selected pictures and clears generated avatars (%s, %s)", async (hasImage, imageUrl) => {
    const syncFromClerk = vi.fn().mockResolvedValue("updated");
    const response = await createClerkWebhookHandler({
      logger: createNoopLogger(),
      signingSecret,
      users: { syncFromClerk },
      verify: vi.fn().mockResolvedValue({
        type: "user.updated",
        data: {
          id: "user_secret",
          updated_at: 1,
          username: "roy",
          has_image: hasImage,
          image_url: imageUrl ?? "https://img.clerk.com/generated",
        },
      }) as never,
    })(signedRequest(), "production");
    expect(response.status).toBe(204);
    expect(syncFromClerk).toHaveBeenCalledWith({
      clerkId: "user_secret",
      clerkUpdatedAt: new Date(1),
      username: "roy",
      imageUrl,
    });
  });

  it("rejects an invalid signature", async () => {
    const request = signedRequest();
    request.headers.set("svix-signature", "v1,invalid");
    const response = await createClerkWebhookHandler({
      logger: createNoopLogger(),
      signingSecret,
      users: { syncFromClerk: vi.fn() },
    })(request, "production");

    expect(response.status).toBe(400);
  });

  it("forwards the exact body and signature headers", async () => {
    const bytes = new TextEncoder().encode('{"exact":true}');
    const body = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(body).set(bytes);
    const request = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    const targets = {
      list: vi.fn().mockResolvedValue({
        cacheStatus: null,
        keys: [
          {
            metadata: {
              kind: "local",
              url: "https://webhooks.clerk.com/in/c_AbCd123456/",
            },
            name: "target:local:RA",
          },
        ],
        list_complete: true,
      }),
    } as unknown as KVNamespace;

    await forwardToTargets({
      body,
      fetch: request,
      headers: new Headers({
        "content-type": "application/json",
        "svix-id": "msg_1",
        "svix-signature": "v1,test",
        "svix-timestamp": "123",
      }),
      provider: "clerk",
      targets,
      webhookPath: clerkWebhookPath,
    });

    expect(request).toHaveBeenCalledWith(
      "https://webhooks.clerk.com/in/c_AbCd123456/",
      expect.objectContaining({
        body,
        headers: {
          "content-type": "application/json",
          "svix-id": "msg_1",
          "svix-signature": "v1,test",
          "svix-timestamp": "123",
        },
      }),
    );
  });

  it("fails forwarding on invalid targets and non-2xx responses", async () => {
    expect(
      isValidTarget(
        "clerk",
        "target:preview:12",
        {
          kind: "preview",
          url: "https://attacker.example/api/v0/webhooks/clerk",
        },
        clerkWebhookPath,
      ),
    ).toBe(false);
    expect(
      isValidTarget(
        "clerk",
        "target:preview:12",
        {
          kind: "preview",
          url: "https://pr-12-pocket-trash-api-preview.example.workers.dev/api/v0/webhooks/clerk",
        },
        clerkWebhookPath,
      ),
    ).toBe(true);

    const targets = {
      list: vi.fn().mockResolvedValue({
        cacheStatus: null,
        keys: [
          {
            metadata: {
              kind: "preview",
              url: "https://pr-12-pocket-trash-api-preview.example.workers.dev/api/v0/webhooks/clerk",
            },
            name: "target:preview:12",
          },
        ],
        list_complete: true,
      }),
    } as unknown as KVNamespace;

    await expect(
      forwardToTargets({
        body: new ArrayBuffer(0),
        fetch: vi.fn().mockResolvedValue(new Response(null, { status: 500 })),
        headers: new Headers(),
        provider: "clerk",
        targets,
        webhookPath: clerkWebhookPath,
      }),
    ).rejects.toThrow("forwarding failed");
  });
});
