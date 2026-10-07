import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import type { Database } from "@package/database";
import { schema } from "@package/database";
import { createNoopLogger } from "@package/logger";
import { createUploadStorage, type UploadStorage } from "@package/storage";
import { drizzle } from "drizzle-orm/pglite";
import { describe, expect, it } from "vitest";
import {
  cleanupObjectDeletions,
  queueObjectDeletions,
} from "./object-lifecycle.js";

/** Queued storage path returned by lifecycle assertions. */
type QueuedObject = {
  /** Object path retained in the deletion queue. */
  object_path: string;
};

describe("storage object ownership", () => {
  it("never queues or deletes a shared immutable preview image", async () => {
    const client = new PGlite();
    try {
      await migrate(client);
      await seedImages(client);
      const db = drizzle(client, { schema }) as unknown as Database;
      const sharedPath = "images/preview/products/1000/shared.png";
      const copyOnWrite = createUploadStorage({
        accessKey: "key",
        cdnBaseUrl: "https://cdn.example.test",
        endpoint: "https://storage.example.test",
        folderPrefix: "resources/preview/pr-42",
        imageFolderPrefix: "images/preview/pr-42",
        zoneName: "zone",
      }).createImageTarget(
        {
          contentType: "image/png",
          fileName: "owned.png",
          sha256: "b".repeat(64),
          size: 1,
        },
        { entity: "products", entityId: 1001 },
      );
      const ownedPath = copyOnWrite.objectPath;
      await client.query(
        `insert into product_image(
          product_id, position, file_name, content_type, size, sha256,
          object_path, url
        ) values (
          (select id from product where slug = 'owned-product'), 0,
          'owned.png', 'image/png', 1, $1, $2, $3
        )`,
        ["b".repeat(64), copyOnWrite.objectPath, copyOnWrite.url],
      );

      expect(copyOnWrite).toMatchObject({
        objectPath: `images/preview/pr-42/products/1001/${"b".repeat(64)}.png`,
        url: `https://cdn.example.test/images/preview/pr-42/products/1001/${"b".repeat(64)}.png?format=webp&quality=85`,
      });

      await db.transaction(async (tx) => {
        await queueObjectDeletions(tx, [sharedPath, ownedPath]);
      });
      const queued = await client.query<QueuedObject>(
        "select object_path from storage_object_deletion order by object_path",
      );
      expect(queued.rows).toEqual([{ object_path: ownedPath }]);

      await client.exec("delete from product_image");
      const deleted: string[] = [];
      const storage = {
        /**
         * Captures object deletions without external Bunny requests.
         *
         * @param objectPath - Object path selected by lifecycle cleanup.
         * @returns Successful deletion status.
         */
        async delete(objectPath: string) {
          deleted.push(objectPath);
          return "deleted" as const;
        },
      } as UploadStorage;
      await cleanupObjectDeletions(
        db,
        storage,
        createNoopLogger({ app: "test", environment: "test" }),
        [sharedPath, ownedPath],
      );

      expect(deleted).toEqual([ownedPath]);
      expect(deleted).not.toContain(sharedPath);
    } finally {
      await client.close();
    }
  });
});

/**
 * Applies repository migrations to an isolated PostgreSQL-compatible database.
 *
 * @param client - In-memory database receiving migrations.
 * @rejects When migration files cannot be read or applied.
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

/**
 * Creates copy-on-write targets with one shared seed image.
 *
 * @param client - In-memory database receiving lifecycle fixtures.
 * @rejects When fixture persistence fails.
 */
async function seedImages(client: PGlite) {
  await client.exec(`
    insert into makers(name, slug) values ('Lifecycle maker', 'lifecycle-maker');
    insert into product_types(name, slug) values ('Lifecycle type', 'lifecycle-type');
    insert into product(product_type_id, maker_id, name, slug) values
      ((select id from product_types where slug = 'lifecycle-type'),
       (select id from makers where slug = 'lifecycle-maker'),
       'Shared product', 'shared-product'),
      ((select id from product_types where slug = 'lifecycle-type'),
       (select id from makers where slug = 'lifecycle-maker'),
       'Owned product', 'owned-product');
    insert into product_image(
      product_id, position, file_name, content_type, size, sha256,
      object_path, storage_owned, url
    ) values
      ((select id from product where slug = 'shared-product'), 0, 'shared.png',
       'image/png', 1, repeat('a', 64),
       'images/preview/products/1000/shared.png', false,
       'https://cdn.example.test/images/preview/products/1000/shared.png');
  `);
}
