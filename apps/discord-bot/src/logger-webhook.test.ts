import { describe, expect, it } from "vitest";
import { createLoggerWebhookNormalizer } from "./logger-webhook.js";
import { deliveryJobSchema } from "./queue.js";

/** App-bound credentials used by webhook tests. */
const tokens = {
  api: "a".repeat(32),
  scraper: "s".repeat(32),
  web: "w".repeat(32),
};

/** Valid production logger event used by webhook tests. */
const event = {
  app: "api",
  environment: "production",
  error: { message: "Product material is missing", name: "ValidationError" },
  eventId: "event-1",
  level: "error",
  message: "catalog.import.failed",
  timestamp: "2026-10-17T23:00:00.000Z",
  version: 1,
};

describe("logger webhook", () => {
  const normalize = createLoggerWebhookNormalizer({
    channelId: "1560141390510428210",
    tokens,
  });

  it("bounds valid long event text to the delivery queue contract", async () => {
    const delivery = await normalize(
      request(
        {
          ...event,
          message: "m".repeat(500),
          error: { name: "n".repeat(200), message: "e".repeat(1_000) },
        },
        tokens.api,
      ),
    );
    expect(deliveryJobSchema.safeParse(delivery?.payload).success).toBe(true);
    expect(delivery?.payload.notification.title).toHaveLength(300);
  });

  it("binds bearer authentication to the event app", async () => {
    const delivery = await normalize(request(event, tokens.api));

    expect(delivery).toMatchObject({
      id: "event-1",
      payload: {
        deliveryId: "event-1",
        destinationChannelId: "1560141390510428210",
        kind: "logger",
        notification: {
          diagnostics: ["ValidationError: Product material is missing"],
          title: "Product material is missing",
        },
      },
    });
    await expect(normalize(request(event, tokens.web))).rejects.toMatchObject({
      status: 400,
    });
  });

  it("rejects invalid authentication and oversized requests", async () => {
    await expect(normalize(request(event, "wrong"))).rejects.toMatchObject({
      status: 401,
    });
    await expect(
      normalize(
        new Request("https://bot.example/webhooks/logger", {
          body: "{}",
          headers: {
            Authorization: `Bearer ${tokens.api}`,
            "Content-Length": String(64 * 1024 + 1),
          },
          method: "POST",
        }),
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("ignores authenticated events outside the shared rules", async () => {
    await expect(
      normalize(request({ ...event, environment: "preview" }, tokens.api)),
    ).resolves.toBeUndefined();
  });
});

/**
 * Builds an authenticated logger webhook request.
 *
 * @param body - JSON-serializable request payload.
 * @param token - Bearer credential to send.
 * @returns The webhook request.
 */
function request(body: unknown, token: string) {
  return new Request("https://bot.example/webhooks/logger", {
    body: JSON.stringify(body),
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });
}
