import {
  createLogger,
  createNoopLogger,
  type LogEvent,
  type LogTransport,
  loggerMessages,
} from "@package/logger";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  runRailwayCronJob,
  scraperSchedules,
  shouldRunRailwayCron,
} from "./cron.js";
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
    expect(scraperSchedules).toEqual({
      autmog: "0 * * * *",
      "grimsmo-fjell": "0 * * * *",
      "grimsmo-norseman": "0 * * * *",
      "grimsmo-rask": "0 * * * *",
      "grimsmo-saga": "0 * * * *",
    });
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
  it("establishes an hourly baseline off the dispatcher tick and still processes the queue", async () => {
    const context = createContext();
    await runRailwayCronJob({
      context,
      env: createEnv(),
      logger: createNoopLogger(),
      now: new Date("2026-07-16T12:55:00.000Z"),
    });
    expect(runSourceProducerJob).not.toHaveBeenCalled();
    expect(context.redis.set).toHaveBeenCalledWith(
      "scraper:cron:last-attempted-slot:autmog",
      "2026-07-16T12:00:00.000Z",
    );
    expect(runQueueProcessorJob).toHaveBeenCalledOnce();
  });

  it.each([
    "* * * * * *",
    "0 * * *",
    "@hourly",
    "0 0 L * *",
    "0 0 * * MON#2",
    "0 99 * * *",
  ])("rejects %s before any task side effects", async (schedule) => {
    const context = createContext();
    const original = scraperSchedules["grimsmo-saga"];
    scraperSchedules["grimsmo-saga"] = schedule;
    try {
      await expect(
        runRailwayCronJob({
          context,
          env: createEnv(),
          logger: createNoopLogger(),
          now: new Date("2026-07-16T12:00:00.000Z"),
        }),
      ).rejects.toThrow();
      expect(context.redis.get).not.toHaveBeenCalled();
      expect(context.redis.set).not.toHaveBeenCalled();
      expect(runSourceProducerJob).not.toHaveBeenCalled();
      expect(runQueueProcessorJob).not.toHaveBeenCalled();
    } finally {
      scraperSchedules["grimsmo-saga"] = original;
    }
  });

  it.each([
    null,
    "not-a-slot",
    "2026-07-17T12:00:00.000Z",
  ])("initializes %s on a delayed due tick", async (stored) => {
    const context = createContext();
    vi.mocked(context.redis.get).mockResolvedValue(stored);
    const now = new Date("2026-07-16T12:02:37.000Z");
    vi.mocked(runSourceProducerJob).mockImplementation(async () => {
      now.setUTCHours(15);
    });
    await runRailwayCronJob({
      context,
      env: createEnv(),
      logger: createNoopLogger(),
      now,
    });
    expect(runSourceProducerJob).toHaveBeenCalledTimes(5);
    for (const args of vi.mocked(context.redis.set).mock.calls) {
      expect(args).toHaveLength(2);
      expect(args[1]).toBe("2026-07-16T12:00:00.000Z");
    }
  });

  it.each([
    "not-a-slot",
    "2026-07-17T12:00:00.000Z",
  ])("repairs %s off the tick without running producers", async (stored) => {
    const context = createContext();
    vi.mocked(context.redis.get).mockResolvedValue(stored);
    const events: LogEvent[] = [];
    const logger = captureLogger(events);
    await runRailwayCronJob({
      context,
      env: createEnv(),
      logger,
      now: new Date("2026-07-16T12:55:00.000Z"),
    });
    await logger.flush();
    expect(runSourceProducerJob).not.toHaveBeenCalled();
    expect(context.redis.set).toHaveBeenCalledTimes(5);
    expect(
      events.filter(
        (event) => event.message === loggerMessages.scraper.cron.taskStarted,
      ),
    ).toHaveLength(1);
    expect(
      events.find(
        (event) => event.message === loggerMessages.scraper.cron.completed,
      )?.attributes,
    ).toMatchObject({ skippedSources: 5 });
  });

  it.each([
    "2026-07-16T11:00:00.000Z",
    "2026-07-15T08:00:00.000Z",
  ])("collapses missed slots after %s into one latest attempt", async (stored) => {
    const context = createContext();
    vi.mocked(context.redis.get).mockResolvedValue(stored);
    await runRailwayCronJob({
      context,
      env: createEnv(),
      logger: createNoopLogger(),
      now: new Date("2026-07-16T12:55:00.000Z"),
    });
    expect(runSourceProducerJob).toHaveBeenCalledTimes(5);
    expect(context.redis.set).toHaveBeenCalledWith(
      "scraper:cron:last-attempted-slot:autmog",
      "2026-07-16T12:00:00.000Z",
    );
  });

  it("remembers failed attempts before execution and waits for the next hourly slot", async () => {
    const context = createContext();
    const state = new Map<string, string>();
    vi.mocked(context.redis.get).mockImplementation(
      async (key) => state.get(String(key)) ?? null,
    );
    vi.mocked(context.redis.set).mockImplementation(async (key, value) => {
      state.set(String(key), String(value));
      return "OK";
    });
    vi.mocked(runSourceProducerJob).mockImplementation(async ({ source }) => {
      expect(state.get(`scraper:cron:last-attempted-slot:${source}`)).toBe(
        "2026-07-16T12:00:00.000Z",
      );
      if (source === "autmog") throw new Error("producer failure");
    });
    for (const time of ["12:00", "12:05"]) {
      await expect(
        runRailwayCronJob({
          context,
          env: createEnv(),
          logger: createNoopLogger(),
          now: new Date(`2026-07-16T${time}:00.000Z`),
        }),
      ).resolves.toBeUndefined();
    }
    expect(runSourceProducerJob).toHaveBeenCalledTimes(5);
    expect(runQueueProcessorJob).toHaveBeenCalledTimes(2);
    vi.mocked(runSourceProducerJob).mockResolvedValue(undefined);
    await runRailwayCronJob({
      context,
      env: createEnv(),
      logger: createNoopLogger(),
      now: new Date("2026-07-16T13:00:00.000Z"),
    });
    expect(runSourceProducerJob).toHaveBeenCalledTimes(10);
  });

  it.each([
    "get",
    "set",
  ] as const)("continues later sources and queue after a Redis %s failure", async (operation) => {
    const context = createContext();
    vi.mocked(context.redis[operation]).mockRejectedValueOnce(
      new Error("Redis unavailable"),
    );
    await expect(
      runRailwayCronJob({
        context,
        env: createEnv(),
        logger: createNoopLogger(),
        now: new Date("2026-07-16T12:00:00.000Z"),
      }),
    ).resolves.toBeUndefined();
    expect(
      vi.mocked(runSourceProducerJob).mock.calls.map(([input]) => input.source),
    ).toEqual([
      "grimsmo-fjell",
      "grimsmo-norseman",
      "grimsmo-rask",
      "grimsmo-saga",
    ]);
    expect(runQueueProcessorJob).toHaveBeenCalledOnce();
  });
});

/**
 * Creates a logger transport that appends emitted events to a test array.
 *
 * @param events - Mutable event array used by assertions.
 * @returns A configured scraper test logger.
 */
function captureLogger(events: LogEvent[]) {
  const transport: LogTransport = {
    /**
     * Captures one emitted log event.
     *
     * @param event - Structured event to append.
     */
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

/**
 * Creates minimal scraper resources for cron orchestration tests.
 *
 * @returns A test scraper job context.
 */
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

/**
 * Creates the scheduling values required by cron tests.
 *
 * @returns A partial validated job environment.
 */
function createEnv(): ScraperJobEnv {
  return {} as ScraperJobEnv;
}
