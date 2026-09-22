import { type Database, schema } from "@package/database";
import {
  maxCatalogImageFileBytes,
  maxCatalogImageFiles,
  maxCatalogImageSessionBytes,
  type ResourceStorage,
  type ResourceUploadMetadata,
} from "@package/resources";
import { and, eq, isNull, lt, max } from "drizzle-orm";

export type CatalogImageTargetType = "collection_item" | "product";
export type CatalogImageActor = { clerkId: string; isAdmin: boolean };

export type CatalogImageUploadInput = {
  files: Array<ResourceUploadMetadata & { sha256: string }>;
  targetId: number;
  targetType: CatalogImageTargetType;
};

type CatalogImageUploadErrorCode =
  | "content_length_mismatch"
  | "content_length_required"
  | "duplicate_active"
  | "duplicate_admin_deleted"
  | "duplicate_owner_deleted"
  | "hash_mismatch"
  | "invalid_request"
  | "session_expired"
  | "session_not_found"
  | "upload_failed";

export class CatalogImageUploadError extends Error {
  constructor(
    readonly code: CatalogImageUploadErrorCode,
    readonly status: 400 | 404 | 409 | 411 | 502,
    readonly imageId?: number,
    readonly sha256?: string,
  ) {
    super(code);
    this.name = "CatalogImageUploadError";
  }
}

