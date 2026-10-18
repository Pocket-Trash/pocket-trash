import { loggerMessages } from "@package/logger";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createScraperLogger } from "./logger.js";

describe("createScraperLogger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("uses APP_ENV for policy while keeping AXIOM_DATASET as the destination", async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });
    vi.stubGlobal("fetch", fetch);
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    const logger = createScraperLogger({
      appEnv: "production",
      axiomDataset: "production",
      axiomToken: "token",
    });

    logger.info(loggerMessages.scraper.run.started);
    await logger.flush();

    expect(fetch).toHaveBeenCalledWith(
      "https://api.axiom.co/v1/datasets/production/ingest",
      expect.objectContaining({
        body: expect.any(String),
      }),
    );
    const call = fetch.mock.calls[0];
    expect(call).toBeDefined();
    if (!call) {
      throw new Error("Expected Axiom fetch to be called.");
    }
    const [, init] = call;
    const body = JSON.parse(String(init?.body));

    expect(body).toEqual([
      expect.objectContaining({
        app: "scraper",
        environment: "production",
        message: loggerMessages.scraper.run.started,
      }),
    ]);
  });

  it("preserves the preview policy label even when the dataset is shared", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetch);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const logger = createScraperLogger({
      appEnv: "preview",
      axiomDataset: "development",
      axiomToken: "token",
    });

    logger.error("scraper.preview.error");
    await logger.flush();

    const body = JSON.parse(String(fetch.mock.calls[0]?.[1]?.body));
    expect(body[0].environment).toBe("preview");
  });
});
