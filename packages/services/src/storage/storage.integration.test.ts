import type { Database } from "@package/database";
import { schema } from "@package/database";
import {
  createLogger,
  createNoopLogger,
  type LogEvent,
  loggerMessages,
} from "@package/logger";
import { createUploadStorage, sha256 } from "@package/storage";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createResourcesService } from "../resources/index.js";
import { selectCollectionCover } from "./image-records.js";
import { createStorageService } from "./index.js";

const url = process.env.STORAGE_TEST_DATABASE_URL;
describe.skipIf(!url)("storage sessions against PostgreSQL", () => {
  const pool = new pg.Pool({ connectionString: url });
  const db = drizzle(pool, { schema }) as unknown as Database;
  const objects = new Map<string, Uint8Array>();
  let failDelete = false;
  const storage = createUploadStorage({
    accessKey: "key",
    endpoint: "https://storage.test",
    zoneName: "zone",
    cdnBaseUrl: "https://cdn.test",
    folderPrefix: "resources/dev",
    imageFolderPrefix: "images/dev",
    fetch: async (input, init) => {
      const path = decodeURIComponent(new URL(String(input)).pathname).replace(
        /^\/zone\//u,
        "",
      );
      if (init?.method === "DELETE") {
        if (failDelete) throw new Error("Bunny unavailable");
        objects.delete(path);
        return new Response(null, { status: 200 });
      }
      objects.set(
        path,
        new Uint8Array(await new Response(init?.body).arrayBuffer()),
      );
      return new Response(null, { status: 201 });
    },
  });
  const events: LogEvent[] = [];
  const logger = createLogger({
    app: "api",
    environment: "test",
    transports: [
      {
        log(event) {
          events.push(event);
        },
      },
    ],
  });
  const service = createStorageService({ db, storage, logger });
  const actor = { clerkId: "storage-test-owner", isAdmin: false };
  const image = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aB9sAAAAASUVORK5CYII=",
    "base64",
  );
  const pdf = new TextEncoder().encode("%PDF-1.7 test");
  let productId: number, collectionId: number, itemId: number;
  beforeAll(async () => {
    const user = await pool.query(
      "insert into users(clerk_id) values($1) returning id",
      [actor.clerkId],
    );
    const collection = await pool.query(
      "insert into user_collection(owner_id,name,normalized_name) values($1,'Test collection','test collection') returning id",
      [user.rows[0].id],
    );
    collectionId = Number(collection.rows[0].id);
    const item = await pool.query(
      "insert into collection_item(owner_id,collection_id) values($1,$2) returning id",
      [user.rows[0].id, collectionId],
    );
    itemId = Number(item.rows[0].id);
    const maker = await pool.query(
      "insert into makers(name) values('Storage test maker') returning id",
    );
    const type = await pool.query(
      "insert into product_types(name,slug) values('Storage test type','storage-test-type') returning id",
    );
    const product = await pool.query(
      "insert into product(product_type_id,maker_id,name,slug,owner_clerk_id) values($1,$2,'Storage test product','storage-test-product',$3) returning id",
      [type.rows[0].id, maker.rows[0].id, actor.clerkId],
    );
    productId = Number(product.rows[0].id);
  });
  afterAll(async () => {
    await pool.end();
  });
  async function manifest(
    bytes: Uint8Array,
    kind: "image" | "file",
    name: string,
    type: string,
  ) {
    return {
      kind,
      fileName: name,
      contentType: type,
      size: bytes.length,
      sha256: await sha256(bytes),
    };
  }
  async function put(
    session: {
      id: string;
      uploads: Array<{ id: string; fileName: string; contentType: string }>;
    },
    bytes: Record<string, Uint8Array>,
  ) {
    for (const file of session.uploads) {
      const body = bytes[file.fileName];
      if (!body) throw new Error("Missing test body");
      await service.upload(
        session.id,
        file.id,
        actor,
        new Request("https://api.test/upload", {
          method: "PUT",
          body: new Uint8Array(body),
          headers: {
            "content-type": file.contentType,
            "content-length": String(body.length),
          },
        }),
      );
    }
  }
  it("creates no draft, completes atomically, reserves versions and retains original image bytes", async () => {
    const files = [
      await manifest(pdf, "file", "design.pdf", "application/pdf"),
      await manifest(image, "image", "cover.png", "image/png"),
    ];
    const session = await service.create(
      {
        target: { type: "resource" },
        payload: {
          operation: "create",
          name: "Resource test",
          description: "Test resource",
          categories: ["Tools"],
          isPrivate: true,
        },
        files,
      },
      actor,
    );
    expect(
      (await pool.query("select id from resources where name='Resource test'"))
        .rowCount,
    ).toBe(0);
    await expect(
      service.completeUpload(session.id, actor),
    ).rejects.toMatchObject({ code: "uploads_incomplete" });
    await put(session, { "design.pdf": pdf, "cover.png": image });
    const result = await service.completeUpload(session.id, actor);
    expect(result).toMatchObject({ version: 1 });
    await expect(service.completeUpload(session.id, actor)).resolves.toEqual(
      result,
    );
    if (!("resourceId" in result)) throw new Error("Expected resource");
    const rows = await pool.query(
      "select f.object_path from resource_files f join resource_versions v on v.id=f.version_id where v.resource_id=$1",
      [result.resourceId],
    );
    expect(rows.rows[0].object_path).toBe(
      `resources/dev/${result.resourceId}/v1/${await sha256(pdf)}.pdf`,
    );
    expect(
      objects.get(
        `images/dev/resources/${result.resourceId}/${await sha256(image)}.png`,
      ),
    ).toEqual(new Uint8Array(image));
    expect(
      (
        await pool.query(
          "select type from resource_notifications where resource_id=$1",
          [result.resourceId],
        )
      ).rows
        .map((row) => row.type)
        .sort(),
    ).toEqual(["category_created", "resource_created"]);
    const version = await service.create(
      {
        target: { type: "resource", id: result.resourceId },
        payload: { operation: "version" },
        files: [files[0]],
      },
      actor,
    );
    await expect(
      service.create(
        {
          target: { type: "resource", id: result.resourceId },
          payload: { operation: "version" },
          files: [files[0]],
        },
        actor,
      ),
    ).rejects.toMatchObject({ code: "upload_in_progress" });
    await put(version, { "design.pdf": pdf });
    await expect(service.completeUpload(version.id, actor)).resolves.toEqual({
      resourceId: result.resourceId,
      version: 2,
    });
    expect(
      objects.has(
        `resources/dev/${result.resourceId}/v2/${await sha256(pdf)}.pdf`,
      ),
    ).toBe(true);
    const cover = await pool.query(
      "select id from resource_images where resource_id=$1",
      [result.resourceId],
    );
    await expect(
      service.deleteFile({
        fileType: "resource_image",
        fileId: Number(cover.rows[0].id),
        actor,
      }),
    ).rejects.toMatchObject({ code: "invalid_request" });
    const download = await pool.query(
      "select f.id from resource_files f join resource_versions v on v.id=f.version_id where v.resource_id=$1 limit 1",
      [result.resourceId],
    );
    await expect(
      service.deleteFile({
        fileType: "resource_file",
        fileId: Number(download.rows[0].id),
        actor,
      }),
    ).rejects.toMatchObject({ code: "invalid_request" });
  });
  it("uses all three image targets, rejects duplicate/unauthorized sessions, and protects the collection cover", async () => {
    const file = await manifest(image, "image", "photo.png", "image/png");
    for (const target of [
      { type: "product", id: productId },
      { type: "collection", id: collectionId },
      { type: "collection_item", id: itemId },
    ] as const) {
      await expect(
        service.create(
          { target, files: [file] },
          { clerkId: "stranger", isAdmin: false },
        ),
      ).rejects.toMatchObject({ code: "session_not_found" });
      const results = await Promise.allSettled([
        service.create({ target, files: [file] }, actor),
        service.create({ target, files: [file] }, actor),
      ]);
      expect(
        results.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(1);
      const winner = results.find((result) => result.status === "fulfilled");
      if (!winner || winner.status !== "fulfilled")
        throw new Error("No winning session");
      await put(winner.value, { "photo.png": image });
      await service.completeUpload(winner.value.id, actor);
      await expect(
        service.create({ target, files: [file] }, actor),
      ).rejects.toMatchObject({ code: "duplicate_active" });
    }
    const cover = await pool.query(
      "select id from collection_image where collection_id=$1",
      [collectionId],
    );
    const id = Number(cover.rows[0].id);
    await expect(
      service.deleteFile({ fileType: "collection_image", fileId: id, actor }),
    ).rejects.toMatchObject({ code: "invalid_request" });
    await db.transaction((tx) =>
      selectCollectionCover(tx, { collectionId, imageId: null, actor }),
    );
    await service.deleteFile({
      fileType: "collection_image",
      fileId: id,
      actor,
    });
    expect(
      (await pool.query("select id from collection_image where id=$1", [id]))
        .rowCount,
    ).toBe(0);
  });
  it("keeps attached objects during expiry cleanup and rejects incorrect file hashes", async () => {
    const bytes = new Uint8Array([...image, 0]);
    const file = await manifest(bytes, "image", "pending.png", "image/png");
    const session = await service.create(
      { target: { type: "product", id: productId }, files: [file] },
      actor,
    );
    await expect(
      service.upload(
        session.id,
        session.uploads[0]!.id,
        actor,
        new Request("https://api.test/upload", {
          method: "PUT",
          body: new Uint8Array(bytes.length),
          headers: {
            "content-type": "image/png",
            "content-length": String(bytes.length),
          },
        }),
      ),
    ).rejects.toMatchObject({ code: "hash_mismatch" });
    const existing = `images/dev/products/${productId}/${await sha256(image)}.png`;
    await pool.query(
      "update upload_file set object_path=$1 where session_id=$2",
      [existing, session.id],
    );
    await pool.query(
      "update upload_session set expires_at=now()-interval '1 hour' where id=$1",
      [session.id],
    );
    await expect(service.cleanupExpired()).resolves.toBe(1);
    expect(objects.has(existing)).toBe(true);
  });
  it("routes buffered callers through reserved sessions and protects existing images during edits", async () => {
    const resources = createResourcesService(
      db,
      storage,
      createNoopLogger({ app: "web", environment: "test" }),
    );
    const created = await resources.create({
      name: "Buffered resource",
      description: "Buffered test",
      categories: ["Tools"],
      uploaderClerkId: actor.clerkId,
      files: [
        {
          bytes: pdf,
          fileName: "buffered.pdf",
          contentType: "application/pdf",
        },
      ],
      images: [
        { bytes: image, fileName: "cover.png", contentType: "image/png" },
      ],
    });
    const version = await resources.addVersion({
      resourceId: created.id,
      uploaderClerkId: actor.clerkId,
      files: [
        {
          bytes: pdf,
          fileName: "buffered.pdf",
          contentType: "application/pdf",
        },
      ],
    });
    expect(version.version).toBe(2);
    const cover = await pool.query(
      "select id,object_path,position from resource_images where resource_id=$1",
      [created.id],
    );
    expect(cover.rows[0].position).toBe(0);
    const update = {
      resourceId: created.id,
      actorClerkId: actor.clerkId,
      actorIsAdmin: false,
      name: "Updated resource",
      description: "Updated",
      categories: ["Tools"],
      retainedImageIds: [],
      images: [
        { bytes: image, fileName: "same.png", contentType: "image/png" },
      ],
    };
    await expect(resources.update(update)).rejects.toThrow("already attached");
    expect(objects.has(cover.rows[0].object_path)).toBe(true);
    await expect(
      resources.update({
        ...update,
        images: [],
        retainedImageIds: [Number(cover.rows[0].id)],
      }),
    ).resolves.toEqual({ id: created.id });
  });
  it("retains reservations when expiry deletion fails and releases them after retry", async () => {
    const bytes = new Uint8Array([...image, 1]);
    const file = await manifest(bytes, "image", "retry.png", "image/png");
    const value = { target: { type: "product", id: productId }, files: [file] };
    const session = await service.create(value, actor);
    await put(session, { "retry.png": bytes });
    await pool.query(
      "update upload_session set expires_at=now()-interval '1 hour' where id=$1",
      [session.id],
    );
    failDelete = true;
    try {
      expect(await service.cleanupExpired()).toBe(0);
    } finally {
      failDelete = false;
    }
    await expect(service.create(value, actor)).rejects.toMatchObject({
      code: "duplicate_active",
    });
    expect(await service.cleanupExpired()).toBe(1);
    expect(
      objects.has(
        `images/dev/products/${productId}/${await sha256(bytes)}.png`,
      ),
    ).toBe(false);
    await expect(service.create(value, actor)).resolves.toHaveProperty("id");
  });
  it("rolls back logical deletion without losing the object, reserves queued paths, and retries Bunny failures", async () => {
    const bytes = new Uint8Array([...image, 21]);
    const file = await manifest(
      bytes,
      "image",
      "private-file.png",
      "image/png",
    );
    const value = { target: { type: "product", id: productId }, files: [file] };
    const session = await service.create(value, actor);
    await put(session, { "private-file.png": bytes });
    await service.completeUpload(session.id, actor);
    const row = (
      await pool.query(
        "select id,object_path from product_image where product_id=$1 and sha256=$2",
        [productId, file.sha256],
      )
    ).rows[0];
    await pool.query(
      `create function reject_test_delete() returns trigger language plpgsql as $$ begin raise exception 'secret SQL payload private-file.png'; end $$`,
    );
    await pool.query(
      `create constraint trigger reject_test_delete after delete on product_image deferrable initially deferred for each row execute function reject_test_delete()`,
    );
    try {
      await expect(
        service.deleteFile({
          fileType: "product_image",
          fileId: Number(row.id),
          actor,
        }),
      ).rejects.toThrow();
      expect(
        (await pool.query("select id from product_image where id=$1", [row.id]))
          .rowCount,
      ).toBe(1);
      expect(
        (
          await pool.query(
            "select 1 from storage_object_deletion where object_path=$1",
            [row.object_path],
          )
        ).rowCount,
      ).toBe(0);
      expect(objects.has(row.object_path)).toBe(true);
    } finally {
      await pool.query("drop trigger reject_test_delete on product_image");
      await pool.query("drop function reject_test_delete()");
    }
    failDelete = true;
    try {
      await service.deleteFile({
        fileType: "product_image",
        fileId: Number(row.id),
        actor,
      });
    } finally {
      failDelete = false;
    }
    expect(
      (await pool.query("select id from product_image where id=$1", [row.id]))
        .rowCount,
    ).toBe(0);
    expect(objects.has(row.object_path)).toBe(true);
    await expect(service.create(value, actor)).rejects.toMatchObject({
      code: "upload_in_progress",
    });
    failDelete = true;
    try {
      await service.cleanupExpired();
    } finally {
      failDelete = false;
    }
    expect(objects.has(row.object_path)).toBe(true);
    expect(
      (
        await pool.query(
          "select 1 from storage_object_deletion where object_path=$1",
          [row.object_path],
        )
      ).rowCount,
    ).toBe(1);
    await Promise.all([service.cleanupExpired(), service.cleanupExpired()]);
    expect(objects.has(row.object_path)).toBe(false);
    const retry = await service.create(value, actor);
    await put(retry, { "private-file.png": bytes });
    await service.completeUpload(retry.id, actor);
    await service.cleanupExpired();
    expect(objects.has(row.object_path)).toBe(true);

    await logger.flush();
    expect(
      events.some(
        (event) =>
          event.message === loggerMessages.database.storage.deletionRetry,
      ),
    ).toBe(true);
    expect(
      events.some(
        (event) =>
          event.message === loggerMessages.database.storage.cleanupRetry,
      ),
    ).toBe(true);
    expect(
      events.some(
        (event) =>
          event.message === `${loggerMessages.database.storage.upload}.failed`,
      ),
    ).toBe(true);
    const completionEvents = events.filter(
      (event) =>
        event.message ===
        `${loggerMessages.database.storage.completeUpload}.succeeded`,
    );
    expect(completionEvents.length).toBeGreaterThan(0);
    const serialized = JSON.stringify(events);
    for (const secret of [
      actor.clerkId,
      session.id,
      "secret SQL payload",
      "private-file.png",
      "Bunny unavailable",
      "https://cdn.test",
    ])
      expect(serialized).not.toContain(secret);
  });

  it("queues resource replacements and purges while protecting attached paths", async () => {
    const resources = createResourcesService(db, storage, logger);
    const created = await resources.create({
      name: "Deletion test",
      description: "Test",
      categories: ["Tools"],
      uploaderClerkId: actor.clerkId,
      files: [
        { bytes: pdf, fileName: "model.pdf", contentType: "application/pdf" },
      ],
      images: [
        { bytes: image, fileName: "cover.png", contentType: "image/png" },
      ],
    });
    const old = (
      await pool.query(
        "select object_path from resource_images where resource_id=$1",
        [created.id],
      )
    ).rows[0].object_path;
    const replacement = new Uint8Array([...image, 22]);
    const update = {
      resourceId: created.id,
      actorClerkId: actor.clerkId,
      actorIsAdmin: false,
      name: "Updated",
      description: "Updated",
      categories: ["Tools"],
      retainedImageIds: [],
      images: [
        {
          bytes: replacement,
          fileName: "replacement.png",
          contentType: "image/png",
        },
      ],
    };
    failDelete = true;
    try {
      await resources.update(update);
    } finally {
      failDelete = false;
    }
    expect(objects.has(old)).toBe(true);
    await expect(
      resources.update({
        ...update,
        images: [
          { bytes: image, fileName: "old.png", contentType: "image/png" },
        ],
      }),
    ).rejects.toMatchObject({ code: "upload_in_progress" });
    await service.cleanupExpired();
    expect(objects.has(old)).toBe(false);
    const attached = (
      await pool.query(
        "select object_path from resource_images where resource_id=$1",
        [created.id],
      )
    ).rows[0].object_path;
    await pool.query(
      "insert into storage_object_deletion(object_path) values($1)",
      [attached],
    );
    await service.cleanupExpired();
    expect(objects.has(attached)).toBe(true);
    await resources.softDelete({
      resourceId: created.id,
      actorClerkId: actor.clerkId,
      actorIsAdmin: false,
    });
    failDelete = true;
    try {
      await resources.permanentlyDelete({
        resourceId: created.id,
        actorClerkId: "admin",
        actorIsAdmin: true,
      });
    } finally {
      failDelete = false;
    }
    expect(
      (await pool.query("select id from resources where id=$1", [created.id]))
        .rowCount,
    ).toBe(0);
    expect(objects.has(attached)).toBe(true);
    failDelete = true;
    try {
      await service.cleanupExpired();
    } finally {
      failDelete = false;
    }
    expect(objects.has(attached)).toBe(true);
    await service.cleanupExpired();
    expect(objects.has(attached)).toBe(false);
  });
});
