import type { Database } from "@package/database";
import type { ResourceStorage } from "@package/storage";
import { describe, expect, it, vi } from "vitest";
import {
  CatalogImageUploadError,
  createCatalogImageUploadSessionsService,
} from "./catalog-image-upload-sessions.js";

describe("collection cover uploads", () => {
  it("rejects a duplicate image within the same collection", async () => {
    const db = databaseMock([
      [{ ownerClerkId: "owner" }],
      [
        {
          deletedAt: null,
          deletedByRole: null,
          id: 41,
          sha256: "a".repeat(64),
        },
      ],
    ]);
    const service = createCatalogImageUploadSessionsService({
      db: db.value,
      storage: storageMock(),
    });

    await expect(
      service.create(
        {
          files: [
            {
              contentType: "image/webp",
              fileName: "cover.webp",
              sha256: "a".repeat(64),
              size: 3,
            },
          ],
          targetId: 1000,
          targetType: "collection",
        },
        { clerkId: "owner", isAdmin: false },
      ),
    ).rejects.toEqual(
      new CatalogImageUploadError("duplicate_active", 409, 41, "a".repeat(64)),
    );
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("selects a previous cover and clears the current cover atomically", async () => {
    const db = databaseMock([[{ ownerClerkId: "owner" }], [{ id: 42 }]]);
    const service = createCatalogImageUploadSessionsService({
      db: db.value,
      storage: storageMock(),
    });

    await service.selectCollectionCover(1000, 42, {
      clerkId: "owner",
      isAdmin: false,
    });

    expect(db.transaction).toHaveBeenCalledOnce();
    expect(db.updates.map(({ value }) => value)).toEqual([
      { isCurrent: false },
      { isCurrent: true },
      expect.objectContaining({ updatedAt: expect.any(Date) }),
    ]);
  });

  it("hard-deletes only a previous cover", async () => {
    const db = databaseMock([
      [{ ownerClerkId: "owner" }],
      [{ isCurrent: false, objectPath: "collections/1000/old.webp" }],
    ]);
    const storage = storageMock();
    const service = createCatalogImageUploadSessionsService({
      db: db.value,
      storage,
    });

    await service.deleteCollectionCover(1000, 42, {
      clerkId: "owner",
      isAdmin: false,
    });

    expect(storage.delete).toHaveBeenCalledWith("collections/1000/old.webp");
    expect(db.deleteRow).toHaveBeenCalledOnce();
  });

  it("does not delete the current cover", async () => {
    const db = databaseMock([
      [{ ownerClerkId: "owner" }],
      [{ isCurrent: true, objectPath: "collections/1000/current.webp" }],
    ]);
    const storage = storageMock();
    const service = createCatalogImageUploadSessionsService({
      db: db.value,
      storage,
    });

    await expect(
      service.deleteCollectionCover(1000, 42, {
        clerkId: "owner",
        isAdmin: false,
      }),
    ).rejects.toEqual(new CatalogImageUploadError("invalid_request", 400));
    expect(storage.delete).not.toHaveBeenCalled();
    expect(db.deleteRow).not.toHaveBeenCalled();
  });
});

function databaseMock(selectRows: unknown[][]) {
  const updates: Array<{ table: unknown; value: unknown }> = [];
  const select = vi.fn(() => chain(selectRows.shift() ?? []));
  const insert = vi.fn();
  const deleteRow = vi.fn(async () => undefined);
  const update = vi.fn((table: unknown) => ({
    set: vi.fn((value: unknown) => {
      updates.push({ table, value });
      return { where: vi.fn(async () => undefined) };
    }),
  }));
  const transaction = vi.fn(async (callback: (tx: unknown) => unknown) =>
    callback({ update }),
  );
  return {
    deleteRow,
    insert,
    transaction,
    updates,
    value: {
      delete: vi.fn(() => ({ where: deleteRow })),
      insert,
      select,
      transaction,
      update,
    } as unknown as Database,
  };
}

function chain(rows: unknown[]) {
  const terminal = Object.assign(Promise.resolve(rows), {
    limit: async () => rows,
  });
  const query = {
    from: () => query,
    innerJoin: () => query,
    limit: async () => rows,
    where: () => terminal,
  };
  return query;
}

function storageMock() {
  return {
    createCatalogImageUploadTarget: vi.fn(),
    createUploadTarget: vi.fn(),
    delete: vi.fn(async () => "deleted" as const),
    upload: vi.fn(),
    uploadImage: vi.fn(),
    uploadStream: vi.fn(),
  } satisfies ResourceStorage;
}
