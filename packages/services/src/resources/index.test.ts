import type { Database } from "@package/database";
import {
  createLogger,
  createNoopLogger,
  type LogEvent,
  type LogTransport,
  loggerMessages,
} from "@package/logger";
import type { UploadStorage } from "@package/storage";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";
import { hashLogIdentifier } from "../logging.js";
import { canViewResource, createResourcesService } from "./index.js";

/**
 * Creates a test actor.
 *
 * @param clerkId - Clerk identity assigned to the actor.
 * @param role - Authorization role, defaulting to a regular user.
 * @returns Test actor identity.
 */
const actor = (
  clerkId: string,
  role: "user" | "admin" | "system_admin" = "user",
) => ({ clerkId, role }) as const;

/**
 * Creates an in-memory logger for resource-service assertions.
 *
 * @param events - Array that receives structured log events.
 * @returns Logger wired to the supplied event array.
 */
function captureLogger(events: LogEvent[]) {
  const transport: LogTransport = {
    /**
     * Captures a structured log event for assertions.
     *
     * @param event - Structured event captured for assertions.
     */
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

    expect(canViewResource({ ...privateResource, isPrivate: false })).toBe(
      true,
    );
    expect(canViewResource(privateResource)).toBe(false);
    expect(canViewResource(privateResource, actor("user_other"))).toBe(false);
    expect(canViewResource(privateResource, actor("user_owner"))).toBe(true);
    expect(canViewResource(privateResource, actor("admin_123", "admin"))).toBe(
      true,
    );
  });

  it("rejects duplicate filenames case-insensitively before upload", async () => {
    const upload = vi.fn();
    const service = createResourcesService(
      {} as Database,
      { upload } as unknown as UploadStorage,
      createNoopLogger({ app: "web", environment: "test" }),
    );

    await expect(
      service.create({
        actor: actor("user_123"),
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
        images: [
          {
            bytes: new Uint8Array([3]),
            contentType: "image/webp",
            fileName: "clip.webp",
          },
        ],
        name: "Pocket clip",
      }),
    ).rejects.toThrow("invalid_request");
    expect(upload).not.toHaveBeenCalled();
  });

  it("signs before recording one authenticated file download per version", async () => {
    const calls: string[] = [];
    const db = {
      execute: vi
        .fn()
        .mockImplementationOnce(async () => {
          calls.push("selected");
          return {
            rows: [
              {
                objectPath: "resources/dev/file.stl",
                versionId: 1001,
              },
            ],
          };
        })
        .mockImplementationOnce(async () => {
          calls.push("recorded");
          return { rows: [] };
        }),
    } as unknown as Database;
    const service = createResourcesService(
      db,
      {} as UploadStorage,
      createNoopLogger({ app: "web", environment: "test" }),
      async (objectPath) => {
        calls.push("signed");
        expect(objectPath).toBe("resources/dev/file.stl");
        return "https://cdn.example.test/resources/dev/file.stl?token=signed";
      },
    );

    await expect(
      service.downloadFile(1000, 1002, actor("user_123")),
    ).resolves.toBe(
      "https://cdn.example.test/resources/dev/file.stl?token=signed",
    );
    expect(calls).toEqual(["selected", "signed", "recorded"]);
    const recordQuery = new PgDialect().sqlToQuery(
      (db.execute as ReturnType<typeof vi.fn>).mock.calls[1]?.[0],
    );
    expect(recordQuery.sql).toContain(
      "on conflict (version_id, user_clerk_id) do nothing",
    );
    expect(recordQuery.params).toEqual([1001, "user_123"]);
  });

  it("counts every anonymous file download only after signing succeeds", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [{ objectPath: "resources/dev/file.stl", versionId: 1001 }],
      })
      .mockResolvedValueOnce({
        rows: [{ objectPath: "resources/dev/file.stl", versionId: 1001 }],
      })
      .mockResolvedValueOnce({ rows: [] });
    const sign = vi.fn().mockRejectedValueOnce(new Error("signing failed"));
    const service = createResourcesService(
      { execute } as unknown as Database,
      {} as UploadStorage,
      createNoopLogger({ app: "web", environment: "test" }),
      sign,
    );

    await expect(service.downloadFile(1000, 1002)).rejects.toThrow(
      "signing failed",
    );
    expect(execute).toHaveBeenCalledTimes(1);

    sign.mockResolvedValueOnce("https://cdn.example.test/signed");
    await expect(service.downloadFile(1000, 1002)).resolves.toBe(
      "https://cdn.example.test/signed",
    );
    const countQuery = new PgDialect().sqlToQuery(execute.mock.calls[2]?.[0]);
    expect(countQuery.sql).toContain("anonymous_download_count + 1");
    expect(countQuery.params).toEqual([1001]);
  });

  it("streams one ZIP candidate and deletes it when compare-and-set selects a winner", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [
          {
            archiveObjectPath: null,
            fileName: "first.stl",
            objectPath: "resources/dev/1000/first.stl",
            size: 3,
            version: 2,
            versionId: 1001,
          },
          {
            archiveObjectPath: null,
            fileName: "notes.txt",
            objectPath: "resources/dev/1000/notes.txt",
            size: 5,
            version: 2,
            versionId: 1001,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            objectPath:
              "resources/dev/1000/archives/winner/resource-1000-v2.zip",
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });
    const remove = vi.fn().mockResolvedValue("deleted");
    const putFile = vi.fn(
      async ({
        body,
      }: {
        /** Readable upload body consumed by the storage double. */
        body: ReadableStream;
      }) => {
        await new Response(body).arrayBuffer();
      },
    );
    const storage = {
      createArchiveTarget: vi.fn(() => ({
        contentType: "application/zip",
        fileName: "resource-1000-v2.zip",
        objectPath:
          "resources/dev/1000/archives/candidate/resource-1000-v2.zip",
        size: 0,
        url: "https://cdn.example.test/candidate",
      })),
      delete: remove,
      readFile: vi.fn(async (objectPath: string) =>
        new Blob([
          objectPath.endsWith("notes.txt")
            ? "notes"
            : new Uint8Array([1, 2, 3]),
        ]).stream(),
      ),
      putFile,
    } as unknown as UploadStorage;
    const service = createResourcesService(
      { execute } as unknown as Database,
      storage,
      createNoopLogger({ app: "web", environment: "test" }),
      async (objectPath) => `https://cdn.example.test/${objectPath}`,
    );

    await expect(service.downloadVersion(1000, 1001)).resolves.toBe(
      "https://cdn.example.test/resources/dev/1000/archives/winner/resource-1000-v2.zip",
    );
    expect(putFile).toHaveBeenCalledOnce();
    expect(storage.readFile).toHaveBeenCalledTimes(2);
    expect(remove).toHaveBeenCalledWith(
      "resources/dev/1000/archives/candidate/resource-1000-v2.zip",
    );
    const candidateQuery = new PgDialect().sqlToQuery(
      execute.mock.calls[1]?.[0],
    );
    expect(candidateQuery.sql).toContain("archive_object_path is null");
  });

  it("returns resource detail with event-derived download counts", async () => {
    const createdAt = new Date("2026-09-16T12:00:00Z");
    const categories = [{ id: 1002, name: "3D printing", slug: "3d-printing" }];
    const version = {
      createdAt,
      downloadCount: 2,
      id: 1001,
      version: 1,
    };
    const file = {
      contentType: "model/stl",
      fileName: "clip.stl",
      id: 1003,
      size: 42,
      versionId: 1001,
    };
    const image = {
      contentType: "image/webp",
      fileName: "preview.webp",
      id: 1004,
      objectPath: "resources/dev/preview.webp",
      position: 0,
      size: 24,
    };
    const currentVersion = {
      ...version,
      downloadCount: 2,
      files: [
        {
          contentType: file.contentType,
          fileName: file.fileName,
          id: file.id,
          size: file.size,
        },
      ],
    };
    const select = vi
      .fn()
      .mockReturnValueOnce({
        /**
         * Starts the next stage of the select-query stub.
         *
         * @returns Next select-query stage.
         */
        from: () => ({
          /**
           * Adds an inner join to the select-query stub.
           *
           * @returns Next select-query stage.
           */
          innerJoin: () => ({
            /**
             * Applies the configured filter to the select-query stub.
             *
             * @returns Query stage that limits the resource-detail rows.
             */
            where: () => ({
              /**
               * Resolves the configured limited query rows.
               *
               * @returns Configured query rows.
               */
              limit: async () => [
                {
                  resource: {
                    createdAt,
                    description: "A useful clip.",
                    id: 1000,
                    isPrivate: false,
                    name: "Pocket clip",
                    privateReason: null,
                    privatedAt: null,
                    uploaderClerkId: "user_123",
                  },
                  uploaderUsername: "roy",
                },
              ],
            }),
          }),
        }),
      })
      .mockReturnValueOnce({
        /**
         * Starts the next stage of the select-query stub.
         *
         * @returns Next select-query stage.
         */
        from: () => ({
          /**
           * Applies the configured filter to the select-query stub.
           *
           * @returns Query stage that orders the resource images.
           */
          where: () => ({
            /**
             * Applies ordering to the select-query stub.
             *
             * @returns Configured query rows.
             */
            orderBy: async () => [image],
          }),
        }),
      })
      .mockReturnValueOnce({
        /**
         * Starts the next stage of the select-query stub.
         *
         * @returns Next select-query stage.
         */
        from: () => ({
          /**
           * Adds a left join to the select-query stub.
           *
           * @returns Next select-query stage.
           */
          leftJoin: () => ({
            /**
             * Applies the configured filter to the select-query stub.
             *
             * @returns Query stage that groups the resource versions.
             */
            where: () => ({
              /**
               * Adds grouping to the select-query stub.
               *
               * @returns Next select-query stage.
               */
              groupBy: () => ({
                /**
                 * Applies ordering to the select-query stub.
                 *
                 * @returns Configured query rows.
                 */
                orderBy: async () => [version],
              }),
            }),
          }),
        }),
      })
      .mockReturnValueOnce({
        /**
         * Starts the next stage of the select-query stub.
         *
         * @returns Next select-query stage.
         */
        from: () => ({
          /**
           * Adds an inner join to the select-query stub.
           *
           * @returns Next select-query stage.
           */
          innerJoin: () => ({
            /**
             * Applies the configured filter to the select-query stub.
             *
             * @returns Query stage that orders the version files.
             */
            where: () => ({
              /**
               * Applies ordering to the select-query stub.
               *
               * @returns Configured query rows.
               */
              orderBy: async () => [file],
            }),
          }),
        }),
      })
      .mockReturnValueOnce({
        /**
         * Starts the next stage of the select-query stub.
         *
         * @returns Next select-query stage.
         */
        from: () => ({
          /**
           * Adds an inner join to the select-query stub.
           *
           * @returns Next select-query stage.
           */
          innerJoin: () => ({
            /**
             * Applies the configured filter to the select-query stub.
             *
             * @returns Query stage that orders the resource categories.
             */
            where: () => ({
              /**
               * Applies ordering to the select-query stub.
               *
               * @returns Configured query rows.
               */
              orderBy: async () => categories,
            }),
          }),
        }),
      })
      .mockReturnValueOnce({
        /**
         * Starts the next stage of the select-query stub.
         *
         * @returns Next select-query stage.
         */
        from: () => ({
          /**
           * Adds a left join to the select-query stub.
           *
           * @returns Next select-query stage.
           */
          leftJoin: () => ({
            /**
             * Applies the configured filter to the select-query stub.
             *
             * @returns Configured aggregate download-count row.
             */
            where: async () => [{ downloadCount: 3 }],
          }),
        }),
      });
    const service = createResourcesService(
      { select } as unknown as Database,
      {} as UploadStorage,
      createNoopLogger({ app: "web", environment: "test" }),
      async (objectPath) =>
        `https://cdn.example.test/${objectPath}?token=signed`,
    );

    await expect(service.getDetail(1000)).resolves.toEqual({
      categories,
      createdAt,
      currentVersion,
      description: "A useful clip.",
      downloadCount: 3,
      id: 1000,
      images: [
        {
          contentType: image.contentType,
          fileName: image.fileName,
          id: image.id,
          position: image.position,
          size: image.size,
          url: "https://cdn.example.test/resources/dev/preview.webp?token=signed&format=webp&quality=85",
        },
      ],
      isAdminPrivate: false,
      isPrivate: false,
      name: "Pocket clip",
      privateReason: null,
      privatedAt: null,
      uploaderClerkId: "user_123",
      uploaderUsername: "roy",
      versions: [],
    });
  });

  it("returns no detail for a private resource viewed by an unrelated user", async () => {
    const select = vi.fn().mockReturnValue({
      /**
       * Starts the next stage of the select-query stub.
       *
       * @returns Next select-query stage.
       */
      from: () => ({
        /**
         * Adds an inner join to the select-query stub.
         *
         * @returns Next select-query stage.
         */
        innerJoin: () => ({
          /**
           * Applies the configured filter to the select-query stub.
           *
           * @returns Query stage that limits the private-resource rows.
           */
          where: () => ({
            /**
             * Resolves the configured limited query rows.
             *
             * @returns Configured query rows.
             */
            limit: async () => [
              {
                resource: {
                  id: 1000,
                  isPrivate: true,
                  uploaderClerkId: "user_owner",
                },
                uploaderUsername: "owner",
              },
            ],
          }),
        }),
      }),
    });
    const service = createResourcesService(
      { select } as unknown as Database,
      {} as UploadStorage,
      createNoopLogger({ app: "web", environment: "test" }),
    );

    await expect(
      service.getDetail(1000, actor("user_other")),
    ).resolves.toBeNull();
    expect(select).toHaveBeenCalledTimes(1);
  });

  it("lists directory cards and rejects unknown category filters", async () => {
    const categories = [{ id: 1002, name: "3D printing", slug: "3d-printing" }];
    const resourceRows = [
      {
        categories,
        createdAt: new Date("2026-09-16T12:00:00Z"),
        currentVersion: {
          fileCount: 1,
          fileId: 1003,
          fileName: "clip.stl",
          id: 1001,
          version: 1,
        },
        downloadCount: 3,
        id: 1000,
        name: "Pocket clip",
        coverImageObjectPath: "resources/dev/preview.webp",
        uploaderClerkId: "user_123",
        uploaderUsername: "roy",
      },
    ];
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ rows: categories })
      .mockResolvedValueOnce({ rows: resourceRows })
      .mockResolvedValueOnce({ rows: categories });
    const service = createResourcesService(
      { execute } as unknown as Database,
      {} as UploadStorage,
      createNoopLogger({ app: "web", environment: "test" }),
      async (objectPath) =>
        `https://cdn.example.test/${objectPath}?token=signed`,
    );

    await expect(service.listDirectory(["3d-printing"])).resolves.toEqual({
      categories,
      invalidFilters: [],
      resources: [
        {
          categories,
          createdAt: new Date("2026-09-16T12:00:00Z"),
          currentVersion: {
            fileCount: 1,
            fileId: 1003,
            fileName: "clip.stl",
            id: 1001,
            version: 1,
          },
          downloadCount: 3,
          id: 1000,
          name: "Pocket clip",
          uploaderClerkId: "user_123",
          uploaderUsername: "roy",
          coverImageUrl:
            "https://cdn.example.test/resources/dev/preview.webp?token=signed&format=webp&quality=85",
        },
      ],
    });
    await expect(service.listDirectory(["missing-category"])).resolves.toEqual({
      categories,
      invalidFilters: ["missing-category"],
      resources: [],
    });
    expect(execute).toHaveBeenCalledTimes(3);
    const query = new PgDialect().sqlToQuery(execute.mock.calls[1]?.[0]);
    expect(query.sql).toContain("inner join users");
    expect(query.sql).toContain('users.username as "uploaderUsername"');
    expect(query.sql).toContain("order by resources.created_at desc");
    expect(query.sql).toContain('"resources"."deleted_at" is null');
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
      readByUsername: null,
      resourceId: 1001,
      resourceName: "Pocket clip",
      type: "resource_created" as const,
      uploaderUsername: "roy",
    };
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ rows: [notification] })
      .mockResolvedValueOnce({ rows: [] });
    const service = createResourcesService(
      { execute } as unknown as Database,
      {} as UploadStorage,
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
    expect(listQuery.sql).toContain("resources.deleted_at is null");
    expect(listQuery.sql).toContain('uploader.username as "uploaderUsername"');
    expect(listQuery.sql).not.toContain('as "uploaderClerkId"');
    const updateQuery = new PgDialect().sqlToQuery(execute.mock.calls[1]?.[0]);
    expect(updateQuery.sql).toContain("where id = $2 and read_at is null");
    expect(updateQuery.params).toEqual(["admin_123", 1000]);
  });

  it("records private moderation metadata", async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [{ id: 1000 }] });
    const service = createResourcesService(
      { execute } as unknown as Database,
      {} as UploadStorage,
      createNoopLogger({ app: "web", environment: "test" }),
    );

    await expect(
      service.markPrivate({
        actor: actor("admin_123", "admin"),
        reason: "Inappropriate content",
        resourceId: 1000,
      }),
    ).resolves.toBeUndefined();

    const query = new PgDialect().sqlToQuery(execute.mock.calls[0]?.[0]);
    expect(query.sql).toContain("set is_private = true");
    expect(query.sql).toContain("privated_at = now()");
    expect(query.params).toEqual(["Inappropriate content", "admin_123", 1000]);
  });

  it("keeps admin-private resources locked from owner visibility changes", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 1000 }] });
    const service = createResourcesService(
      { execute } as unknown as Database,
      {} as UploadStorage,
      createNoopLogger({ app: "web", environment: "test" }),
    );

    await expect(
      service.setVisibility({
        actor: actor("user_123"),
        isPublic: true,
        resourceId: 1000,
      }),
    ).rejects.toThrow("Resource visibility update is not allowed.");
    await expect(
      service.setVisibility({
        actor: actor("user_123"),
        isPublic: false,
        resourceId: 1000,
      }),
    ).rejects.toThrow("Resource visibility update is not allowed.");
    await expect(
      service.setVisibility({
        actor: actor("admin_123", "admin"),
        isPublic: true,
        resourceId: 1000,
      }),
    ).resolves.toBeUndefined();

    const ownerQuery = new PgDialect().sqlToQuery(execute.mock.calls[0]?.[0]);
    expect(ownerQuery.sql).toContain("privated_by_clerk_id is null");
    expect(ownerQuery.params).toContain(false);
    expect(ownerQuery.params).toContain("user_123");
  });

  it("rejects non-owner mutations before uploading files", async () => {
    const upload = vi.fn();
    const db = {
      /**
       * Runs work against the transaction double.
       *
       * @param fn - Work to run with the transaction double.
       * @returns Result produced by the transaction callback.
       * @rejects When the transaction callback rejects.
       */
      transaction: async (fn: (tx: unknown) => unknown) =>
        fn({
          execute: vi.fn(),
          /**
           * Starts a select-query stub.
           *
           * @returns First select-query stage.
           */
          select: () => ({
            /**
             * Starts the next stage of the select-query stub.
             *
             * @returns Next select-query stage.
             */
            from: () => ({
              /**
               * Applies the configured filter to the select-query stub.
               *
               * @returns Query stage that limits the existing-resource rows.
               */
              where: () => ({
                /**
                 * Resolves the configured limited query rows.
                 *
                 * @returns Configured query rows.
                 */
                limit: async () => [],
              }),
            }),
          }),
        }),
      /**
       * Starts a select-query stub.
       *
       * @returns First select-query stage.
       */
      select: () => ({
        /**
         * Starts the next stage of the select-query stub.
         *
         * @returns Next select-query stage.
         */
        from: () => ({
          /**
           * Applies the configured filter to the select-query stub.
           *
           * @returns Query stage that limits the resource lookup rows.
           */
          where: () => ({
            /**
             * Resolves the configured limited query rows.
             *
             * @returns Configured query rows.
             */
            limit: async () => [],
          }),
        }),
      }),
    } as unknown as Database;
    const service = createResourcesService(
      db,
      { upload } as unknown as UploadStorage,
      createNoopLogger({ app: "web", environment: "test" }),
    );

    await expect(
      service.update({
        actor: actor("user_other"),
        categories: ["3D printing"],
        description: "Updated.",
        images: [],
        name: "Updated clip",
        retainedImageIds: [1000],
        resourceId: 1000,
      }),
    ).rejects.toThrow("Resource owner is required.");
    expect(upload).not.toHaveBeenCalled();
  });

  it("allows admins to update non-owned metadata", async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [{ id: 1000 }] });
    const select = vi
      .fn()
      .mockReturnValueOnce({
        /**
         * Starts the next stage of the select-query stub.
         *
         * @returns Next select-query stage.
         */
        from: () => ({
          /**
           * Applies the configured filter to the select-query stub.
           *
           * @returns Query stage that limits the editable-resource rows.
           */
          where: () => ({
            /**
             * Resolves the configured limited query rows.
             *
             * @returns Configured query rows.
             */
            limit: async () => [{ id: 1000 }],
          }),
        }),
      })
      .mockReturnValueOnce({
        /**
         * Starts the next stage of the select-query stub.
         *
         * @returns Next select-query stage.
         */
        from: () => ({
          /**
           * Applies the configured filter to the select-query stub.
           *
           * @returns Configured retained-image rows.
           */
          where: async () => [{ id: 1000, objectPath: "dev/1000/image.webp" }],
        }),
      });
    const db = {
      /**
       * Runs work against the transaction double.
       *
       * @param fn - Work to run with the transaction double.
       * @returns Result produced by the transaction callback.
       * @rejects When the transaction callback rejects.
       */
      transaction: async (fn: (tx: unknown) => unknown) =>
        fn({ execute, select }),
      execute,
      select,
    } as unknown as Database;
    const service = createResourcesService(
      db,
      {} as UploadStorage,
      createNoopLogger({ app: "web", environment: "test" }),
    );

    await expect(
      service.update({
        actor: actor("admin_123", "admin"),
        categories: ["3D printing"],
        description: "Updated.",
        images: [],
        name: "Updated clip",
        retainedImageIds: [1000],
        resourceId: 1000,
      }),
    ).resolves.toEqual({ id: 1000 });

    const query = new PgDialect().sqlToQuery(execute.mock.calls[1]?.[0]);
    expect(query.params).toContain(true);
    expect(query.params).toContain("admin_123");
  });

  it("updates owner metadata and replaces its images", async () => {
    const deleted: string[] = [];
    const execute = vi.fn(async (query) => ({
      rows: new PgDialect().sqlToQuery(query).sql.includes("update resources")
        ? [{ id: 1000 }]
        : [],
    }));
    const storage: UploadStorage = {
      assertErasureReady: vi.fn(),
      createArchiveTarget: vi.fn(),
      createFileTarget: vi.fn(),
      /**
       * Records an object deleted by the storage double.
       *
       * @param objectPath - Stored object path to capture.
       * @returns Fixed deletion result from the double.
       */
      async delete(objectPath) {
        deleted.push(objectPath);
        return "deleted";
      },
      /**
       * Creates a deterministic image target for update assertions.
       *
       * @param input - Image metadata supplied by the service.
       * @returns Input metadata with fixed storage location fields.
       */
      createImageTarget(input) {
        return {
          ...input,
          objectPath: "dev/new-preview.webp",
          size: input.size,
          url: "https://cdn.example.test/dev/new-preview.webp",
        };
      },
      erase: vi.fn(),
      putFile: vi.fn(),
      putImage: vi.fn(),
      readFile: vi.fn(),
    };
    const select = vi
      .fn()
      .mockReturnValueOnce({
        /**
         * Starts the next stage of the select-query stub.
         *
         * @returns Next select-query stage.
         */
        from: () => ({
          /**
           * Applies the configured filter to the select-query stub.
           *
           * @returns Query stage that limits the editable-resource rows.
           */
          where: () => ({
            /**
             * Resolves the configured limited query rows.
             *
             * @returns Configured query rows.
             */
            limit: async () => [{ id: 1000 }],
          }),
        }),
      })
      .mockReturnValueOnce({
        /**
         * Starts the next stage of the select-query stub.
         *
         * @returns Next select-query stage.
         */
        from: () => ({
          /**
           * Applies the configured filter to the select-query stub.
           *
           * @returns Configured retained-image rows.
           */
          where: async () => [{ id: 1000, objectPath: "dev/old-preview.webp" }],
        }),
      });
    const db = {
      execute,
      select,
      /**
       * Runs work against the transaction double.
       *
       * @param fn - Work to run with the transaction double.
       * @returns Result produced by the transaction callback.
       * @rejects When the transaction callback rejects.
       */
      transaction: async (fn: (tx: unknown) => unknown) =>
        fn({ execute, select }),
    } as unknown as Database;
    const service = createResourcesService(
      db,
      storage,
      createNoopLogger({ app: "web", environment: "test" }),
    );

    await expect(
      service.update({
        actor: actor("user_123"),
        categories: ["3D printing"],
        description: "Updated description.",
        images: [
          {
            bytes: new Uint8Array([1]),
            contentType: "image/webp",
            fileName: "preview.webp",
          },
        ],
        name: "Updated clip",
        retainedImageIds: [],
        resourceId: 1000,
      }),
    ).resolves.toEqual({ id: 1000 });
    expect(deleted).toEqual([]);
    const queries = execute.mock.calls.map(([query]) =>
      new PgDialect().sqlToQuery(query),
    );
    expect(
      queries.some(
        (query) =>
          query.sql.includes("insert into storage_object_deletion") &&
          query.params.includes("dev/old-preview.webp"),
      ),
    ).toBe(true);
    const query = queries.find((query) =>
      query.sql.includes("update resources"),
    );
    expect(query?.sql).toContain("update resources");
    expect(query?.sql).toContain("on conflict do nothing");
  });

  it("records owner and admin soft deletions without changing visibility", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ deletedByRole: "owner" }] })
      .mockResolvedValueOnce({ rows: [{ deletedByRole: "admin" }] })
      .mockResolvedValueOnce({ rows: [] });
    const service = createResourcesService(
      { execute } as unknown as Database,
      {} as UploadStorage,
      createNoopLogger({ app: "web", environment: "test" }),
    );

    await expect(
      service.softDelete({
        actor: actor("user_owner"),
        resourceId: 1000,
      }),
    ).resolves.toEqual({ deletedByRole: "owner" });
    await expect(
      service.softDelete({
        actor: actor("admin_123", "admin"),
        resourceId: 1001,
      }),
    ).resolves.toEqual({ deletedByRole: "admin" });
    await expect(
      service.softDelete({
        actor: actor("user_other"),
        resourceId: 1001,
      }),
    ).rejects.toThrow("Resource deletion is not allowed.");

    const query = new PgDialect().sqlToQuery(execute.mock.calls[0]?.[0]);
    expect(query.sql).toContain("deleted_at = now()");
    expect(query.sql).toContain("when uploader_clerk_id = $2 then 'owner'");
    expect(query.sql).not.toContain("is_private =");
  });

  it("queues every resource object in the purge transaction without deleting Bunny objects", async () => {
    const execute = vi.fn(async (query) => {
      const text = new PgDialect().sqlToQuery(query).sql;
      if (text.includes("stored_objects.object_path"))
        return {
          rows: [
            { objectPath: "resources/dev/1000/image.webp" },
            { objectPath: "resources/dev/1000/model.stl" },
            { objectPath: "resources/dev/1000/legacy.zip" },
            {
              objectPath:
                "resources/dev/1000/archives/candidate/resource-1000-v1.zip",
            },
          ],
        };
      return { rows: [{ id: 1000 }] };
    });
    const transaction = vi.fn(async (fn: (tx: unknown) => unknown) =>
      fn({ execute }),
    );
    const remove = vi.fn();
    const service = createResourcesService(
      { transaction } as unknown as Database,
      { delete: remove } as unknown as UploadStorage,
      createNoopLogger(),
    );
    await service.permanentlyDelete({
      actor: actor("admin", "system_admin"),
      reason: "Expired retention period",
      resourceId: 1000,
    });
    expect(transaction).toHaveBeenCalledOnce();
    expect(remove).not.toHaveBeenCalled();
    const queries = execute.mock.calls.map(([query]) =>
      new PgDialect().sqlToQuery(query),
    );
    expect(
      queries
        .filter((query) =>
          query.sql.includes("insert into storage_object_deletion"),
        )
        .flatMap((query) => query.params),
    ).toEqual([
      "resources/dev/1000/archives/candidate/resource-1000-v1.zip",
      "resources/dev/1000/image.webp",
      "resources/dev/1000/legacy.zip",
      "resources/dev/1000/model.stl",
    ]);
    expect(queries.at(-1)?.sql).toContain("delete from resources");
  });

  it("requires an admin and a soft-deleted resource before queuing deletion", async () => {
    const execute = vi.fn(async () => ({ rows: [] }));
    const transaction = vi.fn(async (fn: (tx: unknown) => unknown) =>
      fn({ execute }),
    );
    const remove = vi.fn();
    const service = createResourcesService(
      { transaction } as unknown as Database,
      { delete: remove } as unknown as UploadStorage,
      createNoopLogger(),
    );
    await expect(
      service.permanentlyDelete({
        actor: actor("owner"),
        reason: "Expired retention period",
        resourceId: 1000,
      }),
    ).rejects.toThrow("requires an admin");
    expect(transaction).not.toHaveBeenCalled();
    await expect(
      service.permanentlyDelete({
        actor: actor("admin", "system_admin"),
        reason: "Expired retention period",
        resourceId: 1000,
      }),
    ).rejects.toThrow("must be soft-deleted");
    expect(remove).not.toHaveBeenCalled();
  });

  it("logs purge failures without SQL payloads or admin identifiers", async () => {
    const events: LogEvent[] = [];
    const logger = captureLogger(events);
    const failure = new Error(
      "query parameters: admin_private private-filename.pdf",
    );
    const transaction = vi.fn(async () => {
      throw failure;
    });
    const service = createResourcesService(
      { transaction } as unknown as Database,
      { delete: vi.fn() } as unknown as UploadStorage,
      logger,
    );
    await expect(
      service.permanentlyDelete({
        actor: actor("admin_private", "system_admin"),
        reason: "Expired retention period",
        resourceId: 1000,
      }),
    ).rejects.toBe(failure);
    await logger.flush();
    expect(events).toHaveLength(1);
    expect(events[0]?.message).toBe(
      `${loggerMessages.resources.permanentlyDelete}.failed`,
    );
    expect(events[0]?.attributes?.actorClerkIdHash).toBe(
      hashLogIdentifier("admin_private"),
    );
    expect(JSON.stringify(events)).not.toContain("admin_private");
    expect(JSON.stringify(events)).not.toContain("private-filename.pdf");
  });

  it("lets owners restore only their own owner deletion and admins restore any", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ id: 1000 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 1001 }] });
    const service = createResourcesService(
      { execute } as unknown as Database,
      {} as UploadStorage,
      createNoopLogger({ app: "web", environment: "test" }),
    );

    await expect(
      service.restore({
        actor: actor("user_owner"),
        resourceId: 1000,
      }),
    ).resolves.toBeUndefined();
    await expect(
      service.restore({
        actor: actor("user_other"),
        resourceId: 1001,
      }),
    ).rejects.toThrow("Resource restoration is not allowed.");
    await expect(
      service.restore({
        actor: actor("admin_123", "admin"),
        resourceId: 1001,
      }),
    ).resolves.toBeUndefined();

    const query = new PgDialect().sqlToQuery(execute.mock.calls[0]?.[0]);
    expect(query.sql).toContain("deleted_by_role = 'owner'");
    expect(query.sql).not.toContain("is_private =");
  });

  it("lists only personally restorable deletions in the owner trash", async () => {
    const deletedAt = new Date("2026-09-18T12:00:00Z");
    const item = {
      deletedAt,
      deletedByUsername: "owner",
      deletedByRole: "owner" as const,
      id: 1000,
      isPrivate: true,
      name: "Pocket clip",
      uploaderUsername: "owner",
    };
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ rows: [item] })
      .mockResolvedValueOnce({ rows: [item] });
    const service = createResourcesService(
      { execute } as unknown as Database,
      {} as UploadStorage,
      createNoopLogger({ app: "web", environment: "test" }),
    );

    await expect(service.listOwnerTrash("user_owner")).resolves.toEqual([item]);
    await expect(service.listAdminTrash()).resolves.toEqual([item]);

    const ownerQuery = new PgDialect().sqlToQuery(execute.mock.calls[0]?.[0]);
    expect(ownerQuery.sql).toContain("where resources.deleted_at is not null");
    expect(ownerQuery.sql).toContain("resources.deleted_by_role = 'owner'");
    expect(ownerQuery.params).toEqual(["user_owner", "user_owner"]);
    const adminQuery = new PgDialect().sqlToQuery(execute.mock.calls[1]?.[0]);
    expect(adminQuery.params).toEqual([]);
  });
});
