import {
  createLogger,
  createNoopLogger,
  type LogEvent,
  loggerValues,
} from "@package/logger";
import { describe, expect, it, vi } from "vitest";
import {
  apiDocsPath,
  clerkWebhookPath,
  createApp,
  healthPath,
  logsPath,
  openApiJsonPath,
  uploadSessionsPath,
} from "./app.js";
import {
  UploadSessionError,
  type UploadSessionsService,
} from "./upload-sessions.js";

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
    expect(document.paths).toHaveProperty(uploadSessionsPath);

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

  it("accepts only the configured local webhook initials", async () => {
    const handle = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    const app = createApp({
      clerkWebhookRuntime: { expectedInitials: "RA", handle },
    });

    expect(
      (await app.request(`${clerkWebhookPath}/ra`, { method: "POST" })).status,
    ).toBe(204);
    expect(
      (await app.request(`${clerkWebhookPath}/rb`, { method: "POST" })).status,
    ).toBe(404);
    expect(handle).toHaveBeenCalledOnce();
  });

  it("authenticates session creation and streams each declared file", async () => {
    const service = createUploadServiceMock();
    const app = createApp({
      uploadRuntime: {
        authenticate: async () => ({ clerkId: "user_123", isAdmin: false }),
        isAllowedOrigin: (origin) => origin === "https://preview.vercel.app",
        service,
      },
    });
    const sessionResponse = await app.request(uploadSessionsPath, {
      body: JSON.stringify({
        target: { type: "resource" },
        payload: {
          categories: ["Tools"],
          description: "Description",
          name: "Tool",
          operation: "create",
          isPrivate: true,
        },
        files: [
          {
            kind: "file",
            contentType: "application/octet-stream",
            fileName: "tool.stl",
            size: 3,
            sha256: "a".repeat(64),
          },
          {
            kind: "image",
            contentType: "image/webp",
            fileName: "tool.webp",
            size: 3,
            sha256: "b".repeat(64),
          },
        ],
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
      expect.objectContaining({
        payload: expect.objectContaining({
          isPrivate: true,
          name: "Tool",
          operation: "create",
        }),
      }),
      { clerkId: "user_123", isAdmin: false },
    );

    const uploadRequest = new Request(
      `https://api.example.test${uploadSessionsPath}/00000000-0000-4000-8000-000000000001/files/00000000-0000-4000-8000-000000000002`,
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
      { clerkId: "user_123", isAdmin: false },
      uploadRequest,
    );
  });

  it("rejects unauthenticated resource upload sessions", async () => {
    const app = createApp({
      uploadRuntime: {
        authenticate: async () => null,
        isAllowedOrigin: () => true,
        service: createUploadServiceMock(),
      },
    });

    const response = await app.request(uploadSessionsPath, {
      body: "{}",
      method: "POST",
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "unauthorized" });
  });

  it("uses the authenticated owner and returns stable completion errors", async () => {
    const service = createUploadServiceMock();
    service.completeUpload.mockRejectedValue(
      new UploadSessionError("uploads_incomplete", 409),
    );
    const app = createApp({
      uploadRuntime: {
        authenticate: async () => ({ clerkId: "user_123", isAdmin: false }),
        isAllowedOrigin: () => true,
        service,
      },
    });

    const response = await app.request(
      `${uploadSessionsPath}/00000000-0000-4000-8000-000000000001/complete`,
      { method: "POST" },
    );

    expect(service.completeUpload).toHaveBeenCalledWith(
      "00000000-0000-4000-8000-000000000001",
      { clerkId: "user_123", isAdmin: false },
    );
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "uploads_incomplete",
    });
  });
  it("validates generic deletion targets before calling services", async () => {
    const service = createUploadServiceMock();
    const app = createApp({
      uploadRuntime: {
        authenticate: async () => ({ clerkId: "user_123", isAdmin: false }),
        isAllowedOrigin: () => true,
        service,
      },
    });
    for (const path of [
      "unknown/1",
      "resource_image/0",
      "product_image/not-a-number",
    ]) {
      expect(
        (
          await app.request(`/api/v0/storage/file/${path}`, {
            method: "DELETE",
          })
        ).status,
      ).toBe(400);
    }
    expect(service.deleteFile).not.toHaveBeenCalled();
    expect(
      (
        await app.request("/api/v0/storage/file/resource_image/42", {
          method: "DELETE",
        })
      ).status,
    ).toBe(204);
    expect(service.deleteFile).toHaveBeenCalledWith({
      fileType: "resource_image",
      fileId: 42,
      actor: { clerkId: "user_123", isAdmin: false },
    });
  });
});

function createUploadServiceMock() {
  return {
    cleanupExpired: vi.fn(async () => 0),
    complete: vi.fn(async () => ({ resourceId: 1000, version: 1 })),
    completeUpload: vi.fn(async () => ({ resourceId: 1000, version: 1 })),
    deleteFile: vi.fn(async () => {}),
    create: vi.fn(async () => ({
      expiresAt: "2026-09-17T01:00:00.000Z",
      id: "00000000-0000-4000-8000-000000000001",
      uploads: [
        {
          contentType: "application/octet-stream",
          fileName: "tool.stl",
          id: "00000000-0000-4000-8000-000000000002",
          kind: "file" as const,
          size: 3,
        },
      ],
    })),
    upload: vi.fn(async () => {}),
  } satisfies UploadSessionsService;
}