export function createCatalogImageUploadSessionsService(input: {
  db: Database;
  now?: () => Date;
  randomUUID?: () => string;
  storage: ResourceStorage;
}) {
  const now = input.now ?? (() => new Date());
  const randomUUID = input.randomUUID ?? crypto.randomUUID.bind(crypto);

  return {
    async cleanupExpired() {
      const expired = await input.db
        .select({
          objectPath: schema.catalogImageUploadFile.objectPath,
          sessionId: schema.catalogImageUploadSession.id,
          uploadedAt: schema.catalogImageUploadFile.uploadedAt,
        })
        .from(schema.catalogImageUploadSession)
        .leftJoin(
          schema.catalogImageUploadFile,
          eq(
            schema.catalogImageUploadFile.sessionId,
            schema.catalogImageUploadSession.id,
          ),
        )
        .where(lt(schema.catalogImageUploadSession.expiresAt, now()));
      const sessionIds = [
        ...new Set(expired.map(({ sessionId }) => sessionId)),
      ];
      for (const file of expired) {
        if (file.objectPath && !file.uploadedAt) {
          await input.storage.delete(file.objectPath);
        }
      }
      for (const sessionId of sessionIds) {
        await input.db
          .delete(schema.catalogImageUploadSession)
          .where(eq(schema.catalogImageUploadSession.id, sessionId));
      }
      return sessionIds.length;
    },

    async complete(sessionId: string, actor: CatalogImageActor) {
      await getSession(input.db, sessionId, actor.clerkId);
      await input.db
        .delete(schema.catalogImageUploadSession)
        .where(eq(schema.catalogImageUploadSession.id, sessionId));
    },

    async create(
      sessionInput: CatalogImageUploadInput,
      actor: CatalogImageActor,
    ) {
      validateManifest(sessionInput);
      await assertCanEditTarget(input.db, sessionInput, actor);
      const imageTable =
        sessionInput.targetType === "product"
          ? schema.productImage
          : schema.collectionItemImage;
      const targetColumn =
        sessionInput.targetType === "product"
          ? schema.productImage.productId
          : schema.collectionItemImage.collectionItemId;
      const existing = await input.db
        .select({
          deletedAt: imageTable.deletedAt,
          deletedByRole: imageTable.deletedByRole,
          id: imageTable.id,
          sha256: imageTable.sha256,
        })
        .from(imageTable)
        .where(eq(targetColumn, sessionInput.targetId));
      for (const file of sessionInput.files) {
        const duplicate = existing.find(({ sha256 }) => sha256 === file.sha256);
        if (!duplicate) continue;
        throw new CatalogImageUploadError(
          duplicate.deletedAt
            ? duplicate.deletedByRole === "admin"
              ? "duplicate_admin_deleted"
              : "duplicate_owner_deleted"
            : "duplicate_active",
          409,
          duplicate.id,
          duplicate.sha256,
        );
      }

      const id = randomUUID();
      const expiresAt = new Date(now().getTime() + 60 * 60 * 1000);
      const createUploadTarget = input.storage.createCatalogImageUploadTarget;
      if (!createUploadTarget) {
        throw new CatalogImageUploadError("upload_failed", 502);
      }
      const uploads = (() => {
        try {
          return sessionInput.files.map((file, position) => ({
            id: randomUUID(),
            position,
            sha256: file.sha256,
            ...createUploadTarget(
              file,
              sessionInput.targetType === "product"
                ? "product"
                : "collection-item",
              sessionInput.targetId,
            ),
          }));
        } catch {
          throw new CatalogImageUploadError("invalid_request", 400);
        }
      })();
      await input.db.insert(schema.catalogImageUploadSession).values({
        collectionItemId:
          sessionInput.targetType === "collection_item"
            ? sessionInput.targetId
            : null,
        expiresAt,
        id,
        productId:
          sessionInput.targetType === "product" ? sessionInput.targetId : null,
        targetType: sessionInput.targetType,
        uploaderClerkId: actor.clerkId,
      });
      try {
        await input.db.insert(schema.catalogImageUploadFile).values(
          uploads.map((file) => ({
            contentType: file.contentType,
            fileName: file.fileName,
            id: file.id,
            objectPath: file.objectPath,
            position: file.position,
            sessionId: id,
            sha256: file.sha256,
            size: file.size,
            url: file.url,
          })),
        );
      } catch (error) {
        await input.db
          .delete(schema.catalogImageUploadSession)
          .where(eq(schema.catalogImageUploadSession.id, id));
        throw error;
      }
      return {
        expiresAt: expiresAt.toISOString(),
        id,
        uploads: uploads.map(({ contentType, fileName, id: fileId, size }) => ({
          contentType,
          fileName,
          id: fileId,
          size,
        })),
      };
    },

    async upload(
      sessionId: string,
      fileId: string,
      actor: CatalogImageActor,
      request: Request,
    ) {
      const [file] = await input.db
        .select({
          collectionItemId: schema.catalogImageUploadSession.collectionItemId,
          contentType: schema.catalogImageUploadFile.contentType,
          expiresAt: schema.catalogImageUploadSession.expiresAt,
          fileName: schema.catalogImageUploadFile.fileName,
          objectPath: schema.catalogImageUploadFile.objectPath,
          position: schema.catalogImageUploadFile.position,
          productId: schema.catalogImageUploadSession.productId,
          sha256: schema.catalogImageUploadFile.sha256,
          size: schema.catalogImageUploadFile.size,
          targetType: schema.catalogImageUploadSession.targetType,
          uploadedAt: schema.catalogImageUploadFile.uploadedAt,
          url: schema.catalogImageUploadFile.url,
        })
        .from(schema.catalogImageUploadFile)
        .innerJoin(
          schema.catalogImageUploadSession,
          eq(
            schema.catalogImageUploadFile.sessionId,
            schema.catalogImageUploadSession.id,
          ),
        )
        .where(
          and(
            eq(schema.catalogImageUploadFile.id, fileId),
            eq(schema.catalogImageUploadFile.sessionId, sessionId),
            eq(schema.catalogImageUploadSession.uploaderClerkId, actor.clerkId),
          ),
        )
        .limit(1);
      if (!file) throw new CatalogImageUploadError("session_not_found", 404);
      if (file.uploadedAt) return;
      if (file.expiresAt <= now()) {
        throw new CatalogImageUploadError("session_expired", 409);
      }
      const targetId = file.productId ?? file.collectionItemId;
      if (targetId === null) {
        throw new CatalogImageUploadError("session_not_found", 404);
      }
      await assertCanEditTarget(
        input.db,
        {
          targetId,
          targetType: file.targetType,
        },
        actor,
      );
      const contentLengthHeader = request.headers.get("content-length");
      if (!contentLengthHeader) {
        throw new CatalogImageUploadError("content_length_required", 411);
      }
      const contentLength = Number(contentLengthHeader);
      if (
        !Number.isSafeInteger(contentLength) ||
        contentLength !== file.size ||
        request.headers.get("content-type") !== file.contentType ||
        !request.body
      ) {
        throw new CatalogImageUploadError("content_length_mismatch", 400);
      }
      const bytes = await request.arrayBuffer();
      const digest = toHex(await crypto.subtle.digest("SHA-256", bytes));
      if (digest !== file.sha256) {
        throw new CatalogImageUploadError("hash_mismatch", 400);
      }
      try {
        const body = new Response(bytes).body;
        if (!body) throw new CatalogImageUploadError("upload_failed", 502);
        await input.storage.uploadStream({
          body,
          contentLength,
          contentType: file.contentType,
          objectPath: file.objectPath,
        });
        const position = await nextPosition(
          input.db,
          file.targetType,
          targetId,
        );
        if (file.targetType === "product") {
          if (file.productId === null) {
            throw new CatalogImageUploadError("session_not_found", 404);
          }
          await input.db.insert(schema.productImage).values({
            contentType: file.contentType,
            fileName: file.fileName,
            objectPath: file.objectPath,
            position,
            productId: file.productId,
            sha256: file.sha256,
            size: file.size,
            uploadedByClerkId: actor.clerkId,
            url: file.url,
          });
        } else {
          if (file.collectionItemId === null) {
            throw new CatalogImageUploadError("session_not_found", 404);
          }
          await input.db.insert(schema.collectionItemImage).values({
            collectionItemId: file.collectionItemId,
            contentType: file.contentType,
            fileName: file.fileName,
            objectPath: file.objectPath,
            position,
            sha256: file.sha256,
            size: file.size,
            uploadedByClerkId: actor.clerkId,
            url: file.url,
          });
        }
        await input.db
          .update(schema.catalogImageUploadFile)
          .set({ uploadedAt: now() })
          .where(eq(schema.catalogImageUploadFile.id, fileId));
      } catch (error) {
        await input.storage.delete(file.objectPath).catch(() => undefined);
        if (error instanceof CatalogImageUploadError) throw error;
        throw new CatalogImageUploadError("upload_failed", 502);
      }
    },
  };
}

