import { type Database, schema } from "@package/database";
import { and, eq, isNull } from "drizzle-orm";

/**
 * Normalized source-image values used for temporary image synchronization.
 */
export type TmpImageInput = {
  /**
   * Source-provided alternative text, when available.
   */
  altText: string | null;
  /**
   * Image height in pixels, when known.
   */
  height: number | null;
  /**
   * Source-provided image position, with a one-based index fallback.
   */
  position: number;
  /**
   * Stable hash of source image identity metadata.
   */
  sourceHash: string;
  /**
   * Source platform image identifier, when available.
   */
  sourceImageId: string | null;
  /**
   * Original source image URL.
   */
  sourceUrl: string;
  /**
   * Image width in pixels, when known.
   */
  width: number | null;
};

/**
 * Temporary image that requires an upload queue job.
 */
export type TmpImageUploadJobCandidate = {
  /**
   * Database identifier for the temporary image.
   */
  imageId: number;
  /**
   * Stable hash of source image identity metadata.
   */
  sourceHash: string;
};

/**
 * Image rows and follow-up upload or deletion jobs produced by synchronization.
 */
export type TmpImageSyncResult = {
  /**
   * Image deletion jobs produced by synchronization.
   */
  deleteImageJobs: {
    /**
     * Database identifier for the temporary image.
     */
    imageId: number;
  }[];
  /**
   * Image upload jobs produced by synchronization.
   */
  uploadImageJobs: TmpImageUploadJobCandidate[];
  /**
   * Temporary image rows retained after synchronization.
   */
  upsertedImages: {
    /**
     * Source-provided alternative text, when available.
     */
    altText: string | null;
    /**
     * Image height in pixels, when known.
     */
    height: number | null;
    /**
     * Database identifier for the record.
     */
    id: number;
    /**
     * Storage-provider file identifier, when uploaded.
     */
    imageFileId: string | null;
    /**
     * Storage-provider path for the uploaded image.
     */
    imagePath: string | null;
    /**
     * Storage provider that owns the uploaded image.
     */
    imageProvider: string | null;
    /**
     * Public URL for the uploaded image.
     */
    imageUrl: string | null;
    /**
     * Database identifier for the parent temporary product.
     */
    productId: number;
    /**
     * Database variation identifier, or `null` for parent-product images.
     */
    productVariationId: number | null;
    /**
     * Stable hash of source image identity metadata.
     */
    sourceHash: string;
    /**
     * Current lifecycle status for the record or operation.
     */
    status: string;
    /**
     * Image width in pixels, when known.
     */
    width: number | null;
  }[];
};

/**
 * Creates the temporary parent product for a scraper source.
 *
 * @param db - Database used for scraper persistence.
 *
 * @param source - Scraper source identifier.
 *
 * @returns The inserted temporary product row.
 *
 * @rejects When the database operation fails or a required row cannot be produced.
 */
export async function createTmpProduct(db: Database, source: string) {
  const [product] = await db
    .insert(schema.tmpProducts)
    .values({
      source,
    })
    .returning();

  if (!product) {
    throw new Error(`Failed to create tmp product for source ${source}.`);
  }

  return product;
}

/**
 * Returns a temporary product variation, inserting it when absent.
 *
 * @param db - Database used for scraper persistence.
 *
 * @param input - Normalized images, image scope, and shared mutation timestamp.
 *
 * @returns The existing or inserted variation row.
 *
 * @rejects When the database operation fails or a required row cannot be produced.
 */
export async function ensureTmpProductVariation(
  db: Database,
  input: {
    /**
     * Database identifier for the parent temporary product.
     */
    productId: number;
    /**
     * Source-scoped key that identifies a product variation.
     */
    sourceKey: string;
  },
) {
  const [variation] = await db
    .insert(schema.tmpProductVariations)
    .values({
      productId: input.productId,
      sourceKey: input.sourceKey,
    })
    .onConflictDoNothing({
      target: [
        schema.tmpProductVariations.productId,
        schema.tmpProductVariations.sourceKey,
      ],
    })
    .returning();

  const row =
    variation ??
    (await getTmpProductVariation(db, input.productId, input.sourceKey));

  if (!row) {
    throw new Error(
      `Failed to ensure tmp product variation ${input.productId}:${input.sourceKey}.`,
    );
  }

  return row;
}

