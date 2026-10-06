import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import type { Database } from "@package/database";
import { schema } from "@package/database";
import { createNoopLogger } from "@package/logger";
import { createUploadStorage } from "@package/storage";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { describe, expect, it, vi } from "vitest";
import { createErasureService } from "../db/erasure/index.js";
import { createStorageService } from "./index.js";

describe("account storage erasure", () => {
  it("retries exact keys, preserves shared and product objects, and clears its snapshot", async () => {
    const client = new PGlite();
    await migrate(client);
    const db = drizzle(client, { schema }) as unknown as Database;
    const logger = createNoopLogger({ app: "api", environment: "test" });
    const storage = createUploadStorage({
      accessKey: "storage-key",
      cdnBaseUrl: "https://cdn.test",
      endpoint: "https://storage.test",
      folderPrefix: "resources/dev",
      imageFolderPrefix: "images/dev",
      zoneName: "zone",
    });
    vi.spyOn(storage, "assertErasureReady").mockResolvedValue();
    const erase = vi
      .spyOn(storage, "erase")
      .mockRejectedValueOnce(new Error("Bunny unavailable"))
      .mockResolvedValue();
    const service = createStorageService({ db, logger, storage });

    try {
      const target = "erase_target";
      const survivor = "surviving_owner";
      const paths = await fixtures(client, target, survivor);
      const request = await createErasureService(db, logger).create({
        actor: { clerkId: target, role: "user" },
        initiator: "self",
        subjectHmac: "a".repeat(64),
        targetClerkId: target,
        verificationMethod: "clerk_reverification",
        verifiedAt: new Date(),
      });

      await service.snapshotErasureTargets(request.id, target);
      const [captured] = await db
        .select({ targets: schema.erasureRequest.storageTargets })
        .from(schema.erasureRequest)
        .where(eq(schema.erasureRequest.id, request.id));
      expect(captured?.targets).toEqual(
        expect.arrayContaining([
          paths.collection,
          paths.archive,
          paths.item,
          paths.legacy,
          paths.queue,
          paths.resourceFile,
          paths.resourceImage,
          paths.shared,
          paths.upload,
        ]),
      );
      expect(captured?.targets).not.toContain(paths.product);
      expect(captured?.targets).not.toContain(paths.material);

      await expect(
        service.eraseAccountObjects(request.id, target),
      ).rejects.toThrow("Bunny unavailable");
      expect(
        (
          await db
            .select({ targets: schema.erasureRequest.storageTargets })
            .from(schema.erasureRequest)
            .where(eq(schema.erasureRequest.id, request.id))
        )[0]?.targets,
      ).toEqual(captured?.targets);

      const result = await service.eraseAccountObjects(request.id, target);
      expect(result.exceptions.map(({ code }) => code)).toEqual([
        "bunny_cache_30_days",
        "bunny_logs_3_days",
      ]);
      expect(erase.mock.calls.flat()).not.toContain(paths.product);
      expect(erase.mock.calls.flat()).not.toContain(paths.material);
      expect(erase.mock.calls.flat()).not.toContain(paths.shared);
      expect(new Set(erase.mock.calls.flat())).toEqual(
        new Set([
          paths.collection,
          paths.archive,
          paths.item,
          paths.legacy,
          paths.queue,
          paths.resourceFile,
          paths.resourceImage,
          paths.upload,
        ]),
      );
      expect(
        (
          await db
            .select({ targets: schema.erasureRequest.storageTargets })
            .from(schema.erasureRequest)
            .where(eq(schema.erasureRequest.id, request.id))
        )[0]?.targets,
      ).toEqual([]);
    } finally {
      await client.close();
    }
  }, 30_000);
});

/**
 * Inserts storage ownership fixtures for account-erasure integration tests.
 *
 * @param client - In-memory PostgreSQL client.
 * @param target - Clerk identifier whose objects should be erased.
 * @param survivor - Clerk identifier that retains a shared object.
 * @returns Named object paths used by the assertions.
 * @rejects When fixture insertion fails.
 */
