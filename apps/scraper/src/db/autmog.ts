import {
  createDb,
  type Database,
  type ScraperRun,
  type ScraperRunStats,
  schema,
} from "@package/database";
import { and, eq, inArray, isNull, lt, notInArray } from "drizzle-orm";
import { type NormalizedAutmogPen, scraperSources } from "../scraper-types.js";
import {
  createTmpProduct,
  syncTmpImages,
  type TmpImageUploadJobCandidate,
} from "./images.js";

/**
 * Canonical maker values used to ensure the Autmog maker row.
 */
const autmogMaker = {
  name: "Autmog",
  rootUrl: "https://www.autmog.com",
  slug: "autmog",
};

/**
 * Outcome of synchronizing one normalized Autmog pen.
 */
export type AutmogPenSyncResult = {
  /**
   * Whether synchronization inserted a new source record.
   */
  created: boolean;
  /**
   * Database rows returned by synchronization.
   */
  dbResponse: AutmogPenSyncDbResponse;
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
   * Normalized values supplied to database synchronization.
   */
  mutationInput: AutmogPenSyncMutationInput;
  /**
   * Image upload jobs produced by synchronization.
   */
  uploadImageJobs: TmpImageUploadJobCandidate[];
  /**
   * Whether synchronization changed normalized details.
   */
  updated: boolean;
  /**
   * Whether synchronization saved a previous-state version.
   */
  versioned: boolean;
};

/**
 * Normalized Autmog values written during pen synchronization.
 */
export type AutmogPenSyncMutationInput = {
  /**
   * Normalized source images written during pen synchronization.
   */
  images: {
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
  }[];
  /**
   * Normalized or persisted Autmog pen values.
   */
  pen: {
    /**
     * Whether the source currently reports the product available.
     */
    availableForSale: boolean;
    /**
     * Normalized Autmog body-detail labels.
     */
    bodyDetails: string[];
    /**
     * Normalized Autmog clip style, when recognized.
     */
    clip: string | null;
    /**
     * Currency code for normalized prices.
     */
    currencyCode: string;
    /**
     * Normalized product description, when available.
     */
    description: string | null;
    /**
     * Stable hash of normalized non-image details.
     */
    detailsHash: string;
    /**
     * Normalized Autmog finish, when recognized.
     */
    finish: string | null;
    /**
     * Normalized Autmog grip style, when recognized.
     */
    grip: string | null;
    /**
     * Stable hash of source image identity and ordering.
     */
    imageSetHash: string;
    /**
     * Database identifier for the canonical maker.
     */
    makerId: number;
    /**
     * Normalized material labels associated with the pen.
     */
    materials: string[];
    /**
     * Normalized mechanism label, when recognized.
     */
    mechanism: string | null;
    /**
     * Database identifier for the normalized mechanism, or `null` when none exists.
     */
    mechanismId: number | null;
    /**
     * Normalized Autmog nose style, when recognized.
     */
    nose: string | null;
    /**
     * Maximum normalized variant price in integer cents, or `null` when none is available.
     */
    priceMaxCents: number | null;
    /**
     * Minimum normalized variant price in integer cents, or `null` when none is available.
     */
    priceMinCents: number | null;
    /**
     * Normalized product-type labels.
     */
    productTypes: string[];
    /**
     * Canonical storefront URL for the product.
     */
    productUrl: string;
    /**
     * Normalized pen refill label, when recognized.
     */
    refill: string | null;
    /**
     * Normalized Autmog size, when recognized.
     */
    size: string | null;
    /**
     * Stable storefront handle for the source listing.
     */
    sourceHandle: string;
    /**
     * Stable product identifier supplied by the source.
     */
    sourceProductId: string;
    /**
     * Source-provided product tags.
     */
    tags: string[];
    /**
     * Normalized display title for the product.
     */
    title: string;
  };
};

/**
 * Database rows returned after synchronizing an Autmog pen.
 */
