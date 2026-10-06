import type { Database } from "@package/database";
import { type Logger, loggerMessages } from "@package/logger";
import type { UploadStorage } from "@package/storage";
import { sql } from "drizzle-orm";
import { hashLogIdentifier } from "../logging.js";
import { imageTargets, lockObjectPath } from "./image-records.js";
import { type StorageDb, UploadSessionError } from "./types.js";

/** Maps persisted file kinds to their attachment tables and owning target types. */
export const fileRecords = {
  material_image: { ...imageTargets.material, targetType: "material" },
  maker_image: { ...imageTargets.maker, targetType: "maker" },
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

/**
 * Checks whether any persisted record references an object path, including soft-deleted attachments.
 *
 * @param db - Application database.
 * @param path - Object-storage path to check.
 * @returns Whether an attachment or resource version references the path.
 * @rejects When the attachment query fails.
 */
export async function objectIsAttached(db: StorageDb, path: string) {
  const result = await db.execute(
    sql`select 1 from (${sql.join(
      [
        ...Object.values(fileRecords).map(
          ({ table }) => sql`select object_path from ${sql.identifier(table)}`,
        ),
        sql`select object_path from resource_versions`,
        sql`select archive_object_path as object_path from resource_versions`,
      ],
      sql` union all `,
    )}) objects where object_path = ${path} limit 1`,
  );
  return result.rows.length > 0;
}

/**
 * Locks an object path and requires it not to be queued for deletion.
 *
 * @param db - Application database.
 * @param path - Object-storage path to validate.
 * @rejects When locking or lookup fails, or deletion is already pending.
 */
export async function assertNotPendingDeletion(db: StorageDb, path: string) {
  await lockObjectPath(db, path);
  const pending = await db.execute(
    sql`select 1 from storage_object_deletion where object_path = ${path}`,
  );
  if (pending.rows.length)
    throw new UploadSessionError("upload_in_progress", 409);
}

/**
 * Queues unique object paths for deferred deletion under per-path locks.
 * Call this in the transaction that removes the attachment. Writers use the
 * same lock and reject queued paths until cleanup finishes.
 *
 * @param db - Application database.
 * @param paths - Object-storage paths removed from their attachments.
 * @rejects When locking, ownership lookup, or queue persistence fails.
 */
export async function queueObjectDeletions(db: StorageDb, paths: string[]) {
  for (const path of [...new Set(paths)].sort()) {
    await lockObjectPath(db, path);
    if (!(await objectStorageIsOwned(db, path))) continue;
    const ownerClerkId = await erasableObjectOwner(db, path);
    await db.execute(
      sql`insert into storage_object_deletion(object_path, owner_clerk_id)
        values (${path}, ${ownerClerkId})
        on conflict (object_path) do update set owner_clerk_id =
          coalesce(storage_object_deletion.owner_clerk_id, excluded.owner_clerk_id)`,
    );
  }
}

/**
 * Reports whether the current database owns an object's storage lifecycle.
 *
 * Immutable preview seed images are attached to product records but owned by
 * the shared preview baseline, so deleting a cloned record must not queue the
 * shared object.
 *
 * @param db - Application database.
 * @param path - Object-storage path to inspect.
 * @returns Whether deletion may be owned by this database.
 * @rejects When the ownership lookup fails.
 */
async function objectStorageIsOwned(db: StorageDb, path: string) {
  const result = await db.execute<{
    /** Explicit product-image storage ownership. */
    storageOwned: boolean;
  }>(
    sql`select storage_owned as "storageOwned" from product_image where object_path = ${path} and not storage_owned limit 1`,
  );
  return result.rows.length === 0;
}

/**
 * Resolves the sole erasure-eligible account owner of an attached object path.
 *
 * @param db - Application database.
 * @param path - Object-storage path to inspect.
 * @returns Clerk identifier when exactly one eligible owner is found, otherwise `null`.
 * @rejects When the ownership query fails.
 */
async function erasableObjectOwner(db: StorageDb, path: string) {
  const result = await db.execute<{
    /** Clerk identifier of an attachment owner. */
    clerkId: string;
  }>(sql`
    select distinct owned.clerk_id as "clerkId" from (
      select null::text as clerk_id, maker_image.object_path
      from maker_image
      union all
      select users.clerk_id, collection_image.object_path
      from collection_image
      join user_collection on user_collection.id = collection_image.collection_id
      join users on users.id = user_collection.owner_id
      union all
      select users.clerk_id, collection_item_image.object_path
      from collection_item_image
      join collection_item on collection_item.id = collection_item_image.collection_item_id
      join users on users.id = collection_item.owner_id
      union all
      select resources.uploader_clerk_id, resource_images.object_path
      from resource_images
      join resources on resources.id = resource_images.resource_id
      union all
      select resources.uploader_clerk_id, resource_files.object_path
      from resource_files
      join resource_versions on resource_versions.id = resource_files.version_id
      join resources on resources.id = resource_versions.resource_id
      union all
      select resources.uploader_clerk_id, resource_versions.object_path
      from resource_versions
      join resources on resources.id = resource_versions.resource_id
      where resource_versions.object_path is not null
      union all
      select resources.uploader_clerk_id, resource_versions.archive_object_path
      from resource_versions
      join resources on resources.id = resource_versions.resource_id
      where resource_versions.archive_object_path is not null
    ) owned where owned.object_path = ${path}`);
  return result.rows.length === 1 ? result.rows[0]?.clerkId : null;
}

/**
 * Drains queued object deletions without failing the batch on individual
 * errors. Failed or upload-reserved paths remain queued; paths attached again
 * have their stale queue entry removed without deleting the object.
 *
 * @param db - Application database.
 * @param storage - Object storage from which unreferenced paths are deleted.
 * @param logger - Application logger.
 * @param paths - Optional object-path filter; at most 100 matching queued paths are processed in creation order.
 * @rejects When retry logging itself fails.
 */
export async function cleanupObjectDeletions(
  db: Database,
  storage: UploadStorage,
  logger: Logger,
  paths?: string[],
) {
  if (paths?.length === 0) return;
  // ponytail: drain at most 100 objects per run; increase capacity if the backlog grows.
  let pending: {
    /** Queued deletion rows selected for this batch. */
    rows: {
      /** Object-storage path queued for deletion. */
      objectPath: string;
    }[];
  };
  try {
    pending = await db.execute<{
      /** Object-storage path queued for deletion. */
      objectPath: string;
    }>(
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