/**
 * Synchronizes source-image lifecycle state and returns upload or deletion job candidates.
 *
 * @param db - Database used for scraper persistence.
 *
 * @param input - Operation-specific normalized values and controls.
 *
 * @returns Upserted images and required upload or deletion job candidates.
 *
 * @rejects When the database operation fails or a required row cannot be produced.
 */
export async function syncTmpImages(
  db: Database,
  input: {
    /**
     * Normalized source images in caller-provided order.
     */
    images: readonly TmpImageInput[];
    /**
     * Timestamp used consistently for the mutation.
     */
    now: Date;
    /**
     * Database identifier for the parent temporary product.
     */
    productId: number;
    /**
     * Database variation identifier, or `null` for parent-product images.
     */
    productVariationId: number | null;
  },
): Promise<TmpImageSyncResult> {
  const existingImages = await db
    .select()
    .from(schema.tmpImages)
    .where(getTmpImagesScopeWhere(input.productId, input.productVariationId));
  const currentSourceHashes = new Set(
    input.images.map((image) => image.sourceHash),
  );
  const existingBySourceHash = new Map(
    existingImages.map((image) => [image.sourceHash, image]),
  );
  const deleteImageJobs: {
    /**
     * Database identifier for the temporary image.
     */
    imageId: number;
  }[] = [];
  const uploadImageJobs: TmpImageUploadJobCandidate[] = [];
  const upsertedImages: TmpImageSyncResult["upsertedImages"] = [];

  for (const image of input.images) {
    const existingImage = existingBySourceHash.get(image.sourceHash);
    const shouldUpload =
      !existingImage ||
      existingImage.status === "deleted" ||
      existingImage.status === "pending_delete" ||
      existingImage.status === "upload_failed";
    const values = getTmpImageSyncValues({
      image,
      now: input.now,
      productId: input.productId,
      productVariationId: input.productVariationId,
      shouldUpload,
      status: existingImage?.status,
    });

    const [row] = existingImage
      ? isTmpImageSyncNoop(existingImage, values)
        ? [existingImage]
        : await db
            .update(schema.tmpImages)
            .set(values)
            .where(eq(schema.tmpImages.id, existingImage.id))
            .returning()
      : await db.insert(schema.tmpImages).values(values).returning();

    if (!row) {
      throw new Error(`Failed to upsert tmp image ${image.sourceUrl}.`);
    }

    if (shouldUpload) {
      uploadImageJobs.push({
        imageId: row.id,
        sourceHash: image.sourceHash,
      });
    }

    upsertedImages.push({
      altText: row.altText,
      height: row.height,
      id: row.id,
      imageFileId: row.imageFileId,
      imagePath: row.imagePath,
      imageProvider: row.imageProvider,
      imageUrl: row.imageUrl,
      productId: row.productId,
      productVariationId: row.productVariationId,
      sourceHash: row.sourceHash,
      status: row.status,
      width: row.width,
    });
  }

  for (const existingImage of existingImages) {
    if (currentSourceHashes.has(existingImage.sourceHash)) {
      continue;
    }

    if (
      existingImage.status === "pending_delete" &&
      existingImage.pendingDeleteAt
    ) {
      deleteImageJobs.push({ imageId: existingImage.id });
      continue;
    }

    if (existingImage.status === "pending_upload") {
      await markTmpImageDeleted(db, existingImage.id, input.now);
      continue;
    }

    if (existingImage.status !== "deleted") {
      await db
        .update(schema.tmpImages)
        .set({
          pendingDeleteAt: input.now,
          status: "pending_delete",
          updatedAt: input.now,
        })
        .where(eq(schema.tmpImages.id, existingImage.id));
    }
  }

  return {
    deleteImageJobs,
    uploadImageJobs,
    upsertedImages,
  };
}

/**
 * Loads a temporary image with its parent product and optional variation.
 *
 * @param db - Database used for scraper persistence.
 *
 * @param imageId - Database identifier for the temporary image.
 *
 * @returns Image and parent rows, or `null` when missing.
 *
 * @rejects When loading the image or either parent row fails.
 */
