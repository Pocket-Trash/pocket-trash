import { describe, expect, it, vi } from "vitest";
import {
  createAxiomTransport,
  createConsoleTransport,
  createLogger,
  createProxyTransport,
  type LogEvent,
  type LogTransport,
  loggerMessages,
  loggerValues,
  normalizeConsoleTransportMode,
  parseClientLogEvents,
  redactValue,
} from "./index.js";

function captureTransport(events: LogEvent[] = []): LogTransport {
  return {
    log(event) {
      events.push(event);
    },
  };
}

describe("logger", () => {
  it("exports reusable logger constants", () => {
    expect(loggerMessages).toMatchObject({
      api: {
        healthChecked: "api.health.checked",
        serverListening: "api.server.listening",
        workerUnhandledException: "api.worker.unhandledException",
      },
      ci: {
        database: {
          preview: {
            branchCleanupSkipped: "ci.database.preview.branchCleanup.skipped",
            branchCreated: "ci.database.preview.branch.created",
            branchDeleted: "ci.database.preview.branch.deleted",
            branchExpirationSet: "ci.database.preview.branch.expiration.set",
            branchLimitReached: "ci.database.preview.branchLimit.reached",
            changeDetectionCompleted:
              "ci.database.preview.changeDetection.completed",
            migrationsApplied: "ci.database.preview.migrations.applied",
            migrationsFailed: "ci.database.preview.migrations.failed",
            noPrBranchNeeded: "ci.database.preview.noPrBranch.needed",
            prBranchReused: "ci.database.preview.prBranch.reused",
            databaseSelected: "ci.database.preview.database.selected",
            reset: "ci.database.preview.reset",
            sharedDatabaseSelected:
              "ci.database.preview.sharedDatabase.selected",
          },
          production: {
            databaseSelected: "ci.database.production.database.selected",
            migrationsApplied: "ci.database.production.migrations.applied",
            migrationsFailed: "ci.database.production.migrations.failed",
          },
        },
        github: {
          dbChangeLabelSynced: "ci.github.dbChangeLabel.synced",
        },
        vercel: {
          preview: {
            databaseOverrideMissing:
              "ci.vercel.preview.databaseOverride.missing",
            databaseOverrideRemoved:
              "ci.vercel.preview.databaseOverride.removed",
            databaseOverrideSet: "ci.vercel.preview.databaseOverride.set",
            latestDeploymentResolved:
              "ci.vercel.preview.latestDeployment.resolved",
            latestDeploymentUnavailable:
              "ci.vercel.preview.latestDeployment.unavailable",
          },
        },
      },
      database: {
        userSettings: {
          getByClerkId: "database.userSettings.getByClerkId",
          upsertForClerkId: "database.userSettings.upsertForClerkId",
        },
        users: {
          ensure: "database.users.ensure",
        },
      },
      scraper: {
        cron: {
          completed: "scraper.cron.completed",
          failed: "scraper.cron.failed",
          runSkipped: "scraper.cron.run.skipped",
          started: "scraper.cron.started",
          taskCompleted: "scraper.cron.task.completed",
          taskFailed: "scraper.cron.task.failed",
          taskSkipped: "scraper.cron.task.skipped",
          taskStarted: "scraper.cron.task.started",
        },
        processor: {
          errorSummary: "scraper.processor.errors.summary",
        },
        queue: {
          deadLetterCompleted: "scraper.queue.deadLetter.completed",
          deadLetterFailed: "scraper.queue.deadLetter.failed",
          deadLetterStarted: "scraper.queue.deadLetter.started",
        },
      },
      web: {
        accountLoaded: "web.account.loaded",
        fxRatesFetchFailed: "web.fxRates.fetch.failed",
        localeSyncFailed: "web.locale.sync.failed",
        userSettingsFetchFailed: "web.userSettings.fetch.failed",
        userSettingsSaveFailed: "web.userSettings.save.failed",
      },
    });
    expect(loggerValues).toMatchObject({
      apps: {
        api: "api",
        ci: "ci",
        web: "web",
      },
      logProxy: {
        clientKeyHeader: "x-log-client-key",
        maxBatchSize: 25,
        source: "log-proxy",
      },
    });
  });

  it("filters events below the configured level", async () => {
    const events: LogEvent[] = [];
    const logger = createLogger({
      app: "test",
      environment: "test",
      level: "warn",
      transports: [captureTransport(events)],
    });

    logger.info("ignored");
    logger.warn("kept");
    await logger.flush();

    expect(events.map((event) => event.message)).toEqual(["kept"]);
  });

  it("merges child context", async () => {
    const events: LogEvent[] = [];
    const logger = createLogger({
      app: "api",
      context: { requestId: "req-1" },
      deploymentId: "pr-27",
      deploymentTarget: "cloudflare-worker",
      environment: "test",
      transports: [captureTransport(events)],
    }).child({ userId: "user-1" });

    logger.info("child.context");
    await logger.flush();

    expect(events[0]?.context).toEqual({
      requestId: "req-1",
      userId: "user-1",
    });
    expect(events[0]).toMatchObject({
      deploymentId: "pr-27",
      deploymentTarget: "cloudflare-worker",
    });
  });

  it("forwards client events without replacing top-level identity", async () => {
    const events: LogEvent[] = [];
    const logger = createLogger({
      app: "api",
      context: { proxyRequestId: "req-1" },
      environment: "preview",
      redactKeys: ["sessionId"],
      transports: [captureTransport(events)],
    });

    logger.forward(
      {
        app: "web",
        attributes: {
          route: "/account",
          sessionId: "secret",
          source: "client",
        },
        context: {
          view: "account",
        },
        deploymentId: "pr-27",
        deploymentTarget: "web-client",
        environment: "preview",
        error: {
          message: "Client failed",
          name: "TypeError",
        },
        level: "error",
        message: "client.failed",
        rawPayload: {
          token: "raw-secret",
          visible: true,
        },
        timestamp: "2026-01-01T00:00:00.000Z",
      },
      {
        attributes: {
          receivedAt: "2026-01-01T00:00:01.000Z",
          source: loggerValues.logProxy.source,
        },
      },
    );
    await logger.flush();

    expect(events[0]).toMatchObject({
      app: "web",
      attributes: {
        receivedAt: "2026-01-01T00:00:01.000Z",
        route: "/account",
        sessionId: "[REDACTED]",
        source: loggerValues.logProxy.source,
      },
      context: {
        proxyRequestId: "req-1",
        view: "account",
      },
      deploymentId: "pr-27",
      deploymentTarget: "web-client",
      environment: "preview",
      error: {
        message: "Client failed",
        name: "TypeError",
      },
      level: "error",
      message: "client.failed",
      rawPayload: {
        token: "[REDACTED]",
        visible: true,
      },
      timestamp: "2026-01-01T00:00:00.000Z",
    });
  });

  it("parses client log batches", () => {
    const result = parseClientLogEvents({
      events: [
        {
          app: "web",
          environment: "test",
          level: "info",
          message: "client.clicked",
        },
      ],
    });

    expect(result).toMatchObject({
      ok: true,
      value: [
        {
          app: "web",
          environment: "test",
          level: "info",
          message: "client.clicked",
        },
      ],
    });
    expect(result.ok && result.value[0]?.timestamp).toEqual(expect.any(String));
  });

  it("rejects invalid client log events", () => {
    expect(parseClientLogEvents({ events: [] })).toEqual({
      error: "Expected at least one log event.",
      ok: false,
    });
    expect(parseClientLogEvents({ level: "loud" })).toEqual({
      error: "Log event app must be a string.",
      ok: false,
    });
  });

  it("redacts sensitive keys", () => {
    expect(
      redactValue({
        nested: {
          api_key: "abc",
          password: "secret",
          visible: "ok",
        },
      }),
    ).toEqual({
      nested: {
        api_key: "[REDACTED]",
        password: "[REDACTED]",
        visible: "ok",
      },
    });
  });

  it("serializes errors", async () => {
    const events: LogEvent[] = [];
    const logger = createLogger({
      app: "api",
      environment: "test",
      transports: [captureTransport(events)],
    });

    logger.error("failed", { error: new TypeError("Nope") });
    await logger.flush();

    expect(events[0]?.error).toMatchObject({
      message: "Nope",
      name: "TypeError",
    });
  });

  it("logs operation timing for success and failure", async () => {
    const events: LogEvent[] = [];
    const logger = createLogger({
      app: "api",
      environment: "test",
      transports: [captureTransport(events)],
    });

    await expect(logger.operation("db.query", () => "ok")).resolves.toBe("ok");
    await expect(
      logger.operation("api.call", () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    await logger.flush();

    expect(events.map((event) => event.message)).toEqual([
      "db.query.succeeded",
      "api.call.failed",
    ]);
    expect(events[0]?.attributes).toMatchObject({
      operation: "db.query",
      outcome: "success",
    });
    expect(events[1]?.attributes).toMatchObject({
      operation: "api.call",
      outcome: "failure",
    });
  });
});

describe("transports", () => {
  it("writes compact console events by default", async () => {
    const writer = {
      error: vi.fn(),
      log: vi.fn(),
      warn: vi.fn(),
    };
    const transport = createConsoleTransport({ writer });

    await transport.log({
      app: "api",
      attributes: {
        durationMs: 12,
        operation: "db.query",
        rawDetail: "omitted",
        source: "log-proxy",
      },
      context: {
        requestId: "req-1",
      },
      deploymentId: "development",
      deploymentTarget: "local",
      environment: "development",
      error: {
        message: "Boom",
        name: "TypeError",
        stack: "stack should be omitted",
      },
      level: "error",
      message: "api.failed",
      rawPayload: {
        token: "redacted",
      },
      timestamp: "2026-01-01T00:00:00.000Z",
    });

    expect(writer.error).toHaveBeenCalledTimes(1);
    const output = JSON.parse(String(writer.error.mock.calls[0]?.[0]));

    expect(output).toEqual({
      app: "api",
      deploymentId: "development",
      deploymentTarget: "local",
      durationMs: 12,
      environment: "development",
      error: {
        message: "Boom",
        name: "TypeError",
      },
      level: "error",
      message: "api.failed",
      operation: "db.query",
      requestId: "req-1",
      source: "log-proxy",
      timestamp: "2026-01-01T00:00:00.000Z",
    });
    expect(JSON.stringify(output)).not.toContain("rawDetail");
    expect(JSON.stringify(output)).not.toContain("rawPayload");
    expect(JSON.stringify(output)).not.toContain("stack should be omitted");
  });

  it("writes verbose console events when configured", async () => {
    const writer = {
      error: vi.fn(),
      log: vi.fn(),
      warn: vi.fn(),
    };
    const transport = createConsoleTransport({
      mode: "verbose",
      writer,
    });

    await transport.log({
      app: "api",
      attributes: {
        route: "/health",
      },
      environment: "development",
      level: "warn",
      message: "api.warned",
      rawPayload: {
        visible: true,
      },
      timestamp: "2026-01-01T00:00:00.000Z",
    });

    expect(writer.warn).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(writer.warn.mock.calls[0]?.[0]))).toEqual({
      app: "api",
      attributes: {
        route: "/health",
      },
      environment: "development",
      level: "warn",
      levelWeight: 50,
      message: "api.warned",
      rawPayload: {
        visible: true,
      },
      timestamp: "2026-01-01T00:00:00.000Z",
    });
  });

  it("allows individual events to override compact console mode", async () => {
    const writer = {
      error: vi.fn(),
      log: vi.fn(),
      warn: vi.fn(),
    };
    const transport = createConsoleTransport({ writer });

    await transport.log({
      app: "web",
      attributes: {
        previewUrl: "https://pr-27-pocket-trash.example.test",
        pullRequestId: "27",
      },
      console: {
        mode: "verbose",
      },
      environment: "preview",
      level: "info",
      message: "web.preview.derived",
      timestamp: "2026-01-01T00:00:00.000Z",
    });

    expect(writer.log).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(writer.log.mock.calls[0]?.[0]))).toEqual({
      app: "web",
      attributes: {
        previewUrl: "https://pr-27-pocket-trash.example.test",
        pullRequestId: "27",
      },
      environment: "preview",
      level: "info",
      levelWeight: 40,
      message: "web.preview.derived",
      timestamp: "2026-01-01T00:00:00.000Z",
    });
  });

  it("normalizes console transport mode from LOGGER values", () => {
    expect(normalizeConsoleTransportMode("verbose")).toBe("verbose");
    expect(normalizeConsoleTransportMode("compact")).toBe("compact");
    expect(normalizeConsoleTransportMode(undefined)).toBe("compact");
  });

  it("sends Axiom batches with bearer auth", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });
    const transport = createAxiomTransport({
      dataset: "logs",
      fetch: fetcher,
      token: "token-1",
    });

    await transport.log({
      app: "api",
      console: {
        mode: "verbose",
      },
      environment: "test",
      level: "info",
      message: "hello",
      timestamp: "2026-01-01T00:00:00.000Z",
    });

    expect(fetcher).toHaveBeenCalledWith(
      "https://api.axiom.co/v1/datasets/logs/ingest",
      {
        body: JSON.stringify([
          {
            app: "api",
            environment: "test",
            level: "info",
            message: "hello",
            timestamp: "2026-01-01T00:00:00.000Z",
          },
        ]),
        headers: {
          Authorization: "Bearer token-1",
          "Content-Type": "application/json",
        },
        method: "POST",
      },
    );
  });

  it("sends proxy logs without provider credentials", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });
    const transport = createProxyTransport({
      clientKey: "public-key",
      fetch: fetcher,
      url: "https://example.test/logs",
    });

    await transport.log({
      app: "web",
      console: {
        mode: "verbose",
      },
      environment: "test",
      level: "info",
      message: "clicked",
      timestamp: "2026-01-01T00:00:00.000Z",
    });

    expect(fetcher).toHaveBeenCalledWith("https://example.test/logs", {
      body: JSON.stringify({
        events: [
          {
            app: "web",
            environment: "test",
            level: "info",
            message: "clicked",
            timestamp: "2026-01-01T00:00:00.000Z",
          },
        ],
      }),
      headers: {
        "Content-Type": "application/json",
        [loggerValues.logProxy.clientKeyHeader]: "public-key",
      },
      method: "POST",
    });
    expect(JSON.stringify(fetcher.mock.calls)).not.toContain("Bearer");
  });
});
