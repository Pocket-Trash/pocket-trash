import type { Database } from "@package/database";
import type { ResourceStorage } from "@package/resources";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";
import {
  createResourceUploadSessionsService,
  ResourceUploadSessionError,
} from "./resource-upload-sessions.js";

describe("resource upload sessions", () => {
  it("casts upload sizes in the values CTE", async () => {
    const execute = vi.fn<(query: SQL) => Promise<void>>().mockResolvedValue();
    const db = { execute } as unknown as Database;
    const storage = storageMock();
    storage.createUploadTarget.mockReturnValue({
      contentType: "application/octet-stream",
      fileName: "tool.stl",
      objectPath: "resources/dev/tool.stl",
      size: 3,
      url: "https://cdn.example.test/resources/dev/tool.stl",
    });
    const service = createResourceUploadSessionsService({
      db,
      randomUUID: vi
        .fn()
        .mockReturnValueOnce("00000000-0000-4000-8000-000000000001")
        .mockReturnValueOnce("00000000-0000-4000-8000-000000000002"),
      storage,
    });

    await service.create(
      {
        categories: ["Tools"],
        description: "Description",
        files: [
          {
            contentType: "application/octet-stream",
            fileName: "tool.stl",
            size: 3,
          },
        ],
        isPrivate: true,
        name: "Tool",
        operation: "create",
      },
      "user-id",
    );

    const executedQuery = execute.mock.calls[0]?.[0];
    if (!executedQuery) throw new Error("Expected an upload-session insert");
    const query = new PgDialect().sqlToQuery(executedQuery);
    expect(query.sql).toContain("is_private");
    expect(query.sql).toContain("::integer");
    expect(query.params).toContain(true);
  });

  it("returns an already completed session without writing twice", async () => {
    const execute = vi.fn();
    const db = {
      execute,
      select: () =>
        chain([
          {
            completedAt: new Date(),
            completedResourceId: 42,
            completedVersion: 2,
          },
        ]),
    } as unknown as Database;
    const service = createResourceUploadSessionsService({
      db,
      storage: storageMock(),
    });

    await expect(service.complete("session-id", "user-id")).resolves.toEqual({
      resourceId: 42,
      version: 2,
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it("keeps an expired session when Bunny cleanup fails", async () => {
    const where = vi.fn(async () => undefined);
    const db = {
      delete: vi.fn(() => ({ where })),
      select: () =>
        chain([
          {
            objectPath: "resources/dev/tool.stl",
            sessionId: "session-id",
            uploadedAt: new Date(),
          },
        ]),
    } as unknown as Database;
    const storage = storageMock();
    storage.delete.mockRejectedValue(new Error("Bunny unavailable"));
    const service = createResourceUploadSessionsService({ db, storage });

    await expect(service.cleanupExpired()).resolves.toBe(0);
    expect(storage.delete).toHaveBeenCalledWith("resources/dev/tool.stl");
    expect(db.delete).not.toHaveBeenCalled();
  });

  it("returns stable validation and length errors before upload", async () => {
    const db = { execute: vi.fn(), select: vi.fn() } as unknown as Database;
    const storage = storageMock();
    storage.createUploadTarget.mockImplementation(() => {
      throw new Error("invalid MIME");
    });
    const service = createResourceUploadSessionsService({ db, storage });

    await expect(
      service.create(
        {
          categories: ["Tools"],
          description: "Description",
          files: [
            {
              contentType: "application/pdf",
              fileName: "tool.stl",
              size: 3,
            },
          ],
          name: "Tool",
          operation: "create",
        },
        "user-id",
      ),
    ).rejects.toEqual(new ResourceUploadSessionError("invalid_request", 400));
    expect(db.execute).not.toHaveBeenCalled();

    const activeDb = {
      select: () =>
        chain([
          {
            completedAt: null,
            contentType: "application/octet-stream",
            expiresAt: new Date(Date.now() + 60_000),
            objectPath: "resources/dev/tool.stl",
            size: 3,
          },
        ]),
    } as unknown as Database;
    const activeStorage = storageMock();
    const activeService = createResourceUploadSessionsService({
      db: activeDb,
      storage: activeStorage,
    });
    await expect(
      activeService.upload(
        "session-id",
        "file-id",
        "user-id",
        new Request("https://api.example.test/upload", {
          body: new Uint8Array([1, 2]),
          headers: {
            "content-length": "2",
            "content-type": "application/octet-stream",
          },
          method: "PUT",
        }),
      ),
    ).rejects.toEqual(
      new ResourceUploadSessionError("content_length_mismatch", 400),
    );
    expect(activeStorage.uploadStream).not.toHaveBeenCalled();
  });
});

function chain(rows: unknown[]) {
  const terminal = Object.assign(Promise.resolve(rows), {
    limit: async () => rows,
  });
  const query = {
    from: () => query,
    innerJoin: () => query,
    leftJoin: () => query,
    limit: async () => rows,
    where: () => terminal,
  };
  return query;
}

function storageMock() {
  return {
    createUploadTarget: vi.fn(),
    delete: vi.fn(async () => "deleted" as const),
    upload: vi.fn(),
    uploadPreview: vi.fn(),
    uploadStream: vi.fn(),
  } satisfies ResourceStorage;
}
