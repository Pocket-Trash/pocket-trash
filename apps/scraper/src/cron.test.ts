import {
  createLogger,
  createNoopLogger,
  type LogEvent,
  type LogTransport,
  loggerMessages,
} from "@package/logger";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runRailwayCronJob, shouldRunRailwayCron } from "./cron.js";
import {
  runQueueProcessorJob,
  runSourceProducerJob,
  type ScraperJobContext,
  type ScraperJobEnv,
} from "./jobs.js";

vi.mock("./jobs.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./jobs.js")>();

  return {
    ...actual,
    runQueueProcessorJob: vi.fn(),
    runSourceProducerJob: vi.fn(),
  };
});

describe("Railway scraper cron", () => {
  afterEach(() => {
    vi.mocked(runQueueProcessorJob).mockReset();
    vi.mocked(runSourceProducerJob).mockReset();
  });

  it("disables preview cron unless explicitly enabled", () => {
    expect(
      shouldRunRailwayCron({
        APP_ENV: "preview",
        SCRAPER_CRON_ENABLED: undefined,
      } as ScraperJobEnv),
    ).toBe(false);
    expect(
      shouldRunRailwayCron({
        APP_ENV: "preview",
        SCRAPER_CRON_ENABLED: true,
      } as ScraperJobEnv),
    ).toBe(true);
    expect(
      shouldRunRailwayCron({
        APP_ENV: "production",
        SCRAPER_CRON_ENABLED: undefined,
      } as ScraperJobEnv),
    ).toBe(true);
  });

  it("honors explicit cron disablement outside preview", () => {
    expect(
      shouldRunRailwayCron({
        APP_ENV: "production",
        SCRAPER_CRON_ENABLED: false,
      } as ScraperJobEnv),
    ).toBe(false);
  });

  it("logs task failures without rejecting the cron run", async () => {
    vi.mocked(runSourceProducerJob).mockRejectedValueOnce(
      new Error("producer failed"),
    );
    vi.mocked(runQueueProcessorJob).mockResolvedValueOnce(undefined);

    await expect(
      runRailwayCronJob({
        context: createContext(),
        env: createEnv(),
        logger: createNoopLogger(),
        now: new Date("2026-07-16T12:00:00.000Z"),
      }),
    ).resolves.toBeUndefined();
    expect(runSourceProducerJob).toHaveBeenCalledTimes(5);
    expect(
      vi.mocked(runSourceProducerJob).mock.calls.map(([input]) => input.source),
    ).toEqual([
      "autmog",
      "grimsmo-fjell",
      "grimsmo-norseman",
      "grimsmo-rask",
      "grimsmo-saga",
    ]);
    expect(runQueueProcessorJob).toHaveBeenCalledOnce();
  });

  it("includes task failure details in the final cron failure log", async () => {
    const events: LogEvent[] = [];
    const logger = captureLogger(events);

    vi.mocked(runSourceProducerJob).mockRejectedValueOnce(
      new Error("producer failed"),
    );
    vi.mocked(runQueueProcessorJob).mockResolvedValueOnce(undefined);

    await runRailwayCronJob({
      context: createContext(),
      env: createEnv(),
      logger,
      now: new Date("2026-07-16T12:00:00.000Z"),
    });
    await logger.flush();

    expect(
      events.find(
        (event) => event.message === loggerMessages.scraper.cron.failed,
      )?.attributes,
    ).toMatchObject({
      failedTasks: 1,
      failures: [
        {
          error: {
            message: "producer failed",
            name: "Error",
          },
          source: "autmog",
          task: "scrape:autmog",
        },
      ],
    });
  });

  it("runs every source once per hourly invocation", async () => {
    vi.mocked(runSourceProducerJob).mockResolvedValue(undefined);
    vi.mocked(runQueueProcessorJob).mockResolvedValue(undefined);

    await runRailwayCronJob({
      context: createContext(),
      env: createEnv(),
      logger: createNoopLogger(),
      now: new Date("2026-07-16T12:00:00.000Z"),
    });

    expect(
      vi.mocked(runSourceProducerJob).mock.calls.map(([input]) => input.source),
    ).toEqual([
      "autmog",
      "grimsmo-fjell",
      "grimsmo-norseman",
      "grimsmo-rask",
      "grimsmo-saga",
    ]);
  });
});

function captureLogger(events: LogEvent[]) {
  const transport: LogTransport = {
    log(event) {
      events.push(event);
    },
  };

  return createLogger({
    app: "scraper",
    environment: "test",
    transports: [transport],
  });
}

function createContext(): ScraperJobContext {
  return {
    close: vi.fn(),
    db: {} as ScraperJobContext["db"],
    imageFolderPrefix: "images/dev",
    imageStorage: {} as ScraperJobContext["imageStorage"],
    queues: {
      close: vi.fn(),
      images: {} as ScraperJobContext["queues"]["images"],
      items: {} as ScraperJobContext["queues"]["items"],
    },
    redis: {
      get: vi.fn(async () => null),
      set: vi.fn(async () => "OK"),
    } as unknown as ScraperJobContext["redis"],
  };
}

function createEnv(): ScraperJobEnv {
  return {
    SCRAPER_AUTMOG_INTERVAL_MINUTES: 60,
    SCRAPER_GRIMSMO_FJELL_START_DELAY_SECONDS: 30 * 60,
    SCRAPER_GRIMSMO_INTERVAL_MINUTES: 60,
    SCRAPER_GRIMSMO_NORSEMAN_START_DELAY_SECONDS: 45 * 60,
    SCRAPER_GRIMSMO_RASK_START_DELAY_SECONDS: 15 * 60,
    SCRAPER_GRIMSMO_SAGA_START_DELAY_SECONDS: 0,
    SCRAPER_QUEUE_PROCESSOR_INTERVAL_MINUTES: 15,
  } as ScraperJobEnv;
}
