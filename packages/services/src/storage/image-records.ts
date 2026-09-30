import { sql } from "drizzle-orm";
import {
  type StorageDb,
  type UploadActor,
  type UploadedFile,
  UploadSessionError,
  type UploadTarget,
} from "./types.js";
export const imageTargets = {
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
export async function lockObjectPath(db: StorageDb, path: string) {
  await db.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`object:${path}`}, 0))`,
  );
}
export async function lockTarget(db: StorageDb, target: UploadTarget) {
  await db.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`upload:${target.type}:${target.id}`}, 0))`,
  );
}
export async function assertCanEditTarget(
  db: StorageDb,
  target: UploadTarget,
  actor: UploadActor,
) {
  const query =
    target.type === "resource"
      ? sql`select uploader_clerk_id as owner from resources where deleted_at is null and id = ${target.id}`
      : sql`${imageTargets[target.type].owner} ${target.id}`;
  const result = await db.execute<{ owner: string }>(query);
  if (
    !result.rows[0] ||
    (!actor.isAdmin && result.rows[0].owner !== actor.clerkId)
  )
    throw new UploadSessionError("session_not_found", 404);
}
export async function assertNoDuplicateImages(
  db: StorageDb,
  target: UploadTarget,
  files: Array<{ sha256: string }>,
) {
  if (target.type === "resource") return;
  const mapping = imageTargets[target.type];
  const result = await db.execute<{
    id: number;
    sha256: string;
    deletedAt: Date | null;
    deletedByRole: string | null;
  }>(
    sql`select id, sha256, ${mapping.softDelete ? sql`deleted_at` : sql`null`} as "deletedAt", ${mapping.softDelete ? sql`deleted_by_role` : sql`null`} as "deletedByRole" from ${sql.identifier(mapping.table)} where ${sql.identifier(mapping.column)} = ${target.id}`,
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
export async function attachImages(
  db: StorageDb,
  input: { target: UploadTarget; files: UploadedFile[]; actor: UploadActor },
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
  await assertCanEditTarget(db, target, actor);
  await assertNoDuplicateImages(db, target, files);
  const mapping = imageTargets[target.type];
  const table = sql.identifier(mapping.table),
    column = sql.identifier(mapping.column);
  const result = await db.execute<{ position: number }>(
    sql`select coalesce(max(position),-1)::int + 1 as position from ${table} where ${column} = ${target.id}`,
  );
  let position = result.rows[0]?.position ?? 0;
  if (target.type === "collection")
    await db.execute(
      sql`update collection_image set is_current = false where collection_id = ${target.id}`,
    );
  for (const [index, file] of files.entries()) {
    await db.execute(
      sql`insert into ${table} (${column}, position, file_name, content_type, size, sha256, object_path, url, uploaded_by_clerk_id${target.type === "collection" ? sql`, is_current` : sql``}) values (${target.id}, ${position++}, ${file.fileName}, ${file.contentType}, ${file.size}, ${file.sha256}, ${file.objectPath}, ${file.url}, ${actor.clerkId}${target.type === "collection" ? sql`, ${index === files.length - 1}` : sql``})`,
    );
  }
  if (target.type === "collection")
    await db.execute(
      sql`update user_collection set updated_at = now() where id = ${target.id}`,
    );
}
export async function selectCollectionCover(
  db: StorageDb,
  input: { collectionId: number; imageId: number | null; actor: UploadActor },
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
