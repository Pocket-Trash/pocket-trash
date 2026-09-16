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
import { createResourcesService } from "./index.js";

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
  it("cleans uploaded objects and logs safely when persistence fails", async () => {
    const events: LogEvent[] = [];
    const logger = captureLogger(events);
    const execute = vi
      .fn()
      .mockRejectedValue(new Error("database unavailable"));
    const deleted: string[] = [];
    const storage: ResourceStorage = {
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
        file: {
          bytes: new Uint8Array([1]),
          contentType: "model/stl",
          fileName: "private-file.stl",
        },
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
      fileNameHash: hashLogIdentifier("private-file.stl"),
      operation: loggerMessages.resources.create,
      outcome: "failure",
      uploaderClerkIdHash: hashLogIdentifier("user_private"),
    });
    expect(JSON.stringify(events)).not.toContain("private-file.stl");
    expect(JSON.stringify(events)).not.toContain("user_private");
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
              where() {
                return {
                  async limit() {
                    calls.push("selected");
                    return [
                      { id: 1001, url: "https://cdn.example.test/file.stl" },
                    ];
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
    const currentVersion = {
      contentType: "model/stl",
      createdAt,
      downloadCount: 2,
      fileName: "clip.stl",
      id: 1001,
      size: 42,
      version: 1,
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
                name: "Pocket clip",
                previewImageUrl: null,
                uploaderClerkId: "user_123",
              },
            ],
          }),
        }),
      })
      .mockReturnValueOnce({
        from: () => ({
          leftJoin: () => ({
            where: () => ({
              groupBy: () => ({
                orderBy: () => ({ limit: async () => [currentVersion] }),
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
          leftJoin: () => ({
            where: async () => [{ downloadCount: 3 }],
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
      name: "Pocket clip",
      previewImageUrl: null,
      uploaderClerkId: "user_123",
    });
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
    expect(query.params).toEqual(["3d-printing"]);
  });
});
