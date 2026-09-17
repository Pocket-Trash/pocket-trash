import type { Database } from "@package/database";
import {
  createLogger,
  createNoopLogger,
  type LogEvent,
  type LogTransport,
  loggerMessages,
} from "@package/logger";
import type { ResourceStorage } from "@package/resources";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";
import { hashLogIdentifier } from "../logging.js";
import { canViewResource, createResourcesService } from "./index.js";

function captureLogger(events: LogEvent[]) {
  const transport: LogTransport = {
    log(event) {
      events.push(event);
    },
  };

  return createLogger({
    app: "web",
    environment: "test",
    transports: [transport],
  });
}

describe("resources service", () => {
  it("enforces the private resource visibility matrix", () => {
    const privateResource = {
      isPrivate: true,
      uploaderClerkId: "user_owner",
    };

    expect(canViewResource({ ...privateResource, isPrivate: false }, {})).toBe(
      true,
    );
    expect(canViewResource(privateResource, {})).toBe(false);
    expect(
      canViewResource(privateResource, {
        clerkId: "user_other",
        isAdmin: false,
      }),
    ).toBe(false);
    expect(
      canViewResource(privateResource, {
        clerkId: "user_owner",
        isAdmin: false,
      }),
    ).toBe(true);
    expect(
      canViewResource(privateResource, {
        clerkId: "admin_123",
        isAdmin: true,
      }),
    ).toBe(true);
  });

  it("creates one resource notification and one per newly created category", async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [{ id: 1000 }] });
    const storage: ResourceStorage = {
      createUploadTarget: vi.fn(),
      delete: vi.fn(),
      upload: async (input) => ({
        ...input,
        objectPath: "dev/resource.stl",
        size: input.bytes.byteLength,
        url: "https://cdn.example.test/dev/resource.stl",
      }),
      uploadPreview: vi.fn(),
      uploadStream: vi.fn(),
    };
    const service = createResourcesService(
      { execute } as unknown as Database,
      storage,
      createNoopLogger({ app: "web", environment: "test" }),
    );

    await expect(
      service.create({
        categories: ["3D printing", "Refill tools"],
        description: "A useful clip.",
        files: [
          {
            bytes: new Uint8Array([1]),
            contentType: "model/stl",
            fileName: "clip.stl",
          },
        ],
        name: "Pocket clip",
        uploaderClerkId: "user_123",
      }),
    ).resolves.toEqual({ id: 1000 });

    const query = new PgDialect().sqlToQuery(execute.mock.calls[0]?.[0]);
    expect(query.sql).toContain("(xmax = 0) as created");
    expect(query.sql).toContain("inserted_resource_notification");
    expect(query.sql).toContain("inserted_category_notifications");
    expect(query.sql).toContain("where upserted_categories.created");
  });

  it("cleans uploaded objects and logs safely when persistence fails", async () => {
    const events: LogEvent[] = [];
    const logger = captureLogger(events);
    const execute = vi
      .fn()
      .mockRejectedValue(new Error("database unavailable"));
    const deleted: string[] = [];
    const storage: ResourceStorage = {
      createUploadTarget: vi.fn(),
      async delete(objectPath) {
        deleted.push(objectPath);
        return "deleted";
      },
      async upload(input) {
        return {
          ...input,
          objectPath: "dev/resource.stl",
          size: input.bytes.byteLength,
          url: "https://cdn.example.test/dev/resource.stl",
        };
      },
      async uploadPreview(input) {
        return {
          ...input,
          objectPath: "dev/preview.webp",
          size: input.bytes.byteLength,
          url: "https://cdn.example.test/dev/preview.webp",
        };
      },
      uploadStream: vi.fn(),
    };
    const service = createResourcesService(
      { execute } as unknown as Database,
      storage,
      logger,
    );

    await expect(
      service.create({
        categories: ["3D printing"],
        description: "A useful clip.",
        files: [
          {
            bytes: new Uint8Array([1]),
            contentType: "model/stl",
            fileName: "private-file.stl",
          },
        ],
        name: "Pocket clip",
        preview: {
          bytes: new Uint8Array([2]),
          contentType: "image/webp",
          fileName: "private-preview.webp",
        },
        uploaderClerkId: "user_private",
      }),
    ).rejects.toThrow("database unavailable");
    await logger.flush();

    expect(deleted).toEqual(["dev/resource.stl", "dev/preview.webp"]);
    expect(events).toHaveLength(1);
    expect(events[0]?.message).toBe(
      `${loggerMessages.resources.create}.failed`,
    );
    expect(events[0]?.attributes).toMatchObject({
      categoryCount: 1,
      fileCount: 1,
      operation: loggerMessages.resources.create,
      outcome: "failure",
      uploaderClerkIdHash: hashLogIdentifier("user_private"),
    });
    expect(JSON.stringify(events)).not.toContain("private-file.stl");
    expect(JSON.stringify(events)).not.toContain("user_private");
  });

  it("rejects duplicate filenames case-insensitively before upload", async () => {
    const upload = vi.fn();
    const service = createResourcesService(
      {} as Database,
      { upload } as unknown as ResourceStorage,
      createNoopLogger({ app: "web", environment: "test" }),
    );

    await expect(
      service.create({
        categories: ["3D printing"],
        description: "A useful clip.",
        files: [
          {
            bytes: new Uint8Array([1]),
            contentType: "model/stl",
            fileName: "clip.stl",
          },
          {
            bytes: new Uint8Array([2]),
            contentType: "model/stl",
            fileName: "CLIP.STL",
          },
        ],
        name: "Pocket clip",
        uploaderClerkId: "user_123",
      }),
    ).rejects.toThrow("Resource filenames must be unique within a version.");
    expect(upload).not.toHaveBeenCalled();
  });

  it("records a download before returning the file URL", async () => {
    const calls: string[] = [];
    const db = {
      insert() {
        return {
          async values() {
            calls.push("recorded");
          },
        };
      },
      select() {
        return {
          from() {
            return {
              innerJoin() {
                return {
                  innerJoin() {
                    return {
                      where() {
                        return {
                          async limit() {
                            calls.push("selected");
                            return [
                              {
                                id: 1001,
                                url: "https://cdn.example.test/file.stl",
                              },
                            ];
                          },
                        };
                      },
                    };
                  },
                };
              },
            };
          },
        };
      },
    } as unknown as Database;
    const service = createResourcesService(
      db,
      {} as ResourceStorage,
      createNoopLogger({ app: "web", environment: "test" }),
    );

    await expect(service.download(1000, 1001)).resolves.toBe(
      "https://cdn.example.test/file.stl",
    );
    expect(calls).toEqual(["selected", "recorded"]);
  });

  it("returns resource detail with event-derived download counts", async () => {
    const createdAt = new Date("2026-09-16T12:00:00Z");
    const categories = [{ id: 1002, name: "3D printing", slug: "3d-printing" }];
    const version = {
      createdAt,
      id: 1001,
      version: 1,
    };
    const file = {
      contentType: "model/stl",
      downloadCount: 2,
      fileName: "clip.stl",
      id: 1003,
      size: 42,
      versionId: 1001,
    };
    const currentVersion = {
      ...version,
      downloadCount: 2,
      files: [
        {
          contentType: file.contentType,
          downloadCount: file.downloadCount,
          fileName: file.fileName,
          id: file.id,
          size: file.size,
        },
      ],
    };
    const select = vi
      .fn()
      .mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: async () => [
              {
                createdAt,
                description: "A useful clip.",
                id: 1000,
                isPrivate: false,
                name: "Pocket clip",
                privateReason: null,
                privatedAt: null,
                previewImageUrl: null,
                uploaderClerkId: "user_123",
              },
            ],
          }),
        }),
      })
      .mockReturnValueOnce({
        from: () => ({
          where: () => ({
            orderBy: async () => [version],
          }),
        }),
      })
      .mockReturnValueOnce({
        from: () => ({
          leftJoin: () => ({
            innerJoin: () => ({
              where: () => ({
                groupBy: () => ({ orderBy: async () => [file] }),
              }),
            }),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: () => ({
          innerJoin: () => ({
            where: () => ({ orderBy: async () => categories }),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: () => ({
          innerJoin: () => ({
            leftJoin: () => ({
              where: async () => [{ downloadCount: 3 }],
            }),
          }),
        }),
      });
    const service = createResourcesService(
      { select } as unknown as Database,
      {} as ResourceStorage,
      createNoopLogger({ app: "web", environment: "test" }),
    );

    await expect(service.getDetail(1000)).resolves.toEqual({
      categories,
      createdAt,
      currentVersion,
      description: "A useful clip.",
      downloadCount: 3,
      id: 1000,
      isPrivate: false,
      name: "Pocket clip",
      privateReason: null,
      privatedAt: null,
      previewImageUrl: null,
      uploaderClerkId: "user_123",
      versions: [currentVersion],
    });
  });

  it("returns no detail for a private resource viewed by an unrelated user", async () => {
    const select = vi.fn().mockReturnValue({
      from: () => ({
        where: () => ({
          limit: async () => [
            {
              id: 1000,
              isPrivate: true,
              uploaderClerkId: "user_owner",
            },
          ],
        }),
      }),
    });
    const service = createResourcesService(
      { select } as unknown as Database,
      {} as ResourceStorage,
      createNoopLogger({ app: "web", environment: "test" }),
    );

    await expect(
      service.getDetail(1000, { clerkId: "user_other" }),
    ).resolves.toBeNull();
    expect(select).toHaveBeenCalledTimes(1);
  });

  it("lists directory cards and rejects unknown category filters", async () => {
    const categories = [{ id: 1002, name: "3D printing", slug: "3d-printing" }];
    const resources = [
      {
        categories,
        createdAt: new Date("2026-09-16T12:00:00Z"),
        currentVersion: {
          fileName: "clip.stl",
          id: 1001,
        },
        downloadCount: 3,
        id: 1000,
        name: "Pocket clip",
        previewImageUrl: null,
      },
    ];
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ rows: categories })
      .mockResolvedValueOnce({ rows: resources })
      .mockResolvedValueOnce({ rows: categories });
    const service = createResourcesService(
      { execute } as unknown as Database,
      {} as ResourceStorage,
      createNoopLogger({ app: "web", environment: "test" }),
    );

    await expect(service.listDirectory(["3d-printing"])).resolves.toEqual({
      categories,
      invalidFilters: [],
      resources,
    });
    await expect(service.listDirectory(["missing-category"])).resolves.toEqual({
      categories,
      invalidFilters: ["missing-category"],
      resources: [],
    });
    expect(execute).toHaveBeenCalledTimes(3);
    const query = new PgDialect().sqlToQuery(execute.mock.calls[1]?.[0]);
    expect(query.sql).toContain("order by resources.created_at desc");
    expect(query.params).toEqual([false, "", "3d-printing"]);
  });

  it("lists notifications newest first and marks unread rows globally", async () => {
    const notification = {
      categories: ["3D printing"],
      categoryName: null,
      createdAt: new Date("2026-09-16T12:00:00Z"),
      id: 1000,
      isPrivate: false,
      readAt: null,
      readByClerkId: null,
      resourceId: 1001,
      resourceName: "Pocket clip",
      type: "resource_created" as const,
      uploaderClerkId: "user_123",
    };
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ rows: [notification] })
      .mockResolvedValueOnce({ rows: [] });
    const service = createResourcesService(
      { execute } as unknown as Database,
      {} as ResourceStorage,
      createNoopLogger({ app: "web", environment: "test" }),
    );

    await expect(service.listNotifications()).resolves.toEqual([notification]);
    await expect(
      service.markNotificationRead(1000, "admin_123"),
    ).resolves.toBeUndefined();

    const listQuery = new PgDialect().sqlToQuery(execute.mock.calls[0]?.[0]);
    expect(listQuery.sql).toContain(
      "order by resource_notifications.created_at desc",
    );
    const updateQuery = new PgDialect().sqlToQuery(execute.mock.calls[1]?.[0]);
    expect(updateQuery.sql).toContain("where id = $2 and read_at is null");
    expect(updateQuery.params).toEqual(["admin_123", 1000]);
  });

  it("records private moderation metadata", async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [] });
    const service = createResourcesService(
      { execute } as unknown as Database,
      {} as ResourceStorage,
      createNoopLogger({ app: "web", environment: "test" }),
    );

    await expect(
      service.markPrivate({
        actorClerkId: "admin_123",
        reason: "Inappropriate content",
        resourceId: 1000,
      }),
    ).resolves.toBeUndefined();

    const query = new PgDialect().sqlToQuery(execute.mock.calls[0]?.[0]);
    expect(query.sql).toContain("set is_private = true");
    expect(query.sql).toContain("privated_at = now()");
    expect(query.params).toEqual(["Inappropriate content", "admin_123", 1000]);
  });

  it("rejects non-owner mutations before uploading files", async () => {
    const upload = vi.fn();
    const db = {
      select: () => ({
        from: () => ({ where: () => ({ limit: async () => [] }) }),
      }),
    } as unknown as Database;
    const service = createResourcesService(
      db,
      { upload } as unknown as ResourceStorage,
      createNoopLogger({ app: "web", environment: "test" }),
    );

    await expect(
      service.addVersion({
        files: [
          {
            bytes: new Uint8Array([1]),
            contentType: "model/stl",
            fileName: "clip.stl",
          },
        ],
        resourceId: 1000,
        uploaderClerkId: "user_other",
      }),
    ).rejects.toThrow("Resource owner is required.");
    await expect(
      service.update({
        actorClerkId: "user_other",
        actorIsAdmin: false,
        categories: ["3D printing"],
        description: "Updated.",
        name: "Updated clip",
        resourceId: 1000,
      }),
    ).rejects.toThrow("Resource owner is required.");
    expect(upload).not.toHaveBeenCalled();
  });

  it("allows admins to update non-owned metadata", async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [{ id: 1000 }] });
    const db = {
      execute,
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [{ id: 1000, previewObjectPath: null }],
          }),
        }),
      }),
    } as unknown as Database;
    const service = createResourcesService(
      db,
      {} as ResourceStorage,
      createNoopLogger({ app: "web", environment: "test" }),
    );

    await expect(
      service.update({
        actorClerkId: "admin_123",
        actorIsAdmin: true,
        categories: ["3D printing"],
        description: "Updated.",
        name: "Updated clip",
        resourceId: 1000,
      }),
    ).resolves.toEqual({ id: 1000 });

    const query = new PgDialect().sqlToQuery(execute.mock.calls[0]?.[0]);
    expect(query.params).toContain(true);
    expect(query.params).toContain("admin_123");
  });

  it("derives the next immutable version number in the database", async () => {
    const execute = vi.fn().mockResolvedValue({
      rows: [{ id: 1002, version: 2 }],
    });
    const storage: ResourceStorage = {
      createUploadTarget: vi.fn(),
      delete: vi.fn(),
      upload: async (input) => ({
        ...input,
        objectPath: "dev/version-2.stl",
        size: input.bytes.byteLength,
        url: "https://cdn.example.test/dev/version-2.stl",
      }),
      uploadPreview: vi.fn(),
      uploadStream: vi.fn(),
    };
    const db = {
      execute,
      select: () => ({
        from: () => ({
          where: () => ({ limit: async () => [{ id: 1000 }] }),
        }),
      }),
    } as unknown as Database;
    const service = createResourcesService(
      db,
      storage,
      createNoopLogger({ app: "web", environment: "test" }),
    );

    await expect(
      service.addVersion({
        files: [
          {
            bytes: new Uint8Array([1]),
            contentType: "model/stl",
            fileName: "clip.stl",
          },
        ],
        resourceId: 1000,
        uploaderClerkId: "user_123",
      }),
    ).resolves.toEqual({ id: 1002, version: 2 });
    const query = new PgDialect().sqlToQuery(execute.mock.calls[0]?.[0]);
    expect(query.sql).toContain(
      "coalesce(max(resource_versions.version), 0) + 1",
    );
    expect(query.sql).toContain("returning id, resource_id, version");
  });

  it("updates owner metadata and replaces its preview", async () => {
    const deleted: string[] = [];
    const execute = vi.fn().mockResolvedValue({ rows: [{ id: 1000 }] });
    const storage: ResourceStorage = {
      createUploadTarget: vi.fn(),
      async delete(objectPath) {
        deleted.push(objectPath);
        return "deleted";
      },
      upload: vi.fn(),
      async uploadPreview(input) {
        return {
          ...input,
          objectPath: "dev/new-preview.webp",
          size: input.bytes.byteLength,
          url: "https://cdn.example.test/dev/new-preview.webp",
        };
      },
      uploadStream: vi.fn(),
    };
    const db = {
      execute,
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [
              { id: 1000, previewObjectPath: "dev/old-preview.webp" },
            ],
          }),
        }),
      }),
    } as unknown as Database;
    const service = createResourcesService(
      db,
      storage,
      createNoopLogger({ app: "web", environment: "test" }),
    );

    await expect(
      service.update({
        actorClerkId: "user_123",
        actorIsAdmin: false,
        categories: ["3D printing"],
        description: "Updated description.",
        name: "Updated clip",
        preview: {
          bytes: new Uint8Array([1]),
          contentType: "image/webp",
          fileName: "preview.webp",
        },
        resourceId: 1000,
      }),
    ).resolves.toEqual({ id: 1000 });
    expect(deleted).toEqual(["dev/old-preview.webp"]);
    const query = new PgDialect().sqlToQuery(execute.mock.calls[0]?.[0]);
    expect(query.sql).toContain("update resources");
    expect(query.sql).toContain("on conflict do nothing");
  });
});
