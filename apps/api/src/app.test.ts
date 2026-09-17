import {
  createLogger,
  createNoopLogger,
  type LogEvent,
  loggerValues,
} from "@package/logger";
import { describe, expect, it, vi } from "vitest";
import {
  apiDocsPath,
  createApp,
  healthPath,
  logsPath,
  openApiJsonPath,
  resourceUploadSessionsPath,
} from "./app.js";
import {
  ResourceUploadSessionError,
  type ResourceUploadSessionsService,
} from "./resource-upload-sessions.js";

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
    expect(document.paths).toHaveProperty(resourceUploadSessionsPath);

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

  it("authenticates session creation and streams each declared file", async () => {
    const service = createResourceUploadServiceMock();
    const app = createApp({
      resourceUploadRuntime: {
        authenticate: async () => "user_123",
        isAllowedOrigin: (origin) => origin === "https://preview.vercel.app",
        service,
      },
    });
    const sessionResponse = await app.request(resourceUploadSessionsPath, {
      body: JSON.stringify({
        categories: ["Tools"],
        description: "Description",
        files: [
          {
            contentType: "application/octet-stream",
            fileName: "tool.stl",
            size: 3,
          },
        ],
        name: "Tool",
        operation: "create",
      }),
      headers: {
        "content-type": "application/json",
        origin: "https://preview.vercel.app",
      },
      method: "POST",
    });

    expect(sessionResponse.status).toBe(201);
    expect(sessionResponse.headers.get("access-control-allow-origin")).toBe(
      "https://preview.vercel.app",
    );
    expect(service.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Tool", operation: "create" }),
      "user_123",
    );

    const uploadRequest = new Request(
      `https://api.example.test${resourceUploadSessionsPath}/00000000-0000-4000-8000-000000000001/files/00000000-0000-4000-8000-000000000002`,
      {
        body: new Uint8Array([1, 2, 3]),
        headers: {
          "content-length": "3",
          "content-type": "application/octet-stream",
        },
        method: "PUT",
      },
    );
    const uploadResponse = await app.request(uploadRequest);

    expect(uploadResponse.status).toBe(204);
    expect(service.upload).toHaveBeenCalledWith(
      "00000000-0000-4000-8000-000000000001",
      "00000000-0000-4000-8000-000000000002",
      "user_123",
      uploadRequest,
    );
  });

  it("rejects unauthenticated resource upload sessions", async () => {
    const app = createApp({
      resourceUploadRuntime: {
        authenticate: async () => null,
        isAllowedOrigin: () => true,
        service: createResourceUploadServiceMock(),
      },
    });

    const response = await app.request(resourceUploadSessionsPath, {
      body: "{}",
      method: "POST",
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "unauthorized" });
  });

  it("uses the authenticated owner and returns stable completion errors", async () => {
    const service = createResourceUploadServiceMock();
    service.complete.mockRejectedValue(
      new ResourceUploadSessionError("uploads_incomplete", 409),
    );
    const app = createApp({
      resourceUploadRuntime: {
        authenticate: async () => "user_123",
        isAllowedOrigin: () => true,
        service,
      },
    });

    const response = await app.request(
      `${resourceUploadSessionsPath}/session-id/complete`,
      { method: "POST" },
    );

    expect(service.complete).toHaveBeenCalledWith("session-id", "user_123");
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "uploads_incomplete",
    });
  });
});

function createResourceUploadServiceMock() {
  return {
    cleanupExpired: vi.fn(async () => 0),
    complete: vi.fn(async () => ({ resourceId: 1000, version: 1 })),
    create: vi.fn(async () => ({
      expiresAt: "2026-09-17T01:00:00.000Z",
      id: "00000000-0000-4000-8000-000000000001",
      uploads: [
        {
          contentType: "application/octet-stream",
          fileName: "tool.stl",
          id: "00000000-0000-4000-8000-000000000002",
          kind: "resource" as const,
          size: 3,
        },
      ],
    })),
    upload: vi.fn(async () => {}),
  } satisfies ResourceUploadSessionsService;
}