export async function getTmpImageForProcessing(db: Database, imageId: number) {
  const [row] = await db
    .select({
      image: schema.tmpImages,
      product: schema.tmpProducts,
      productVariation: schema.tmpProductVariations,
    })
    .from(schema.tmpImages)
    .innerJoin(
      schema.tmpProducts,
      eq(schema.tmpImages.productId, schema.tmpProducts.id),
    )
    .leftJoin(
      schema.tmpProductVariations,
      eq(schema.tmpImages.productVariationId, schema.tmpProductVariations.id),
    )
    .where(eq(schema.tmpImages.id, imageId))
    .limit(1);

  return row ?? null;
}

/**
 * Persists uploaded storage metadata for a temporary image.
 *
 * @param db - Database used for scraper persistence.
 *
 * @param input - Operation-specific normalized values and controls.
 *
 * @returns The updated temporary image row.
 *
 * @rejects When the database operation fails or a required row cannot be produced.
 */
export async function markTmpImageUploaded(
  db: Database,
  input: {
    /**
     * Image height in pixels, when known.
     */
    height: number;
    /**
     * Database identifier for the temporary image.
     */
    imageId: number;
    /**
     * Storage-provider file identifier, when uploaded.
     */
    imageFileId: string;
    /**
     * Storage-provider path for the uploaded image.
     */
    imagePath: string;
    /**
     * Storage provider that owns the uploaded image.
     */
    imageProvider: string;
    /**
     * Public URL for the uploaded image.
     */
    imageUrl: string;
    /**
     * Image width in pixels, when known.
     */
    width: number;
  },
) {
  const now = new Date();
  const [image] = await db
    .update(schema.tmpImages)
    .set({
      height: input.height,
      imageFileId: input.imageFileId,
      imagePath: input.imagePath,
      imageProvider: input.imageProvider,
      imageUrl: input.imageUrl,
      status: "uploaded",
      updatedAt: now,
      uploadedAt: now,
      width: input.width,
    })
    .where(eq(schema.tmpImages.id, input.imageId))
    .returning();

  if (!image) {
    throw new Error(`Failed to mark tmp image ${input.imageId} uploaded.`);
  }

  return image;
}

/**
 * Marks a temporary image deleted at the supplied time.
 *
 * @param db - Database used for scraper persistence.
 *
 * @param imageId - Database identifier for the temporary image.
 *
 * @param now - Reference time for retention or mutation timestamps.
 *
 * @rejects When marking the image deleted fails.
 */
export async function markTmpImageDeleted(
  db: Database,
  imageId: number,
  now = new Date(),
) {
  await db
    .update(schema.tmpImages)
    .set({
      deletedAt: now,
      status: "deleted",
      updatedAt: now,
    })
    .where(eq(schema.tmpImages.id, imageId));
}

/**
 * Persists the failed upload or deletion status for an image.
 *
 * @param db - Database used for scraper persistence.
 *
 * @param input - Image identifier and failed operation status.
 *
 * @rejects When persisting the failure status fails.
 */
export async function markTmpImageFailed(
  db: Database,
  input: {
    /**
     * Database identifier for the temporary image.
     */
    imageId: number;
    /** Failed operation represented by this status. */
    status: "delete_failed" | "upload_failed";
  },
) {
  await db
    .update(schema.tmpImages)
    .set({
      status: input.status,
      updatedAt: new Date(),
    })
    .where(eq(schema.tmpImages.id, input.imageId));
}

/**
 * Builds the image-scope predicate for a product or variation.
 *
 * @param productId - Database identifier for the parent product.
 *
 * @param productVariationId - Database variation identifier, or `null`.
 *
 * @returns Drizzle predicate for the requested image scope.
 */
function getTmpImagesScopeWhere(
  productId: number,
  productVariationId: number | null,
) {
  return productVariationId === null
    ? and(
        eq(schema.tmpImages.productId, productId),
        isNull(schema.tmpImages.productVariationId),
      )
    : and(
        eq(schema.tmpImages.productId, productId),
        eq(schema.tmpImages.productVariationId, productVariationId),
      );
}

