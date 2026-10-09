import { sql } from "drizzle-orm";
import { hasPermission, type Permission } from "../authorization.js";
import {
  type StorageDb,
  type UploadActor,
  type UploadedFile,
  UploadSessionError,
  type UploadTarget,
} from "./types.js";
/** Maps image-upload targets to their ownership and persistence tables. */
export const imageTargets = {
  material: {
    table: "material_image",
    column: "material_id",
    entity: "materials",
    softDelete: true,
    owner: sql`select null::text as owner from materials where id =`,
    parent: "materials",
  },
  maker: {
    table: "maker_image",
    column: "maker_id",
    entity: "makers",
    softDelete: true,
    owner: sql`select null::text as owner from makers where id =`,
    parent: "makers",
  },
  product: {
    table: "product_image",
    column: "product_id",
    entity: "products",
    softDelete: true,
    owner: sql`select owner_clerk_id as owner from product where id =`,
    parent: "product",
  },
  collection: {
    table: "collection_image",
    column: "collection_id",
    entity: "collections",
    softDelete: false,
    owner: sql`select u.clerk_id as owner from user_collection p join users u on u.id = p.owner_id where p.id =`,
    parent: "user_collection",
  },
  collection_item: {
    table: "collection_item_image",
    column: "collection_item_id",
    entity: "collection-items",
    softDelete: true,
    owner: sql`select u.clerk_id as owner from collection_item p join users u on u.id = p.owner_id where p.id =`,
    parent: "collection_item",
  },
} as const;
/**
 * Serializes writes for an object-storage path within the current transaction.
 *
 * @param db - Application database.
 * @param path - Object-storage path to lock.
 * @rejects When the advisory lock cannot be acquired.
 */
export async function lockObjectPath(db: StorageDb, path: string) {
  await db.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`object:${path}`}, 0))`,
  );
}
/**
 * Serializes uploads for a target entity within the current transaction.
 *
 * @param db - Application database.
 * @param target - Entity whose upload workflow is locked.
 * @rejects When the advisory lock cannot be acquired.
 */
export async function lockTarget(db: StorageDb, target: UploadTarget) {
  await db.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`upload:${target.type}:${target.id}`}, 0))`,
  );
}
/**
 * Requires the actor to own or administer an existing upload target.
 *
 * @param db - Application database.
 * @param target - Entity being edited.
 * @param actor - Actor requesting the edit.
 * @rejects When ownership lookup fails or the target is missing or inaccessible.
 */
export async function assertCanEditTarget(
  db: StorageDb,
  target: UploadTarget,
  actor: UploadActor,
) {
  const query =
    target.type === "resource"
      ? sql`select uploader_clerk_id as owner from resources where deleted_at is null and id = ${target.id}`
      : sql`${imageTargets[target.type].owner} ${target.id}`;
  const result = await db.execute<{
    /** Clerk identifier of the target owner. */
    owner: string | null;
  }>(query);
  if (
    !result.rows[0] ||
    (result.rows[0].owner !== actor.clerkId &&
      !hasPermission(actor, permissionFor(target.type)))
  )
    throw new UploadSessionError("session_not_found", 404);
}

/**
 * Returns the administrative permission for an upload target type.
 *
 * @param target - Target entity kind.
 * @returns Permission that grants cross-owner edits.
 */
function permissionFor(target: UploadTarget["type"]): Permission {
  if (target === "resource") return "resources.manage";
  if (target === "maker" || target === "material" || target === "product")
    return "products.manage";
  return "collections.manage";
}
/**
 * Verifies that an optional image scope belongs to its general material.
 *
 * @param db - Transaction that owns the material target lock.
 * @param target - General image target.
 * @param materialSpecificId - Optional alloy or grade identifier.
 * @rejects When a scope is supplied on another target or belongs to another material.
 */
export async function assertMaterialScope(
  db: StorageDb,
  target: UploadTarget,
  materialSpecificId?: number | null,
) {
  if (target.type !== "material") {
    if (materialSpecificId !== undefined)
      throw new UploadSessionError("invalid_request", 400);
    return;
  }
  if (materialSpecificId == null) return;
  if (!Number.isSafeInteger(materialSpecificId) || materialSpecificId <= 0)
    throw new UploadSessionError("invalid_request", 400);
  const result = await db.execute(sql`select 1 from material_specific
    where id = ${materialSpecificId} and material_id = ${target.id}`);
  if (!result.rows.length) throw new UploadSessionError("invalid_request", 400);
}

/**
 * Rejects catalog images whose digest already exists on their target.
 *
 * @param db - Application database.
 * @param target - Entity receiving the images.
 * @param files - Uploaded image digests to compare.
 * @param materialSpecificId - Optional material scope, defaulting to General.
 * @rejects When duplicate lookup fails or an active or soft-deleted duplicate exists.
 */
