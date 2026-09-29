import type { Database } from "@package/database";
import { type Logger, loggerMessages } from "@package/logger";
import type { UploadStorage } from "@package/storage";
import { sql } from "drizzle-orm";
import { hashLogIdentifier } from "../logging.js";
import { imageTargets, lockObjectPath } from "./image-records.js";
import { type StorageDb, UploadSessionError } from "./types.js";

export const fileRecords = {
  product_image: { ...imageTargets.product, targetType: "product" },
  collection_image: { ...imageTargets.collection, targetType: "collection" },
  collection_item_image: {
    ...imageTargets.collection_item,
    targetType: "collection_item",
  },
  resource_image: {
    table: "resource_images",
    column: "resource_id",
    targetType: "resource",
  },
  resource_file: {
    table: "resource_files",
    column: "version_id",
    targetType: "resource",
  },
} as const;

export { lockObjectPath } from "./image-records.js";

export async function objectIsAttached(db: StorageDb, path: string) {
  const result = await db.execute(
    sql`select 1 from (${sql.join(
      [
        ...Object.values(fileRecords).map(
          ({ table }) => sql`select object_path from ${sql.identifier(table)}`,
        ),
        sql`select object_path from resource_versions`,
      ],
      sql` union all `,
    )}) objects where object_path = ${path} limit 1`,
  );
  return result.rows.length > 0;
}

export async function assertNotPendingDeletion(db: StorageDb, path: string) {
  await lockObjectPath(db, path);
  const pending = await db.execute(
    sql`select 1 from storage_object_deletion where object_path = ${path}`,
  );
  if (pending.rows.length)
    throw new UploadSessionError("upload_in_progress", 409);
}

// Call inside the same transaction that removes the attachment. Writers use the
// same path lock and refuse queued paths until cleanup has finished.
export async function queueObjectDeletions(db: StorageDb, paths: string[]) {
  for (const path of [...new Set(paths)].sort()) {
    await lockObjectPath(db, path);
    await db.execute(
      sql`insert into storage_object_deletion(object_path) values (${path}) on conflict do nothing`,
    );
  }
}

export async function cleanupObjectDeletions(
  db: Database,
  storage: UploadStorage,
  logger: Logger,
  paths?: string[],
) {
  if (paths?.length === 0) return;
  // ponytail: drain at most 100 objects per run; increase capacity if the backlog grows.
  let pending: { rows: { objectPath: string }[] };
  try {
    pending = await db.execute<{ objectPath: string }>(
      sql`select object_path as "objectPath" from storage_object_deletion ${
        paths
          ? sql`where object_path in (${sql.join(
              paths.map((path) => sql`${path}`),
              sql`, `,
            )})`
          : sql``
      } order by created_at limit 100`,
    );
  } catch {
    logger.warn(loggerMessages.database.storage.deletionRetry);
    return;
  }
  for (const { objectPath } of pending.rows) {
    try {
      await db.transaction(async (tx) => {
        await lockObjectPath(tx, objectPath);
        const current = await tx.execute(
          sql`select 1 from storage_object_deletion where object_path = ${objectPath} for update`,
        );
        if (!current.rows.length) return;
        const reserved = await tx.execute(
          sql`select 1 from upload_file where object_path = ${objectPath}`,
        );
        if (reserved.rows.length) return;
        // An attached path cancels a stale deletion; never remove its object.
        if (!(await objectIsAttached(tx, objectPath)))
          await storage.delete(objectPath);
        await tx.execute(
          sql`delete from storage_object_deletion where object_path = ${objectPath}`,
        );
      });
    } catch {
      logger.warn(loggerMessages.database.storage.deletionRetry, {
        attributes: { objectPathHash: hashLogIdentifier(objectPath) },
      });
    }
  }
}