/**
 * Loads a temporary product variation by product and source key.
 *
 * @param db - Database used for scraper persistence.
 *
 * @param productId - Database identifier for the parent product.
 *
 * @param sourceKey - Source-scoped variation key.
 *
 * @returns Matching variation row, or `undefined`.
 *
 * @rejects When querying the temporary variation fails.
 */
async function getTmpProductVariation(
  db: Database,
  productId: number,
  sourceKey: string,
) {
  const [variation] = await db
    .select()
    .from(schema.tmpProductVariations)
    .where(
      and(
        eq(schema.tmpProductVariations.productId, productId),
        eq(schema.tmpProductVariations.sourceKey, sourceKey),
      ),
    )
    .limit(1);

  return variation;
}

/**
 * Builds the database values for one synchronized source image.
 *
 * @param options - Dependencies and controls for the operation.
 *
 * @returns Database values for inserting or updating the image.
 */
export function getTmpImageSyncValues({
  image,
  now,
  productId,
  productVariationId,
  shouldUpload,
  status,
}: {
  /**
   * Normalized image values used by synchronization.
   */
  image: TmpImageInput;
  /**
   * Timestamp used consistently for the mutation.
   */
  now: Date;
  /**
   * Database identifier for the parent temporary product.
   */
  productId: number;
  /**
   * Database variation identifier, or `null` for parent-product images.
   */
  productVariationId: number | null;
  /**
   * Whether synchronization requires a new upload job.
   */
  shouldUpload: boolean;
  /**
   * Existing image status; defaults to `pending_upload` when absent.
   *
   * @default pending_upload
   */
  status?: string;
}) {
  return {
    altText: image.altText,
    deletedAt: null,
    height: image.height,
    lastSeenAt: now,
    pendingDeleteAt: null,
    position: image.position,
    productId,
    productVariationId,
    sourceHash: image.sourceHash,
    sourceImageId: image.sourceImageId,
    sourceUrl: image.sourceUrl,
    status: shouldUpload ? "pending_upload" : (status ?? "pending_upload"),
    updatedAt: now,
    width: image.width,
  };
}

/**
 * Checks whether an existing image already matches its next synchronized values.
 *
 * @param existingImage - Persisted temporary image row.
 *
 * @param values - Next synchronized image values.
 *
 * @returns Whether all persisted comparison fields already match.
 */
export function isTmpImageSyncNoop(
  existingImage: {
    /**
     * Source-provided alternative text, when available.
     */
    altText: string | null;
    /**
     * Timestamp when the image was deleted, or `null` otherwise.
     */
    deletedAt: Date | null;
    /**
     * Image height in pixels, when known.
     */
    height: number | null;
    /**
     * Timestamp when image deletion was requested, or `null` when not pending.
     */
    pendingDeleteAt: Date | null;
    /**
     * Source-provided image position, with a one-based index fallback.
     */
    position: number;
    /**
     * Database identifier for the parent temporary product.
     */
    productId: number;
    /**
     * Database variation identifier, or `null` for parent-product images.
     */
    productVariationId: number | null;
    /**
     * Stable hash of source image identity metadata.
     */
    sourceHash: string;
    /**
     * Source platform image identifier, when available.
     */
    sourceImageId: string | null;
    /**
     * Original source image URL.
     */
    sourceUrl: string;
    /**
     * Current lifecycle status for the record or operation.
     */
    status: string;
    /**
     * Image width in pixels, when known.
     */
    width: number | null;
  },
  values: ReturnType<typeof getTmpImageSyncValues>,
) {
  return (
    existingImage.altText === values.altText &&
    existingImage.deletedAt === null &&
    existingImage.height === values.height &&
    existingImage.pendingDeleteAt === null &&
    existingImage.position === values.position &&
    existingImage.productId === values.productId &&
    existingImage.productVariationId === values.productVariationId &&
    existingImage.sourceHash === values.sourceHash &&
    existingImage.sourceImageId === values.sourceImageId &&
    existingImage.sourceUrl === values.sourceUrl &&
    existingImage.status === values.status &&
    existingImage.width === values.width
  );
}