export type CatalogImageUploadSessionsService = ReturnType<
  typeof createCatalogImageUploadSessionsService
>;

function validateManifest(input: CatalogImageUploadInput) {
  if (
    !Number.isSafeInteger(input.targetId) ||
    input.targetId <= 0 ||
    input.files.length < 1 ||
    input.files.length > maxCatalogImageFiles ||
    input.files.reduce((total, file) => total + file.size, 0) >
      maxCatalogImageSessionBytes ||
    new Set(input.files.map(({ sha256 }) => sha256)).size !==
      input.files.length ||
    input.files.some(
      (file) =>
        file.size < 1 ||
        file.size > maxCatalogImageFileBytes ||
        !/^[0-9a-f]{64}$/u.test(file.sha256),
    )
  ) {
    throw new CatalogImageUploadError("invalid_request", 400);
  }
}

async function assertCanEditTarget(
  db: Database,
  target: Pick<CatalogImageUploadInput, "targetId" | "targetType">,
  actor: CatalogImageActor,
) {
  if (target.targetType === "product") {
    const [product] = await db
      .select({ ownerClerkId: schema.product.ownerClerkId })
      .from(schema.product)
      .where(eq(schema.product.id, target.targetId))
      .limit(1);
    if (
      !product ||
      (!actor.isAdmin && product.ownerClerkId !== actor.clerkId)
    ) {
      throw new CatalogImageUploadError("session_not_found", 404);
    }
    return;
  }
  const [item] = await db
    .select({ ownerClerkId: schema.user.clerkId })
    .from(schema.collectionItem)
    .innerJoin(schema.user, eq(schema.collectionItem.ownerId, schema.user.id))
    .where(eq(schema.collectionItem.id, target.targetId))
    .limit(1);
  if (!item || (!actor.isAdmin && item.ownerClerkId !== actor.clerkId)) {
    throw new CatalogImageUploadError("session_not_found", 404);
  }
}

async function getSession(db: Database, sessionId: string, clerkId: string) {
  const [session] = await db
    .select()
    .from(schema.catalogImageUploadSession)
    .where(
      and(
        eq(schema.catalogImageUploadSession.id, sessionId),
        eq(schema.catalogImageUploadSession.uploaderClerkId, clerkId),
      ),
    )
    .limit(1);
  if (!session) throw new CatalogImageUploadError("session_not_found", 404);
  return session;
}

async function nextPosition(
  db: Database,
  targetType: CatalogImageTargetType,
  targetId: number,
) {
  const imageTable =
    targetType === "product" ? schema.productImage : schema.collectionItemImage;
  const targetColumn =
    targetType === "product"
      ? schema.productImage.productId
      : schema.collectionItemImage.collectionItemId;
  const [{ position = null } = {}] = await db
    .select({ position: max(imageTable.position) })
    .from(imageTable)
    .where(and(eq(targetColumn, targetId), isNull(imageTable.deletedAt)));
  return (position ?? -1) + 1;
}

function toHex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