export type AutmogPenSyncDbResponse = {
  /**
   * Image synchronization rows and image job candidates.
   */
  images: {
    /**
     * Database image IDs requiring deletion jobs.
     */
    deleteJobImageIds: number[];
    /**
     * Database image IDs requiring upload jobs.
     */
    uploadJobImageIds: number[];
    /**
     * Image rows returned by the database upsert.
     */
    upserted: {
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
   * Normalized or persisted Autmog pen values.
   */
  pen: {
    /**
     * Stable hash of normalized non-image details.
     */
    detailsHash: string;
    /**
     * Timestamp when the record was archived, or `null` while active.
     */
    archivedAt: Date | null;
    /**
     * Database identifier for the record.
     */
    id: number;
    /**
     * Stable hash of source image identity and ordering.
     */
    imageSetHash: string;
    /**
     * Database identifier for the canonical maker.
     */
    makerId: number;
    /**
     * Stable storefront handle for the source listing.
     */
    sourceHandle: string;
    /**
     * Stable product identifier supplied by the source.
     */
    sourceProductId: string;
    /**
     * Normalized display title for the product.
     */
    title: string;
  };
  /**
   * Parent product values associated with the variation or image.
   */
  product: {
    /**
     * Database identifier for the record.
     */
    id: number;
    /**
     * Scraper source identifier for the record or job.
     */
    source: string;
  };
};

/**
 * Terminal status and optional diagnostics for a scraper run.
 */
export type ScraperRunUpdate = {
  /**
   * Terminal scraper-run error message, when failed.
   */
  errorMessage?: string;
  /**
   * Terminal statistics; omitted values persist as an empty object.
   *
   * @default {}
   */
  stats?: ScraperRunStats;
  /**
   * Current lifecycle status for the record or operation.
   */
  status: "completed" | "failed";
};

/**
 * Loads persisted Autmog synchronization hashes for selected source IDs.
 *
 * @param db - Database used for scraper persistence.
 *
 * @param sourceProductIds - Source product IDs to load from persisted state.
 *
 * @returns Persisted hash state for matching source product IDs.
 *
 * @rejects When loading persisted synchronization state fails.
 */
export async function getAutmogPenSyncState(
  db: Database,
  sourceProductIds: readonly string[],
) {
  if (sourceProductIds.length === 0) {
    return [];
  }

  return db
    .select({
      archivedAt: schema.tmpAutmogPens.archivedAt,
      detailsHash: schema.tmpAutmogPens.detailsHash,
      imageSetHash: schema.tmpAutmogPens.imageSetHash,
      sourceProductId: schema.tmpAutmogPens.sourceProductId,
    })
    .from(schema.tmpAutmogPens)
    .where(
      inArray(schema.tmpAutmogPens.sourceProductId, [...sourceProductIds]),
    );
}

/**
 * Creates the scraper database client for a connection URL.
 *
 * @param databaseUrl - PostgreSQL connection URL.
 *
 * @returns Database client connected through the supplied URL.
 */
export function createScraperDb(databaseUrl: string): Database {
  return createDb({ databaseUrl });
}

/**
 * Creates a uniquely active scraper run after deleting history older than fourteen days
 * and failing matching active runs older than two hours.
 *
 * @param db - Database used for scraper persistence.
 *
 * @param input - Source and job type that form the active-run lock.
 *
 * @returns The newly inserted running scraper-run row.
 *
 * @rejects When a matching run is already active or the database cannot create the run.
 */
export async function startScraperRun(
  db: Database,
  input: {
    /**
     * Scraper job category used for run locking.
     */
    jobType: string;
    /**
     * Scraper source identifier for the record or job.
     */
    source: string;
  },
) {
  await pruneScraperRuns(db);

  const staleBefore = new Date(Date.now() - 2 * 60 * 60 * 1000);

  await db
    .update(schema.scraperRuns)
    .set({
      errorMessage: "Run marked failed after exceeding stale lock threshold.",
      finishedAt: new Date(),
      status: "failed",
    })
    .where(
      and(
        eq(schema.scraperRuns.source, input.source),
        eq(schema.scraperRuns.jobType, input.jobType),
        eq(schema.scraperRuns.status, "running"),
        lt(schema.scraperRuns.startedAt, staleBefore),
      ),
    );

  const [activeRun] = await db
    .select({ id: schema.scraperRuns.id })
    .from(schema.scraperRuns)
    .where(
      and(
        eq(schema.scraperRuns.source, input.source),
        eq(schema.scraperRuns.jobType, input.jobType),
        eq(schema.scraperRuns.status, "running"),
      ),
    )
    .limit(1);

  if (activeRun) {
    throw createScraperRunAlreadyActiveError(input);
  }

  let run: ScraperRun | undefined;
  try {
    [run] = await db
      .insert(schema.scraperRuns)
      .values({
        jobType: input.jobType,
        source: input.source,
        status: "running",
      })
      .returning();
  } catch (error) {
    const databaseError = (
      error && typeof error === "object" && "cause" in error
        ? error.cause
        : error
    ) as {
      /**
       * PostgreSQL error code exposed by a failed query.
       */
      code?: unknown;
      /** PostgreSQL constraint name exposed by a failed query. */
      constraint?: unknown;
    };
    if (
      databaseError.code === "23505" &&
      databaseError.constraint === "scraper_runs_active_source_job_unique"
    ) {
      throw createScraperRunAlreadyActiveError(input);
    }
    throw error;
  }

  if (!run) {
    throw new Error("Failed to create scraper run.");
  }

  return run;
}

/**
 * Builds the concurrency error for an already-running scrape.
 *
 * @param input - Operation-specific normalized values and controls.
 *
 * @returns Concurrency error for the requested run key.
 */
function createScraperRunAlreadyActiveError(input: {
  /**
   * Scraper job category used for run locking.
   */
  jobType: string;
  /**
   * Scraper source identifier for the record or job.
   */
  source: string;
}) {
  return new Error(
    `Scraper run already active for ${input.source}:${input.jobType}.`,
  );
}

/**
 * Deletes scraper-run history older than fourteen days.
 *
 * @param db - Database used for scraper persistence.
 *
 * @param now - Reference time for retention or mutation timestamps.
 *
 * @rejects When deleting expired scraper runs fails.
 */
export async function pruneScraperRuns(db: Database, now = new Date()) {
  const cutoff = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  await db
    .delete(schema.scraperRuns)
    .where(lt(schema.scraperRuns.startedAt, cutoff));
}

/**
 * Persists a scraper run's terminal status, stats, and finish time.
 *
 * @param db - Database used for scraper persistence.
 *
 * @param runId - Database identifier for the scraper run.
 *
 * @param update - Terminal status and optional run diagnostics.
 *
 * @returns The updated scraper-run row.
 *
 * @rejects When the database operation fails or a required row cannot be produced.
 */
export async function finishScraperRun(
  db: Database,
  runId: number,
  update: ScraperRunUpdate,
) {
  const [run] = await db
    .update(schema.scraperRuns)
    .set({
      errorMessage: update.errorMessage,
      finishedAt: new Date(),
      stats: update.stats ?? {},
      status: update.status,
    })
    .where(eq(schema.scraperRuns.id, runId))
    .returning();

  if (!run) {
    throw new Error(`Failed to update scraper run ${runId}.`);
  }

  return run;
}

/**
 * Upserts one Autmog pen, versions changes, and synchronizes related images and taxonomy.
 *
 * @param db - Database used for scraper persistence.
 *
 * @param item - Normalized source item to persist or identify.
 *
 * @returns Creation, update, version, image-job, and database outcomes.
 *
 * @rejects When the database operation fails or a required row cannot be produced.
 */
export async function syncAutmogPen(
  db: Database,
  item: NormalizedAutmogPen,
): Promise<AutmogPenSyncResult> {
  const maker = await ensureAutmogMaker(db);
  const mechanism = await ensureAutmogMechanism(db, item.mechanism);
  const now = new Date();
  const mutationInput = getAutmogPenSyncMutationInput(
    item,
    maker.id,
    mechanism?.id ?? null,
  );
  const [existing] = await db
    .select()
    .from(schema.tmpAutmogPens)
    .where(eq(schema.tmpAutmogPens.sourceProductId, item.sourceProductId))
    .limit(1);
  const versioned = Boolean(
    existing &&
      (existing.detailsHash !== item.detailsHash ||
        existing.imageSetHash !== item.imageSetHash),
  );
  const [existingProduct] = existing
    ? await db
        .select({
          id: schema.tmpProducts.id,
          source: schema.tmpProducts.source,
        })
        .from(schema.tmpProducts)
        .where(eq(schema.tmpProducts.id, existing.productId))
        .limit(1)
    : [];
  const tmpProduct =
    existingProduct ?? (await createTmpProduct(db, scraperSources.autmog));

  if (existing && versioned) {
    await db.insert(schema.tmpAutmogPenVersions).values({
      changeReason: getChangeReason(existing, item),
      nextDetailsHash: item.detailsHash,
      nextImageSetHash: item.imageSetHash,
      penId: existing.id,
      previousDetailsHash: existing.detailsHash,
      previousImageSetHash: existing.imageSetHash,
      sourceProductId: existing.sourceProductId,
      snapshot: existing.normalizedData,
    });
  }

  const [pen] = await db
    .insert(schema.tmpAutmogPens)
    .values({
      availableForSale: item.availableForSale,
      bodyDetails: item.bodyDetails,
      clip: item.clip,
      currencyCode: item.currencyCode,
      description: item.description,
      detailsHash: item.detailsHash,
      finish: item.finish,
      grip: item.grip,
      imageSetHash: item.imageSetHash,
      makerId: maker.id,
      mechanismId: mechanism?.id ?? null,
      normalizedData: item.normalizedData,
      nose: item.nose,
      priceMaxCents: item.priceMaxCents,
      priceMinCents: item.priceMinCents,
      productId: tmpProduct.id,
      productUrl: item.productUrl,
      refill: item.refill,
      size: item.size,
      sourceHandle: item.sourceHandle,
      sourceProductId: item.sourceProductId,
      tags: item.tags,
      title: item.title,
      variants: item.variants,
    })
    .onConflictDoUpdate({
      set: {
        availableForSale: item.availableForSale,
        archivedAt: null,
        bodyDetails: item.bodyDetails,
        clip: item.clip,
        currencyCode: item.currencyCode,
        description: item.description,
        detailsHash: item.detailsHash,
        finish: item.finish,
        grip: item.grip,
        imageSetHash: item.imageSetHash,
        makerId: maker.id,
        mechanismId: mechanism?.id ?? null,
        normalizedData: item.normalizedData,
        nose: item.nose,
        priceMaxCents: item.priceMaxCents,
        priceMinCents: item.priceMinCents,
        productUrl: item.productUrl,
        refill: item.refill,
        size: item.size,
        sourceHandle: item.sourceHandle,
        tags: item.tags,
        title: item.title,
        updatedAt: now,
        variants: item.variants,
      },
      target: schema.tmpAutmogPens.sourceProductId,
    })
    .returning();

  if (!pen) {
    throw new Error(`Failed to upsert Autmog pen ${item.sourceProductId}.`);
  }

  await syncAutmogPenMaterials(db, pen.id, item.materials);

  await syncTmpProductProductTypes(db, tmpProduct.id, item.productTypes);

  const imageSync = await syncTmpImages(db, {
    images: item.images,
    now,
    productId: tmpProduct.id,
    productVariationId: null,
  });

  return {
    created: !existing,
    dbResponse: {
      images: {
        deleteJobImageIds: imageSync.deleteImageJobs.map((job) => job.imageId),
        uploadJobImageIds: imageSync.uploadImageJobs.map((job) => job.imageId),
        upserted: imageSync.upsertedImages,
      },
      pen: {
        detailsHash: pen.detailsHash,
        archivedAt: pen.archivedAt,
        id: pen.id,
        imageSetHash: pen.imageSetHash,
        makerId: pen.makerId,
        sourceHandle: pen.sourceHandle,
        sourceProductId: pen.sourceProductId,
        title: pen.title,
      },
      product: tmpProduct,
    },
    deleteImageJobs: imageSync.deleteImageJobs,
    mutationInput,
    updated: Boolean(existing && existing.detailsHash !== item.detailsHash),
    uploadImageJobs: imageSync.uploadImageJobs,
    versioned,
  };
}

/**
 * Archives active Autmog pens absent from a complete source snapshot.
 *
 * @param db - Database used for scraper persistence.
 *
 * @param seenSourceProductIds - Source product IDs present in the complete snapshot.
 *
 * @returns Number of pens newly marked archived.
 *
 * @rejects When updating the unseen pens fails.
 */
export async function archiveMissingAutmogPens(
  db: Database,
  seenSourceProductIds: readonly string[],
) {
  const now = new Date();
  const where =
    seenSourceProductIds.length > 0
      ? and(
          isNull(schema.tmpAutmogPens.archivedAt),
          notInArray(schema.tmpAutmogPens.sourceProductId, [
            ...seenSourceProductIds,
          ]),
        )
      : isNull(schema.tmpAutmogPens.archivedAt);
  const archived = await db
    .update(schema.tmpAutmogPens)
    .set({
      archivedAt: now,
      updatedAt: now,
    })
    .where(where)
    .returning({ id: schema.tmpAutmogPens.id });

  return archived.length;
}

/**
 * Replaces an Autmog pen's material associations with normalized names.
 *
 * @param db - Database used for scraper persistence.
 *
 * @param penId - Database identifier for the parent pen.
 *
 * @param materialNames - Normalized material names for the pen.
 *
 * @rejects When the database operation fails or a required row cannot be produced.
 */
async function syncAutmogPenMaterials(
  db: Database,
  penId: number,
  materialNames: readonly string[],
) {
  const names = [...new Set(materialNames.map((name) => name.trim()))].filter(
    (name) => name.length > 0,
  );
  const materialRows = [];

  for (const name of names) {
    const slug = slugifyCanonicalName(name);
    const [material] = await db
      .insert(schema.material)
      .values({
        name,
        slug,
      })
      .onConflictDoNothing({
        target: schema.material.slug,
      })
      .returning({
        id: schema.material.id,
      });
    const materialRow =
      material ?? (await getMaterialBySlug(db, slug, `material ${name}`));

    materialRows.push(materialRow);
  }

  await db
    .delete(schema.tmpAutmogPenMaterials)
    .where(eq(schema.tmpAutmogPenMaterials.penId, penId));

  if (materialRows.length === 0) {
    return;
  }

  await db.insert(schema.tmpAutmogPenMaterials).values(
    materialRows.map((material) => ({
      materialId: material.id,
      penId,
    })),
  );
}

/**
 * Returns the normalized mechanism row, inserting it when needed.
 *
 * @param db - Database used for scraper persistence.
 *
 * @param mechanismName - Normalized mechanism name, or `null`.
 *
 * @returns The ensured mechanism row, or `null` when unnamed.
 *
 * @rejects When the database operation fails or a required row cannot be produced.
 */
async function ensureAutmogMechanism(
  db: Database,
  mechanismName: string | null,
) {
  const name = mechanismName?.trim();

  if (!name) {
    return null;
  }

  const slug = slugifyCanonicalName(name);
  const [mechanism] = await db
    .insert(schema.mechanism)
    .values({
      name,
      slug,
    })
    .onConflictDoNothing({
      target: schema.mechanism.slug,
    })
    .returning({
      id: schema.mechanism.id,
    });

  return mechanism ?? (await getMechanismBySlug(db, slug, `mechanism ${name}`));
}

/**
 * Loads the ensured material row for a canonical slug.
 *
 * @param db - Database used for scraper persistence.
 *
 * @param slug - Canonical entity slug.
 *
 * @param label - Human-readable entity label used in failures.
 *
 * @returns The matching material row.
 *
 * @rejects When the database operation fails or a required row cannot be produced.
 */
async function getMaterialBySlug(db: Database, slug: string, label: string) {
  const [material] = await db
    .select({ id: schema.material.id })
    .from(schema.material)
    .where(eq(schema.material.slug, slug))
    .limit(1);

  if (!material) {
    throw new Error(`Failed to ensure ${label}.`);
  }

  return material;
}

/**
 * Loads the ensured mechanism row for a canonical slug.
 *
 * @param db - Database used for scraper persistence.
 *
 * @param slug - Canonical entity slug.
 *
 * @param label - Human-readable entity label used in failures.
 *
 * @returns The matching mechanism row.
 *
 * @rejects When the database operation fails or a required row cannot be produced.
 */
async function getMechanismBySlug(db: Database, slug: string, label: string) {
  const [mechanism] = await db
    .select({ id: schema.mechanism.id })
    .from(schema.mechanism)
    .where(eq(schema.mechanism.slug, slug))
    .limit(1);

  if (!mechanism) {
    throw new Error(`Failed to ensure ${label}.`);
  }

  return mechanism;
}

/**
 * Loads the ensured product-type row for a canonical slug.
 *
 * @param db - Database used for scraper persistence.
 *
 * @param slug - Canonical entity slug.
 *
 * @param label - Human-readable entity label used in failures.
 *
 * @returns The matching product-type row.
 *
 * @rejects When the database operation fails or a required row cannot be produced.
 */
async function getProductTypeBySlug(db: Database, slug: string, label: string) {
  const [productType] = await db
    .select({ id: schema.productType.id })
    .from(schema.productType)
    .where(eq(schema.productType.slug, slug))
    .limit(1);

  if (!productType) {
    throw new Error(`Failed to ensure ${label}.`);
  }

  return productType;
}

/**
 * Replaces a temporary product's product-type associations.
 *
 * @param db - Database used for scraper persistence.
 *
 * @param productId - Database identifier for the parent product.
 *
 * @param productTypeNames - Normalized product-type names for the product.
 *
 * @rejects When the database operation fails or a required row cannot be produced.
 */
async function syncTmpProductProductTypes(
  db: Database,
  productId: number,
  productTypeNames: readonly string[],
) {
  const names = [
    ...new Set(productTypeNames.map((name) => name.trim())),
  ].filter((name) => name.length > 0);
  const productTypeRows = [];

  for (const name of names) {
    const slug = slugifyCanonicalName(name);
    const [productType] = await db
      .insert(schema.productType)
      .values({
        name,
        slug,
      })
      .onConflictDoNothing({
        target: schema.productType.slug,
      })
      .returning({
        id: schema.productType.id,
      });
    const productTypeRow =
      productType ??
      (await getProductTypeBySlug(db, slug, `product type ${name}`));

    productTypeRows.push(productTypeRow);
  }

  await db
    .delete(schema.tmpProductProductTypes)
    .where(eq(schema.tmpProductProductTypes.productId, productId));

  if (productTypeRows.length === 0) {
    return;
  }

  await db.insert(schema.tmpProductProductTypes).values(
    productTypeRows.map((productType) => ({
      productId,
      productTypeId: productType.id,
    })),
  );
}

/**
 * Converts a canonical label into a stable lowercase slug.
 *
 * @param name - Canonical label to convert into a slug.
 *
 * @returns Normalized slug, falling back to `value` when empty.
 */
function slugifyCanonicalName(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "value"
  );
}

/**
 * Returns the canonical Autmog maker, inserting it when absent.
 *
 * @param db - Database used for scraper persistence.
 *
 * @returns The canonical Autmog maker row.
 *
 * @rejects When the database operation fails or a required row cannot be produced.
 */
async function ensureAutmogMaker(db: Database) {
  const [maker] = await db
    .insert(schema.maker)
    .values(autmogMaker)
    .onConflictDoNothing({
      target: schema.maker.rootUrl,
    })
    .returning();

  const row = maker ?? (await getMakerByRootUrl(db, autmogMaker.rootUrl));

  if (!row) {
    throw new Error("Failed to ensure Autmog maker.");
  }

  return row;
}

/**
 * Loads a maker by its canonical root URL.
 *
 * @param db - Database used for scraper persistence.
 *
 * @param rootUrl - Canonical maker root URL.
 *
 * @returns The matching maker row, or `undefined`.
 *
 * @rejects When querying the maker fails.
 */
async function getMakerByRootUrl(db: Database, rootUrl: string) {
  const [maker] = await db
    .select()
    .from(schema.maker)
    .where(eq(schema.maker.rootUrl, rootUrl))
    .limit(1);

  return maker;
}

/**
 * Summarizes which Autmog content hashes changed.
 *
 * @param existing - Persisted state to compare.
 *
 * @param item - Normalized source item to persist or identify.
 *
 * @returns `details`, `images`, both joined by `+`, or `unknown`.
 */
function getChangeReason(
  existing: {
    /**
     * Stable hash of normalized non-image details.
     */
    detailsHash: string;
    /** Stable hash of source image identity and ordering. */
    imageSetHash: string;
  },
  item: NormalizedAutmogPen,
) {
  const changes = [];

  if (existing.detailsHash !== item.detailsHash) {
    changes.push("details");
  }

  if (existing.imageSetHash !== item.imageSetHash) {
    changes.push("images");
  }

  return changes.join("+") || "unknown";
}

/**
 * Projects a normalized Autmog pen into its database mutation payload.
 *
 * @param item - Normalized source item to persist or identify.
 *
 * @param makerId - Database identifier for the canonical maker.
 *
 * @param mechanismId - Database mechanism identifier, or `null`.
 *
 * @returns Database mutation projection for the pen and its images.
 */
function getAutmogPenSyncMutationInput(
  item: NormalizedAutmogPen,
  makerId: number,
  mechanismId: number | null,
): AutmogPenSyncMutationInput {
  return {
    images: item.images.map((image) => ({
      altText: image.altText,
      height: image.height,
      position: image.position,
      sourceHash: image.sourceHash,
      sourceImageId: image.sourceImageId,
      sourceUrl: image.sourceUrl,
      width: image.width,
    })),
    pen: {
      availableForSale: item.availableForSale,
      bodyDetails: item.bodyDetails,
      clip: item.clip,
      currencyCode: item.currencyCode,
      description: item.description,
      detailsHash: item.detailsHash,
      finish: item.finish,
      grip: item.grip,
      imageSetHash: item.imageSetHash,
      makerId,
      materials: item.materials,
      mechanism: item.mechanism,
      mechanismId,
      nose: item.nose,
      priceMaxCents: item.priceMaxCents,
      priceMinCents: item.priceMinCents,
      productTypes: item.productTypes,
      productUrl: item.productUrl,
      refill: item.refill,
      size: item.size,
      sourceHandle: item.sourceHandle,
      sourceProductId: item.sourceProductId,
      tags: item.tags,
      title: item.title,
    },
  };
}
