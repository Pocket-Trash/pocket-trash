import { describe, expect, it, vi } from "vitest";
import {
  createLoggerNotificationTransport,
  type LogEvent,
  matchesLoggerNotificationRules,
  toLoggerNotificationEvent,
} from "./index.js";

/** Canonical event used by notification tests. */
const event: LogEvent = {
  app: "api",
  attributes: { requestId: "request-1" },
  console: { mode: "verbose" },
  context: { route: "/catalog" },
  deploymentId: "api-production-1",
  deploymentTarget: "cloudflare-worker",
  environment: "production",
  error: {
    cause: { token: "secret" },
    message: "Catalog import failed",
    name: "ValidationError",
    stack: "private stack",
  },
  eventId: "event-1",
  level: "error",
  message: "catalog.import.failed",
  rawPayload: { authorization: "secret" },
  timestamp: "2026-10-17T23:00:00.000Z",
};

describe("logger notifications", () => {
  it("matches complete rules and supports message-only preview rules", () => {
    expect(matchesLoggerNotificationRules(event)).toBe(true);
    expect(
      matchesLoggerNotificationRules(
        { ...event, environment: "preview", level: "info" },
        [
          {
            applications: ["api"],
            environments: ["preview"],
            messages: ["catalog.import.failed"],
          },
        ],
      ),
    ).toBe(true);
    expect(
      matchesLoggerNotificationRules({ ...event, app: "discord-bot" }),
    ).toBe(false);
  });

  it("projects only fields allowed in the notification contract", () => {
    const notification = toLoggerNotificationEvent(event);

    expect(notification).toMatchObject({
      error: { message: "Catalog import failed", name: "ValidationError" },
      eventId: "event-1",
      version: 1,
    });
    expect(notification).not.toHaveProperty("console");
    expect(notification).not.toHaveProperty("rawPayload");
    expect(notification.error).not.toHaveProperty("stack");
    expect(notification.error).not.toHaveProperty("cause");
  });

  it("posts matching events with bearer authentication and ignores others", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, status: 202 });
    const transport = createLoggerNotificationTransport({
      endpoint: "https://discord.example/webhooks/logger",
      fetch,
      token: "app-token",
    });

    await transport.log(event);
    await transport.log({ ...event, environment: "preview" });

    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith(
      "https://discord.example/webhooks/logger",
      expect.objectContaining({
        headers: {
          Authorization: "Bearer app-token",
          "Content-Type": "application/json",
        },
      }),
    );
  });
});