export async function assertNoDuplicateImages(
  db: StorageDb,
  target: UploadTarget,
  files: Array<{
    /** SHA-256 digest used for duplicate detection. */
    sha256: string;
  }>,
  materialSpecificId?: number | null,
) {
  if (target.type === "resource") return;
  const mapping = imageTargets[target.type];
  const result = await db.execute<{
    /** Existing image identifier reported with a conflict. */
    id: number;
    /** Existing image SHA-256 digest. */
    sha256: string;
    /** Deletion time, or `null` for an active image. */
    deletedAt: Date | null;
    /** Deleting role, or `null` for an active image. */
    deletedByRole: string | null;
  }>(
    sql`select id, sha256, ${mapping.softDelete ? sql`deleted_at` : sql`null`} as "deletedAt", ${mapping.softDelete ? sql`deleted_by_role` : sql`null`} as "deletedByRole" from ${sql.identifier(mapping.table)} where ${sql.identifier(mapping.column)} = ${target.id} ${target.type === "material" ? sql`and material_specific_id is not distinct from ${materialSpecificId ?? null}` : sql``}`,
  );
  for (const file of files) {
    const existing = result.rows.find((row) => row.sha256 === file.sha256);
    if (existing)
      throw new UploadSessionError(
        existing.deletedAt
          ? existing.deletedByRole === "admin"
            ? "duplicate_admin_deleted"
            : "duplicate_owner_deleted"
          : "duplicate_active",
        409,
        Number(existing.id),
        existing.sha256,
      );
  }
}
/**
 * Appends uploaded images to a product, collection, or collection item.
 *
 * @param db - Application database.
 * @param input - Target, uploaded image metadata, and requesting actor.
 * @rejects When persistence fails, paths are pending deletion, the target is invalid or inaccessible, or an image is duplicated.
 */
export async function attachImages(
  db: StorageDb,
  input: {
    /** Entity receiving the images. */
    target: UploadTarget;
    /** Optional alloy or grade scope for material targets only. */
    materialSpecificId?: number | null;
    /** Images appended in upload order. */
    files: UploadedFile[];
    /** Actor requesting the attachment. */
    actor: UploadActor;
  },
) {
  const { target, files, actor } = input;
  for (const file of [...files].sort((a, b) =>
    a.objectPath.localeCompare(b.objectPath),
  )) {
    await lockObjectPath(db, file.objectPath);
    const pending = await db.execute(
      sql`select 1 from storage_object_deletion where object_path = ${file.objectPath}`,
    );
    if (pending.rows.length)
      throw new UploadSessionError("upload_in_progress", 409);
  }
  if (target.type === "resource")
    throw new UploadSessionError("invalid_request", 400);
  await lockTarget(db, target);
  await assertCanEditTarget(db, target, actor);
  await assertMaterialScope(db, target, input.materialSpecificId);
  await assertNoDuplicateImages(db, target, files, input.materialSpecificId);
  const mapping = imageTargets[target.type];
  const table = sql.identifier(mapping.table),
    column = sql.identifier(mapping.column);
  const result = await db.execute<{
    /**
     * Display order position.
     */
    position: number;
  }>(
    sql`select coalesce(max(position),-1)::int + 1 as position from ${table} where ${column} = ${target.id} ${target.type === "material" ? sql`and material_specific_id is not distinct from ${input.materialSpecificId ?? null}` : sql``}`,
  );
  let position = result.rows[0]?.position ?? 0;
  const collectionHasCover =
    target.type === "collection" &&
    (
      await db.execute(
        sql`select 1 from collection_image where collection_id = ${target.id} and is_current limit 1`,
      )
    ).rows.length > 0;
  for (const [index, file] of files.entries()) {
    await db.execute(
      sql`insert into ${table} (${column}${target.type === "material" ? sql`, material_specific_id` : sql``}, position, file_name, content_type, size, sha256, object_path, url, uploaded_by_clerk_id${target.type === "collection" ? sql`, is_current` : sql``}) values (${target.id}${target.type === "material" ? sql`, ${input.materialSpecificId ?? null}` : sql``}, ${position++}, ${file.fileName}, ${file.contentType}, ${file.size}, ${file.sha256}, ${file.objectPath}, ${file.url}, ${actor.clerkId}${target.type === "collection" ? sql`, ${!collectionHasCover && index === 0}` : sql``})`,
    );
  }
  if (target.type === "collection")
    await db.execute(
      sql`update user_collection set updated_at = now() where id = ${target.id}`,
    );
}
/**
 * Replaces or clears a collection's current cover image.
 *
 * @param db - Application database.
 * @param input - Collection, optional cover image, and requesting actor.
 * @rejects When persistence fails, the collection is inaccessible, or the image does not belong to it.
 */
export async function selectCollectionCover(
  db: StorageDb,
  input: {
    /** Collection whose cover changes. */
    collectionId: number;
    /** Image to select, or `null` to clear the cover. */
    imageId: number | null;
    /** Actor requesting the cover change. */
    actor: UploadActor;
  },
) {
  const target: UploadTarget = { type: "collection", id: input.collectionId };
  await lockTarget(db, target);
  await assertCanEditTarget(db, target, input.actor);
  if (input.imageId !== null) {
    const found = await db.execute(
      sql`select id from collection_image where id = ${input.imageId} and collection_id = ${input.collectionId}`,
    );
    if (!found.rows.length)
      throw new UploadSessionError("invalid_request", 400);
  }
  await db.execute(
    sql`update collection_image set is_current = false where collection_id = ${input.collectionId}`,
  );
  if (input.imageId !== null)
    await db.execute(
      sql`update collection_image set is_current = true where id = ${input.imageId}`,
    );
  await db.execute(
    sql`update user_collection set updated_at = now() where id = ${input.collectionId}`,
  );
}
