import { type Database, schema } from "@package/database";
import { type LogContext, type Logger, loggerMessages } from "@package/logger";
import {
  maxImageBytes,
  maxImageSessionBytes,
  maxImageSessionFiles,
  maxResourceFileBytes,
  maxResourceFiles,
  maxResourceImages,
  maxResourceSessionBytes,
  readBodyWithLimit,
  sha256,
  storageFetchTimeoutMs,
  type UploadStorage,
  uploadTargetTypes,
} from "@package/storage";
import { and, eq, isNull, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { hashLogIdentifier, loggedMutation } from "../logging.js";
import { completeResource, completeVersion } from "./complete-resource.js";
import {
  assertCanEditTarget,
  assertNoDuplicateImages,
  attachImages,
  imageTargets,
  lockTarget,
} from "./image-records.js";
import {
  assertNotPendingDeletion,
  cleanupObjectDeletions,
  fileRecords,
  lockObjectPath,
  objectIsAttached,
  queueObjectDeletions,
} from "./object-lifecycle.js";
import { resourcePayload } from "./resource-payload.js";
import {
  type UploadActor,
  UploadSessionError,
  type UploadTarget,
} from "./types.js";

export type { UploadActor } from "./types.js";
export { UploadSessionError } from "./types.js";
export const uploadManifestSchema = z.object({
  target: z.object({
    type: z.enum(uploadTargetTypes),
    id: z.number().int().positive().optional(),
  }),
  payload: z.record(z.string(), z.unknown()).optional(),
  files: z
    .array(
      z.object({
        kind: z.enum(["image", "file"]),
        fileName: z.string().min(1).max(255),
        contentType: z.string().min(1).max(255),
        size: z.number().int().positive().max(maxImageBytes),
        sha256: z.string().regex(/^[a-f0-9]{64}$/u),
      }),
    )
    .min(1)
    .max(maxImageSessionFiles),
});
export type UploadManifest = z.infer<typeof uploadManifestSchema>;
export const fileTypes = [
  "product_image",
  "collection_image",
  "collection_item_image",
  "resource_image",
  "resource_file",
] as const;
export type FileType = (typeof fileTypes)[number];
type Session = typeof schema.uploadSession.$inferSelect;

export function createStorageService(input: {
  db: Database;
  storage: UploadStorage;
  logger: Logger;
  now?: () => Date;
  randomUUID?: () => string;
}) {
  const { db, storage, logger } = input;
  const now = input.now ?? (() => new Date());
  const uuid = input.randomUUID ?? (() => crypto.randomUUID());
  const service = {
    async create(value: unknown, actor: UploadActor, attributes: LogContext) {
      const parsed = uploadManifestSchema.safeParse(value);
      if (!parsed.success) throw new UploadSessionError("invalid_request", 400);
      const manifest = parsed.data;
      attributes.targetType = manifest.target.type;
      Object.assign(attributes, fileCounts(manifest.files));
      const payload =
        manifest.target.type === "resource"
          ? resourcePayload(manifest.payload)
          : null;
      validateManifest(manifest, payload?.operation);
      return db.transaction(async (tx) => {
        let targetId = manifest.target.id;
        const isCreate = payload?.operation === "create";
        if (isCreate) {
          const reserved = await tx.execute<{ id: number }>(
            sql`select nextval(pg_get_serial_sequence('resources','id'))::bigint as id`,
          );
          targetId = Number(reserved.rows[0]?.id);
        }
        if (!targetId || !Number.isSafeInteger(targetId))
          throw new UploadSessionError("invalid_request", 400);
        const target: UploadTarget = {
          type: manifest.target.type,
          id: targetId,
        };
        await lockTarget(tx, target);
        if (!isCreate) await assertCanEditTarget(tx, target, actor);
        await assertNoDuplicateImages(tx, target, manifest.files);
        let version: number | null = null;
        if (payload) {
          const pending = await tx
            .select({ id: schema.uploadSession.id })
            .from(schema.uploadSession)
            .where(
              and(
                eq(schema.uploadSession.targetType, "resource"),
                eq(schema.uploadSession.targetId, targetId),
                isNull(schema.uploadSession.completedAt),
              ),
            )
            .limit(1);
          if (pending.length)
            throw new UploadSessionError("upload_in_progress", 409);
          const versions = await tx.execute<{ version: number }>(
            sql`select coalesce(max(version),0)::int + 1 as version from resource_versions where resource_id = ${targetId}`,
          );
          version = versions.rows[0]?.version ?? 1;
        }
        const id = uuid(),
          expiresAt = new Date(now().getTime() + 60 * 60 * 1000);
        attributes.sessionIdHash = hashLogIdentifier(id);
        const positions = { image: 0, file: 0 };
        const files = manifest.files.map((file) => {
          try {
            return {
              ...file,
              id: uuid(),
              sessionId: id,
              position: positions[file.kind]++,
              ...(file.kind === "image"
                ? storage.createImageTarget(file, {
                    entity:
                      target.type === "resource"
                        ? "resources"
                        : imageTargets[target.type].entity,
                    entityId: targetId,
                  })
                : storage.createFileTarget(file, {
                    resourceId: targetId,
                    version: version ?? 1,
                  })),
            };
          } catch {
            throw new UploadSessionError("invalid_request", 400);
          }
        });
        for (const file of [...files].sort((a, b) =>
          a.objectPath.localeCompare(b.objectPath),
        )) {
          await assertNotPendingDeletion(tx, file.objectPath);
          const reserved = await tx
            .select({ id: schema.uploadFile.id })
            .from(schema.uploadFile)
            .where(eq(schema.uploadFile.objectPath, file.objectPath))
            .limit(1);
          if (reserved.length || (await objectIsAttached(tx, file.objectPath)))
            throw new UploadSessionError("duplicate_active", 409);
        }
        await tx.insert(schema.uploadSession).values({
          id,
          uploaderClerkId: actor.clerkId,
          targetType: target.type,
          targetId,
          reservedResourceId: isCreate ? targetId : null,
          reservedVersion: version,
          payload: payload ?? null,
          expiresAt,
        });
        await tx.insert(schema.uploadFile).values(files);
        return {
          id,
          expiresAt: expiresAt.toISOString(),
          uploads: files.map(({ id, kind, fileName, contentType, size }) => ({
            id,
            kind,
            fileName,
            contentType,
            size,
          })),
        };
      });
    },
    async upload(
      sessionId: string,
      fileId: string,
      actor: UploadActor,
      request: Request,
      attributes: LogContext,
    ) {
      // ponytail: hold the per-session lock through bounded I/O; use durable
      // in-flight claims if transaction duration becomes a bottleneck.
      return db.transaction(async (tx) => {
        const session = await loadSession(tx, sessionId, actor.clerkId);
        attributes.targetType = session.targetType;
        if (session.completedAt) return;
        if (session.expiresAt <= now())
          throw new UploadSessionError("session_expired", 409);
        if (!session.reservedResourceId)
          await assertCanEditTarget(
            tx,
            { type: session.targetType, id: session.targetId },
            actor,
          );
        const [file] = await tx
          .select()
          .from(schema.uploadFile)
          .where(
            and(
              eq(schema.uploadFile.sessionId, sessionId),
              eq(schema.uploadFile.id, fileId),
            ),
          );
        if (!file) throw new UploadSessionError("session_not_found", 404);
        attributes.fileType =
          file.kind === "file"
            ? "resource_file"
            : `${session.targetType}_image`;
        attributes.fileCount = 1;
        if (file.uploadedAt) return;
        const header = request.headers.get("content-length"),
          length = header === null ? NaN : Number(header);
        if (!Number.isSafeInteger(length) || length <= 0)
          throw new UploadSessionError("content_length_required", 411);
        if (
          length !== file.size ||
          request.headers.get("content-type") !== file.contentType ||
          !request.body
        )
          throw new UploadSessionError("content_length_mismatch", 400);
        let bytes: Uint8Array;
        try {
          bytes = await readBodyWithLimit(
            new Response(request.body),
            length,
            AbortSignal.timeout(storageFetchTimeoutMs),
          );
          if (bytes.length !== length) throw new Error("length");
        } catch {
          throw new UploadSessionError("content_length_mismatch", 400);
        }
        if ((await sha256(bytes)) !== file.sha256)
          throw new UploadSessionError("hash_mismatch", 400);
        try {
          const args = {
            contentLength: length,
            contentType: file.contentType,
            objectPath: file.objectPath,
          };
          if (file.kind === "image")
            await storage.putImage({ ...args, body: bytes });
          else {
            const body = new Response(new Uint8Array(bytes)).body;
            if (!body) throw new Error("Response body is missing.");
            await storage.putFile({ ...args, body });
          }
        } catch {
          throw new UploadSessionError("upload_failed", 502);
        }
        await tx
          .update(schema.uploadFile)
          .set({ uploadedAt: now() })
          .where(eq(schema.uploadFile.id, fileId));
      });
    },
    async completeUpload(
      sessionId: string,
      actor: UploadActor,
      attributes: LogContext,
    ) {
      return db.transaction(async (tx) => {
        const session = await loadSession(tx, sessionId, actor.clerkId);
        attributes.targetType = session.targetType;
        if (session.completedAt) {
          attributes.alreadyCompleted = true;
          return completion(session);
        }
        if (session.expiresAt <= now())
          throw new UploadSessionError("session_expired", 409);
        const target: UploadTarget = {
          type: session.targetType,
          id: session.targetId,
        };
        await lockTarget(tx, target);
        const files = await tx
          .select()
          .from(schema.uploadFile)
          .where(eq(schema.uploadFile.sessionId, sessionId))
          .orderBy(schema.uploadFile.position);
        Object.assign(attributes, fileCounts(files));
        if (!files.length || files.some((file) => !file.uploadedAt))
          throw new UploadSessionError("uploads_incomplete", 409);
        if (target.type === "resource") {
          const payload = resourcePayload(session.payload);
          if (payload.operation === "create") {
            if (
              !(await completeResource(tx, sessionId, actor.clerkId, payload))
            )
              throw new UploadSessionError("uploads_incomplete", 409);
          } else {
            await assertCanEditTarget(tx, target, actor);
            if (!(await completeVersion(tx, sessionId, actor.clerkId)))
              throw new UploadSessionError("uploads_incomplete", 409);
          }
        } else await attachImages(tx, { target, files, actor });
        await tx
          .update(schema.uploadSession)
          .set({ completedAt: now() })
          .where(eq(schema.uploadSession.id, sessionId));
        // Completed sessions retain their result for retries; release path reservations.
        await tx
          .delete(schema.uploadFile)
          .where(eq(schema.uploadFile.sessionId, sessionId));
        return completion(session);
      });
    },
    async cleanupExpired(attributes: LogContext) {
      const sessions = await db
        .select({ id: schema.uploadSession.id })
        .from(schema.uploadSession)
        .where(lt(schema.uploadSession.expiresAt, now()));
      attributes.sessionCount = sessions.length;
      attributes.removedSessionCount = 0;
      attributes.failedSessionCount = 0;
      let removed = 0,
        failed = 0;
      for (const { id } of sessions) {
        const sessionAttributes: LogContext = {
          sessionIdHash: hashLogIdentifier(id),
        };
        try {
          const didRemove = await db.transaction(async (tx) => {
            const [session] = await tx
              .select()
              .from(schema.uploadSession)
              .where(
                and(
                  eq(schema.uploadSession.id, id),
                  lt(schema.uploadSession.expiresAt, now()),
                ),
              )
              .for("update");
            if (!session) return;
            sessionAttributes.targetType = session.targetType;
            const files = await tx
              .select()
              .from(schema.uploadFile)
              .where(eq(schema.uploadFile.sessionId, id));
            Object.assign(sessionAttributes, fileCounts(files));
            if (!session.completedAt)
              for (const file of [...files].sort((a, b) =>
                a.objectPath.localeCompare(b.objectPath),
              )) {
                await lockObjectPath(tx, file.objectPath);
                if (!(await objectIsAttached(tx, file.objectPath)))
                  await storage.delete(file.objectPath);
              }
            await tx
              .delete(schema.uploadSession)
              .where(eq(schema.uploadSession.id, id));
            return true;
          });
          if (didRemove) attributes.removedSessionCount = ++removed;
        } catch {
          attributes.failedSessionCount = ++failed;
          logger.warn(loggerMessages.database.storage.cleanupRetry, {
            attributes: sessionAttributes,
          });
        }
      }
      await cleanupObjectDeletions(db, storage, logger);
      return removed;
    },
    async snapshotErasureTargets(requestId: string, targetClerkId: string) {
      await db.transaction(async (tx) => {
        const request = await tx.execute<{ storageTargets: string[] | null }>(
          sql`select storage_targets as "storageTargets" from erasure_request
            where id = ${requestId} and target_clerk_id = ${targetClerkId}
            for update`,
        );
        const current = request.rows[0];
        if (!current) throw new Error("Erasure request target was not found.");
        if (current.storageTargets !== null) return;
        const targets = await tx.execute<{ objectPath: string }>(sql`
          select distinct owned.object_path as "objectPath" from (
            select collection_image.object_path
            from collection_image
            join user_collection on user_collection.id = collection_image.collection_id
            join users on users.id = user_collection.owner_id
            where users.clerk_id = ${targetClerkId}
            union all
            select collection_item_image.object_path
            from collection_item_image
            join collection_item on collection_item.id = collection_item_image.collection_item_id
            join users on users.id = collection_item.owner_id
            where users.clerk_id = ${targetClerkId}
            union all
            select resource_images.object_path
            from resource_images
            join resources on resources.id = resource_images.resource_id
            where resources.uploader_clerk_id = ${targetClerkId}
            union all
            select resource_files.object_path
            from resource_files
            join resource_versions on resource_versions.id = resource_files.version_id
            join resources on resources.id = resource_versions.resource_id
            where resources.uploader_clerk_id = ${targetClerkId}
            union all
            select resource_versions.object_path
            from resource_versions
            join resources on resources.id = resource_versions.resource_id
            where resources.uploader_clerk_id = ${targetClerkId}
              and resource_versions.object_path is not null
            union all
            select resource_versions.archive_object_path
            from resource_versions
            join resources on resources.id = resource_versions.resource_id
            where resources.uploader_clerk_id = ${targetClerkId}
              and resource_versions.archive_object_path is not null
            union all
            select upload_file.object_path
            from upload_file
            join upload_session on upload_session.id = upload_file.session_id
            where upload_session.uploader_clerk_id = ${targetClerkId}
              and upload_session.target_type <> 'product'
            union all
            select storage_object_deletion.object_path
            from storage_object_deletion
            where storage_object_deletion.owner_clerk_id = ${targetClerkId}
          ) owned order by owned.object_path`);
        await tx
          .update(schema.erasureRequest)
          .set({
            storageTargets: targets.rows.map(({ objectPath }) => objectPath),
            updatedAt: now(),
          })
          .where(eq(schema.erasureRequest.id, requestId));
      });
    },
    async eraseAccountObjects(requestId: string, targetClerkId: string) {
      await storage.assertErasureReady();
      const request = await db.execute<{ storageTargets: string[] | null }>(
        sql`select storage_targets as "storageTargets" from erasure_request
          where id = ${requestId} and target_clerk_id = ${targetClerkId}`,
      );
      const targets = request.rows[0]?.storageTargets;
      if (!targets)
        throw new Error("Erasure storage targets have not been captured.");

      for (const objectPath of targets) {
        await db.transaction(async (tx) => {
          await lockObjectPath(tx, objectPath);
          const current = await tx.execute<{ storageTargets: string[] }>(
            sql`select storage_targets as "storageTargets" from erasure_request
              where id = ${requestId} and target_clerk_id = ${targetClerkId}
              for update`,
          );
          if (!current.rows[0]?.storageTargets.includes(objectPath)) return;
          if (!(await hasSurvivingReference(tx, objectPath, targetClerkId)))
            await storage.erase(objectPath);
          await tx.execute(
            sql`delete from storage_object_deletion where object_path = ${objectPath}`,
          );
          await tx.execute(sql`update erasure_request
            set storage_targets = array_remove(storage_targets, ${objectPath}),
                updated_at = ${now()}
            where id = ${requestId}`);
        });
      }

      const completedAt = now();
      return {
        exceptions: [
          {
            code: "bunny_cache_30_days",
            expiresAt: new Date(
              completedAt.getTime() + 30 * 24 * 60 * 60 * 1000,
            ).toISOString(),
          },
          {
            code: "bunny_logs_3_days",
            expiresAt: new Date(
              completedAt.getTime() + 3 * 24 * 60 * 60 * 1000,
            ).toISOString(),
          },
        ],
      };
    },
    async deleteFile(
      {
        fileType,
        fileId,
        actor,
      }: {
        fileType: FileType;
        fileId: number;
        actor: UploadActor;
      },
      attributes: LogContext,
    ) {
      if (
        !fileTypes.includes(fileType) ||
        !Number.isSafeInteger(fileId) ||
        fileId <= 0
      )
        throw new UploadSessionError("invalid_request", 400);
      const mapping = fileRecords[fileType];
      attributes.fileType = fileType;
      attributes.targetType = mapping.targetType;
      attributes.fileIdHash = hashLogIdentifier(String(fileId));
      attributes.fileCount = 1;
      const objectPath = await db.transaction(async (tx) => {
        const result = await tx.execute<{
          targetId: number;
          objectPath: string;
          versionId: number;
          isCurrent: boolean;
        }>(
          fileType === "resource_file"
            ? sql`select v.resource_id as "targetId", f.object_path as "objectPath", f.version_id as "versionId", false as "isCurrent" from resource_files f join resource_versions v on v.id = f.version_id where f.id = ${fileId}`
            : sql`select ${sql.identifier(mapping.column)} as "targetId", object_path as "objectPath", 0 as "versionId", ${fileType === "collection_image" ? sql`is_current` : sql`false`} as "isCurrent" from ${sql.identifier(mapping.table)} where id = ${fileId}`,
        );
        const file = result.rows[0];
        if (!file) throw new UploadSessionError("session_not_found", 404);
        const target: UploadTarget = {
          type: mapping.targetType,
          id: Number(file.targetId),
        };
        await lockTarget(tx, target);
        await assertCanEditTarget(tx, target, actor);
        // Re-read under the target lock so concurrent cover selection/deletions cannot bypass the rules.
        const current = await tx.execute<{ isCurrent: boolean }>(
          sql`select ${fileType === "collection_image" ? sql`is_current` : sql`false`} as "isCurrent" from ${sql.identifier(mapping.table)} where id = ${fileId} for update`,
        );
        if (!current.rows.length)
          throw new UploadSessionError("session_not_found", 404);
        const replacement = current.rows[0]?.isCurrent
          ? await tx.execute<{ id: number }>(
              sql`select id from collection_image where collection_id = ${file.targetId} and id <> ${fileId} order by position desc, id desc limit 1`,
            )
          : null;
        if (fileType === "resource_image" || fileType === "resource_file") {
          const count = await tx.execute<{ count: number }>(
            sql`select count(*)::int as count from ${sql.identifier(mapping.table)} where ${sql.identifier(mapping.column)} = ${fileType === "resource_file" ? file.versionId : file.targetId}`,
          );
          if ((count.rows[0]?.count ?? 0) <= 1)
            throw new UploadSessionError("invalid_request", 400);
        }
        await queueObjectDeletions(tx, [file.objectPath]);
        await tx.execute(
          sql`delete from ${sql.identifier(mapping.table)} where id = ${fileId}`,
        );
        if (replacement?.rows[0])
          await tx.execute(
            sql`update collection_image set is_current = true where id = ${replacement.rows[0].id}`,
          );
        if (fileType === "collection_image")
          await tx.execute(
            sql`update user_collection set updated_at = now() where id = ${file.targetId}`,
          );
        return file.objectPath;
      });
      await cleanupObjectDeletions(db, storage, logger, [objectPath]);
    },
  };
  return {
    snapshotErasureTargets: service.snapshotErasureTargets,
    eraseAccountObjects: service.eraseAccountObjects,
    create: (value: unknown, actor: UploadActor) => {
      const attributes = actorAttributes(actor);
      return loggedMutation(
        logger,
        loggerMessages.database.storage.create,
        () => service.create(value, actor, attributes),
        { attributes },
      );
    },
    upload: (
      sessionId: string,
      fileId: string,
      actor: UploadActor,
      request: Request,
    ) => {
      const attributes = actorAttributes(actor, sessionId);
      attributes.fileIdHash = hashLogIdentifier(fileId);
      return loggedMutation(
        logger,
        loggerMessages.database.storage.upload,
        () => service.upload(sessionId, fileId, actor, request, attributes),
        { attributes },
      );
    },
    completeUpload: (sessionId: string, actor: UploadActor) => {
      const attributes = actorAttributes(actor, sessionId);
      return loggedMutation(
        logger,
        loggerMessages.database.storage.completeUpload,
        () => service.completeUpload(sessionId, actor, attributes),
        { attributes },
      );
    },
    deleteFile: (input: Parameters<typeof service.deleteFile>[0]) => {
      const attributes = actorAttributes(input.actor);
      return loggedMutation(
        logger,
        loggerMessages.database.storage.deleteFile,
        () => service.deleteFile(input, attributes),
        { attributes },
      );
    },
    cleanupExpired: () => {
      const attributes: LogContext = {};
      return loggedMutation(
        logger,
        loggerMessages.database.storage.cleanupExpired,
        () => service.cleanupExpired(attributes),
        { attributes },
      );
    },
  };
}

async function hasSurvivingReference(
  db: Parameters<typeof objectIsAttached>[0],
  objectPath: string,
  targetClerkId: string,
) {
  const result = await db.execute(sql`
    select 1 from (
      select product_image.object_path, null::text as owner_clerk_id,
        true as protected
      from product_image
      union all
      select collection_image.object_path, users.clerk_id, false
      from collection_image
      join user_collection on user_collection.id = collection_image.collection_id
      join users on users.id = user_collection.owner_id
      union all
      select collection_item_image.object_path, users.clerk_id, false
      from collection_item_image
      join collection_item on collection_item.id = collection_item_image.collection_item_id
      join users on users.id = collection_item.owner_id
      union all
      select resource_images.object_path, resources.uploader_clerk_id, false
      from resource_images join resources on resources.id = resource_images.resource_id
      union all
      select resource_files.object_path, resources.uploader_clerk_id, false
      from resource_files
      join resource_versions on resource_versions.id = resource_files.version_id
      join resources on resources.id = resource_versions.resource_id
      union all
      select resource_versions.object_path, resources.uploader_clerk_id, false
      from resource_versions join resources on resources.id = resource_versions.resource_id
      where resource_versions.object_path is not null
      union all
      select resource_versions.archive_object_path, resources.uploader_clerk_id, false
      from resource_versions join resources on resources.id = resource_versions.resource_id
      where resource_versions.archive_object_path is not null
      union all
      select upload_file.object_path, upload_session.uploader_clerk_id, false
      from upload_file join upload_session on upload_session.id = upload_file.session_id
    ) surviving
    where surviving.object_path = ${objectPath}
      and (surviving.protected or surviving.owner_clerk_id <> ${targetClerkId})
    limit 1`);
  return result.rows.length > 0;
}
function actorAttributes(actor: UploadActor, sessionId?: string): LogContext {
  return {
    actorClerkIdHash: hashLogIdentifier(actor.clerkId),
    ...(sessionId ? { sessionIdHash: hashLogIdentifier(sessionId) } : {}),
  };
}
function fileCounts(files: ReadonlyArray<{ kind: "image" | "file" }>) {
  const imageCount = files.filter((file) => file.kind === "image").length;
  return {
    fileCount: files.length,
    imageCount,
    resourceFileCount: files.length - imageCount,
  };
}
export type StorageService = ReturnType<typeof createStorageService>;
async function loadSession(
  db: Pick<Database, "select">,
  id: string,
  clerkId: string,
) {
  const [session] = await db
    .select()
    .from(schema.uploadSession)
    .where(
      and(
        eq(schema.uploadSession.id, id),
        eq(schema.uploadSession.uploaderClerkId, clerkId),
      ),
    )
    .for("update");
  if (!session) throw new UploadSessionError("session_not_found", 404);
  return session;
}
function completion(session: Session) {
  return session.targetType === "resource"
    ? { resourceId: session.targetId, version: session.reservedVersion ?? 1 }
    : { targetId: session.targetId };
}
export function validateManifest(
  manifest: UploadManifest,
  operation?: "create" | "version",
) {
  const files = manifest.files.filter((file) => file.kind === "file"),
    images = manifest.files.filter((file) => file.kind === "image");
  const resource = manifest.target.type === "resource";
  if (
    (!resource && (!manifest.target.id || files.length || manifest.payload)) ||
    (resource &&
      ((operation === "create" && manifest.target.id !== undefined) ||
        (operation === "version" && (!manifest.target.id || images.length)) ||
        files.length < 1 ||
        files.length > maxResourceFiles ||
        (operation === "create" && images.length < 1) ||
        images.length > maxResourceImages))
  )
    throw new UploadSessionError("invalid_request", 400);
  if (
    files.some((file) => file.size > maxResourceFileBytes) ||
    manifest.files.reduce((sum, file) => sum + file.size, 0) >
      (resource ? maxResourceSessionBytes : maxImageSessionBytes)
  )
    throw new UploadSessionError("invalid_request", 400);
  for (const group of [files, images])
    if (
      new Set(group.map((file) => file.sha256)).size !== group.length ||
      new Set(group.map((file) => file.fileName.toLowerCase())).size !==
        group.length
    )
      throw new UploadSessionError("invalid_request", 400);
}
