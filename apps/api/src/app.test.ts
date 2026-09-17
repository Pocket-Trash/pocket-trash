import {
  createLogger,
  createNoopLogger,
  type LogEvent,
  loggerValues,
} from "@package/logger";
import { describe, expect, it } from "vitest";
import {
  apiDocsPath,
  createApp,
  healthPath,
  logsPath,
  openApiJsonPath,
} from "./app.js";

describe("api", () => {
  it("serves only the restored API shell", async () => {
    const app = createApp();
    const healthResponse = await app.request(healthPath);

    await expect(healthResponse.json()).resolves.toEqual({
      ok: true,
      service: "api",
    });
    await expect(app.request(apiDocsPath)).resolves.toMatchObject({
      status: 200,
    });

    const openApiResponse = await app.request(openApiJsonPath);
    const document = (await openApiResponse.json()) as {
      paths: Record<string, unknown>;
    };
    expect(document.paths).toHaveProperty(healthPath);
    expect(document.paths).toHaveProperty(logsPath);

    for (const path of [
      "/",
      "/health",
      "/api/v0/feature-flags/beta",
      "/api/v0/mobile-version",
      "/api/v0/user/settings",
    ]) {
      await expect(app.request(path)).resolves.toMatchObject({ status: 404 });
    }
  });

  it("validates, authenticates, and forwards client logs", async () => {
    const events: LogEvent[] = [];
    const app = createApp({
      runtimeConfig: {
        clientLogKey: "expected",
        logger: createLogger({
          app: "api",
          environment: "test",
          transports: [
            {
              log(event) {
                events.push(event);
              },
            },
          ],
        }),
      },
    });

    await expect(
      app.request(logsPath, {
        body: JSON.stringify({
          app: "web",
          environment: "test",
          level: "info",
          message: "client.clicked",
        }),
        method: "POST",
      }),
    ).resolves.toMatchObject({ status: 401 });

    const response = await app.request(logsPath, {
      body: JSON.stringify({
        app: "web",
        attributes: { token: "secret" },
        environment: "test",
        level: "info",
        message: "client.clicked",
      }),
      headers: { [loggerValues.logProxy.clientKeyHeader]: "expected" },
      method: "POST",
    });

    await expect(response.json()).resolves.toEqual({ accepted: 1 });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      attributes: {
        source: loggerValues.logProxy.source,
        token: "[REDACTED]",
      },
      message: "client.clicked",
    });
  });

  it("rejects malformed client logs", async () => {
    const app = createApp({
      runtimeConfig: { logger: createNoopLogger() },
    });

    await expect(
      app.request(logsPath, { body: "not-json", method: "POST" }),
    ).resolves.toMatchObject({ status: 400 });
    await expect(
      app.request(logsPath, {
        body: JSON.stringify({ level: "info" }),
        method: "POST",
      }),
    ).resolves.toMatchObject({ status: 400 });
  });
});
