import type { Logger } from "@package/logger";
import { describe, expect, it, vi } from "vitest";
import { handleLogIngestionRequest } from "./log-ingestion";

/**
 * Creates a logger spy that runs operations and creates independent child spies.
 *
 * @returns A logger fixture with successful no-op flushing.
 */
function createTestLogger(): Logger {
  return {
    child: vi.fn(() => createTestLogger()),
    debug: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    flush: vi.fn().mockResolvedValue(undefined),
    forward: vi.fn(),
    info: vi.fn(),
    operation: vi.fn(async (_name, action) => action()),
    trace: vi.fn(),
    verbose: vi.fn(),
    warn: vi.fn(),
  };
}

describe("handleLogIngestionRequest", () => {
  it("accepts forwarded client log events", async () => {
    const logger = createTestLogger();
    const response = await handleLogIngestionRequest({
      clientLogKey: "client-key",
      logger,
      request: new Request("https://example.test/api/v0/logs", {
        body: JSON.stringify({
          events: [
            {
              app: "web",
              environment: "test",
              level: "info",
              message: "client.clicked",
              timestamp: "2026-01-01T00:00:00.000Z",
            },
          ],
        }),
        headers: {
          "user-agent": "vitest",
          "x-log-client-key": "client-key",
        },
        method: "POST",
      }),
    });

    await expect(response.json()).resolves.toEqual({ accepted: 1 });
    expect(response.status).toBe(200);
    expect(logger.forward).toHaveBeenCalledWith(
      expect.objectContaining({
        app: "web",
        message: "client.clicked",
      }),
      {
        attributes: expect.objectContaining({
          originalTimestamp: "2026-01-01T00:00:00.000Z",
          source: "log-proxy",
          userAgent: "vitest",
        }),
      },
    );
    expect(logger.flush).toHaveBeenCalledOnce();
  });

  it("rejects invalid JSON and client keys", async () => {
    const logger = createTestLogger();
    const wrongKeyResponse = await handleLogIngestionRequest({
      clientLogKey: "client-key",
      logger,
      request: new Request("https://example.test/api/v0/logs", {
        body: "{}",
        headers: {
          "x-log-client-key": "wrong",
        },
        method: "POST",
      }),
    });
    const invalidJsonResponse = await handleLogIngestionRequest({
      logger,
      request: new Request("https://example.test/api/v0/logs", {
        body: "{",
        method: "POST",
      }),
    });

    expect(wrongKeyResponse.status).toBe(401);
    expect(invalidJsonResponse.status).toBe(400);
    expect(logger.forward).not.toHaveBeenCalled();
  });
});
