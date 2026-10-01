import {
  createLogger,
  type LogEvent,
  type LogTransport,
  loggerMessages,
} from "@package/logger";
import { describe, expect, it } from "vitest";
import { hashLogIdentifier } from "../logging.js";
import { createImagesService } from "./index.js";

/**
 * Creates a test logger that captures emitted events.
 *
 * @param events - Mutable event collection populated by the transport.
 * @returns Test logger backed by the capture transport.
 */
function captureLogger(events: LogEvent[]) {
  const transport: LogTransport = {
    /**
     * Captures one emitted log event.
     *
     * @param event - Structured event emitted by the logger.
     */
    log(event) {
      events.push(event);
    },
  };

  return createLogger({
    app: "api",
    environment: "test",
    transports: [transport],
  });
}

describe("image service logging", () => {
  it("logs remote uploads without exposing the source URL", async () => {
    const events: LogEvent[] = [];
    const logger = captureLogger(events);
    const service = createImagesService({ dryRun: true }, logger);
    const sourceUrl = "https://cdn.example.test/private-image.jpg";

    await expect(
      service.uploadRemoteImage({
        fileName: "private-image.webp",
        folder: "/items/test",
        sourceUrl,
        tags: ["test"],
        useUniqueFileName: false,
      }),
    ).resolves.toBeNull();
    await logger.flush();

    expect(events).toHaveLength(1);
    expect(events[0]?.message).toBe(
      `${loggerMessages.images.upload}.succeeded`,
    );
    expect(events[0]?.attributes).toMatchObject({
      fileNameHash: hashLogIdentifier("private-image.webp"),
      folderHash: hashLogIdentifier("/items/test"),
      hasFolder: true,
      operation: loggerMessages.images.upload,
      outcome: "success",
      sourceUrlHash: hashLogIdentifier(sourceUrl),
      tagCount: 1,
      useUniqueFileName: false,
    });
    expect(JSON.stringify(events)).not.toContain(sourceUrl);
    expect(JSON.stringify(events)).not.toContain("private-image.webp");
    expect(JSON.stringify(events)).not.toContain("/items/test");
  });
});