async function fixtures(client: PGlite, target: string, survivor: string) {
  const paths = {
    archive: "resources/dev/1000/v1/archive.zip",
    collection: "images/dev/collections/1000/collection.png",
    item: "images/dev/collection-items/1000/item.png",
    legacy: "resources/dev/1000/v1/legacy.zip",
    material: "images/dev/materials/1000/material.png",
    product: "images/dev/products/1000/product.png",
    queue: "resources/dev/1000/v1/queued.zip",
    resourceFile: "resources/dev/1000/v1/file.zip",
    resourceImage: "images/dev/resources/1000/resource.png",
    shared: "images/dev/collections/1000/shared.png",
    upload: "resources/dev/1000/v2/upload.zip",
  };
  const hash = "b".repeat(64);
  const users = await client.query<{
    /** Inserted user identifier. */
    id: number;
  }>("insert into users(clerk_id) values($1),($2) returning id", [
    target,
    survivor,
  ]);
  const targetId = rowId(users.rows, 0);
  const collection = await client.query<{
    /** Inserted collection identifier. */
    id: number;
  }>(
    "insert into user_collection(owner_id,name,normalized_name) values($1,'Erase','erase') returning id",
    [targetId],
  );
  const collectionId = rowId(collection.rows);
  const item = await client.query<{
    /** Inserted collection-item identifier. */
    id: number;
  }>(
    "insert into collection_item(owner_id,collection_id) values($1,$2) returning id",
    [targetId, collectionId],
  );
  await client.query(
    `insert into collection_image(collection_id,position,file_name,content_type,size,sha256,object_path,url,uploaded_by_clerk_id)
      values($1,0,'collection.png','image/png',1,$2,$3,$3,$4),
            ($1,1,'shared.png','image/png',1,$5,$6,$6,$4)`,
    [
      collectionId,
      hash,
      paths.collection,
      target,
      "c".repeat(64),
      paths.shared,
    ],
  );
  await client.query(
    `insert into collection_item_image(collection_item_id,position,file_name,content_type,size,sha256,object_path,url,uploaded_by_clerk_id)
      values($1,0,'item.png','image/png',1,$2,$3,$3,$4)`,
    [rowId(item.rows), hash, paths.item, target],
  );
  const resources = await client.query<{
    /** Inserted resource identifier. */
    id: number;
  }>(
    `insert into resources(uploader_clerk_id,name,description)
      values($1,'Erase resource','target'),($2,'Keep resource','survivor') returning id`,
    [target, survivor],
  );
  const targetResourceId = rowId(resources.rows, 0);
  const survivorResourceId = rowId(resources.rows, 1);
  await client.query(
    `insert into resource_images(resource_id,position,file_name,content_type,size,object_path,url)
      values($1,0,'resource.png','image/png',1,$2,$2),
            ($3,0,'shared.png','image/png',1,$4,$4)`,
    [targetResourceId, paths.resourceImage, survivorResourceId, paths.shared],
  );
  const version = await client.query<{
    /** Inserted resource-version identifier. */
    id: number;
  }>(
    `insert into resource_versions(resource_id,version,file_name,content_type,size,object_path,url,archive_object_path)
      values($1,1,'legacy.zip','application/zip',1,$2,$2,$3) returning id`,
    [targetResourceId, paths.legacy, paths.archive],
  );
  await client.query(
    `insert into resource_files(version_id,file_name,content_type,size,object_path,url)
      values($1,'file.zip','application/zip',1,$2,$2)`,
    [rowId(version.rows), paths.resourceFile],
  );
  await client.query(
    `insert into upload_session(id,uploader_clerk_id,target_type,target_id,expires_at)
      values('00000000-0000-4000-8000-000000000001',$1,'resource',$2,now()+interval '1 hour')`,
    [target, targetResourceId],
  );
  await client.query(
    `insert into upload_file(id,session_id,kind,position,file_name,content_type,size,sha256,object_path,url)
      values('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','file',0,'upload.zip','application/zip',1,$1,$2,$2)`,
    [hash, paths.upload],
  );
  await client.query(
    "insert into storage_object_deletion(object_path,owner_clerk_id) values($1,$2)",
    [paths.queue, target],
  );
  const maker = await client.query<{
    /** Inserted maker identifier. */
    id: number;
  }>(
    "insert into makers(name, slug) values('Erasure maker', 'erasure-maker') returning id",
  );
  const type = await client.query<{
    /** Inserted product-type identifier. */
    id: number;
  }>(
    "insert into product_types(name,slug) values('Erasure type','erasure-type') returning id",
  );
  const product = await client.query<{
    /** Inserted product identifier. */
    id: number;
  }>(
    "insert into product(product_type_id,maker_id,owner_clerk_id,name,slug) values($1,$2,$3,'Keep product','keep-product') returning id",
    [rowId(type.rows), rowId(maker.rows), target],
  );
  await client.query(
    `insert into product_image(product_id,position,file_name,content_type,size,sha256,object_path,url,uploaded_by_clerk_id)
      values($1,0,'product.png','image/png',1,$2,$3,$3,$4)`,
    [rowId(product.rows), hash, paths.product, target],
  );
  const material = await client.query<{
    /** Inserted material identifier. */
    id: number;
  }>(
    "insert into materials(name,slug) values('Erasure material','erasure-material') returning id",
  );
  await client.query(
    `insert into material_image(material_id,position,file_name,content_type,size,sha256,object_path,url,uploaded_by_clerk_id)
      values($1,0,'material.png','image/png',1,$2,$3,$3,$4)`,
    [rowId(material.rows), "d".repeat(64), paths.material, target],
  );
  return paths;
}

/**
 * Requires an inserted fixture row and returns its identifier.
 *
 * @param rows - Inserted rows returned by PostgreSQL.
 * @param index - Row position to read.
 * @returns Identifier at the requested position.
 * @throws When the expected fixture row was not created.
 */
function rowId(
  rows: {
    /** Inserted row identifier. */
    id: number;
  }[],
  index = 0,
) {
  const row = rows[index];
  if (!row) throw new Error("Fixture row was not created.");
  return row.id;
}

/**
 * Applies the repository migrations to the in-memory test database.
 *
 * @param client - In-memory PostgreSQL client.
 * @rejects When a migration cannot be applied.
 */
async function migrate(client: PGlite) {
  const migrationsFolder = fileURLToPath(
    new URL("../../../database/drizzle", import.meta.url),
  );
  for (const file of readdirSync(migrationsFolder)
    .filter((name) => name.endsWith(".sql"))
    .sort()) {
    await client.exec(
      readFileSync(join(migrationsFolder, file), "utf8").replaceAll(
        "--> statement-breakpoint",
        "",
      ),
    );
  }
}
