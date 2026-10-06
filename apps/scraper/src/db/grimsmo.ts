import {
  type Database,
  type GrimsmoKnifeVariationNormalizedData,
  type GrimsmoPenVariationNormalizedData,
  type GrimsmoProductNormalizedData,
  schema,
} from "@package/database";
import { and, eq, inArray, isNull, notInArray } from "drizzle-orm";
import { getGrimsmoSourceDefinition } from "../grimsmo/source.js";
import { hashObject } from "../lib/hash.js";
import {
  type GrimsmoKnifeType,
  type GrimsmoSourceName,
  type NormalizedGrimsmoKnifeVariation,
  type NormalizedGrimsmoPenVariation,
  type NormalizedGrimsmoProduct,
  scraperSources,
} from "../scraper-types.js";
import {
  createTmpProduct,
  ensureTmpProductVariation,
  syncTmpImages,
  type TmpImageUploadJobCandidate,
} from "./images.js";

/**
 * Canonical maker values used to ensure the Grimsmo maker row.
 */
const grimsmoMaker = {
  name: "Grimsmo",
  rootUrl: "https://grimsmoknives.com",
  slug: "grimsmo",
};

/**
 * Scraper source identifiers keyed by Grimsmo knife family.
 */
const grimsmoKnifeSources = {
  fjell: scraperSources.grimsmoFjell,
  norseman: scraperSources.grimsmoNorseman,
  rask: scraperSources.grimsmoRask,
} satisfies Record<GrimsmoKnifeType, GrimsmoSourceName>;

/**
 * Outcome of synchronizing one normalized Grimsmo variation.
 */
export type GrimsmoSyncResult = {
  /**
   * Whether the variation came from the archive source collection.
   */
  archived: boolean;
  /**
   * Whether synchronization inserted a new source record.
   */
  created: boolean;
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
   * Whether synchronization changed normalized details.
   */
  updated: boolean;
  /**
   * Whether synchronization saved a previous-state version.
   */
  versioned: boolean;
};

/**
 * Loads persisted Grimsmo synchronization hashes for selected handles.
 *
 * @param db - Database used for scraper persistence.
 *
 * @param source - Scraper source identifier.
 *
 * @param sourceHandles - Source handles to load from persisted state.
 *
 * @returns Persisted variation hash state for matching handles.
 *
 * @rejects When loading persisted synchronization state fails.
 */
export async function getGrimsmoVariationSyncState(
  db: Database,
  source: GrimsmoSourceName,
  sourceHandles: readonly string[],
) {
  if (sourceHandles.length === 0) {
    return [];
  }

  const definition = getGrimsmoSourceDefinition(source);

  if (definition.kind === "pen") {
    return db
      .select({
        archivedAt: schema.tmpGrimsmoPenVariations.archivedAt,
        detailsHash: schema.tmpGrimsmoPenVariations.detailsHash,
        imageSetHash: schema.tmpGrimsmoPenVariations.imageSetHash,
        parentDetailsHash: schema.tmpGrimsmoPens.detailsHash,
        sourceCollection: schema.tmpGrimsmoPenVariations.sourceCollection,
        sourceHandle: schema.tmpGrimsmoPenVariations.sourceHandle,
      })
      .from(schema.tmpGrimsmoPenVariations)
      .innerJoin(
        schema.tmpGrimsmoPens,
        eq(schema.tmpGrimsmoPenVariations.penId, schema.tmpGrimsmoPens.id),
      )
      .where(
        and(
          eq(schema.tmpGrimsmoPens.productHandle, definition.productHandle),
          inArray(schema.tmpGrimsmoPenVariations.sourceHandle, [
            ...sourceHandles,
          ]),
        ),
      );
  }

  return db
    .select({
      archivedAt: schema.tmpGrimsmoKnifeVariations.archivedAt,
      detailsHash: schema.tmpGrimsmoKnifeVariations.detailsHash,
      imageSetHash: schema.tmpGrimsmoKnifeVariations.imageSetHash,
      parentDetailsHash: schema.tmpGrimsmoKnives.detailsHash,
      sourceCollection: schema.tmpGrimsmoKnifeVariations.sourceCollection,
      sourceHandle: schema.tmpGrimsmoKnifeVariations.sourceHandle,
    })
    .from(schema.tmpGrimsmoKnifeVariations)
    .innerJoin(
      schema.tmpGrimsmoKnives,
      eq(schema.tmpGrimsmoKnifeVariations.knifeId, schema.tmpGrimsmoKnives.id),
    )
    .where(
      and(
        eq(schema.tmpGrimsmoKnives.productHandle, definition.productHandle),
        inArray(schema.tmpGrimsmoKnifeVariations.sourceHandle, [
          ...sourceHandles,
        ]),
      ),
    );
}

/**
 * Upserts one Saga variation and synchronizes versions and images.
 *
 * @param db - Database used for scraper persistence.
 *
 * @param item - Normalized source item to persist or identify.
 *
 * @returns Creation, archive, update, version, and image-job outcomes.
 *
 * @rejects When the database operation fails or a required row cannot be produced.
 */
export async function syncGrimsmoPenVariation(
  db: Database,
  item: NormalizedGrimsmoPenVariation,
): Promise<GrimsmoSyncResult> {
  const pen = await ensureGrimsmoPen(db, item.product);
  const now = new Date();
  const [existing] = await db
    .select()
    .from(schema.tmpGrimsmoPenVariations)
    .where(
      and(
        eq(schema.tmpGrimsmoPenVariations.penId, pen.id),
        eq(schema.tmpGrimsmoPenVariations.sourceHandle, item.sourceHandle),
      ),
    )
    .limit(1);
  const versioned = Boolean(
    existing &&
      (existing.detailsHash !== item.detailsHash ||
        existing.imageSetHash !== item.imageSetHash),
  );
  const productVariation = await ensureTmpProductVariation(db, {
    productId: pen.productId,
    sourceKey: item.sourceHandle,
  });

  if (existing && versioned) {
    await db.insert(schema.tmpGrimsmoPenVariationVersions).values({
      changeReason: getVariationChangeReason(existing, item),
      nextDetailsHash: item.detailsHash,
      nextImageSetHash: item.imageSetHash,
      previousDetailsHash: existing.detailsHash,
      previousImageSetHash: existing.imageSetHash,
      snapshot: existing.normalizedData,
      sourceHandle: existing.sourceHandle,
      variationId: existing.id,
    });
  }

  const nextNormalizedData = getPenVariationNormalizedData(item);
  const nextArchivedAt =
    item.sourceCollection === "archive" ? (existing?.archivedAt ?? now) : null;
  const shouldUpdateVariation = shouldUpdateGrimsmoVariation({
    existing,
    next: {
      archivedAt: nextArchivedAt,
      detailsHash: item.detailsHash,
      imageSetHash: item.imageSetHash,
      sourceCollection: item.sourceCollection,
    },
  });
  const variation =
    existing && !shouldUpdateVariation
      ? existing
      : (
          await db
            .insert(schema.tmpGrimsmoPenVariations)
            .values({
              archivedAt: nextArchivedAt,
              availableForSale: item.availableForSale,
              bodyColors: item.bodyColors,
              bodyFinishes: item.bodyFinishes,
              bodyMaterials: item.bodyMaterials,
              bodyText: item.bodyText,
              book: item.book,
              bullets: item.bullets,
              bulletsByCategory: item.bulletsByCategory,
              case: item.case,
              currencyCode: item.currencyCode,
              description: item.description,
              detailsHash: item.detailsHash,
              engraving: item.engraving,
              imageSetHash: item.imageSetHash,
              normalizedData: nextNormalizedData,
              penId: pen.id,
              priceMaxCents: item.priceMaxCents,
              priceMinCents: item.priceMinCents,
              productVariationId: productVariation.id,
              productUrl: item.productUrl,
              refill: item.refill,
              sagaNumber: item.sagaNumber,
              sliderColors: item.sliderColors,
              sliderMaterials: item.sliderMaterials,
              sliderStyle: item.sliderStyle,
              sourceCollection: item.sourceCollection,
              sourceHandle: item.sourceHandle,
              sourceProductId: item.sourceProductId,
              tags: item.tags,
              tipLogo: item.tipLogo,
              title: item.title,
              titleFull: item.titleFull,
              variants: item.variants,
              visibleBullets: item.visibleBullets,
            })
            .onConflictDoUpdate({
              set: {
                archivedAt: nextArchivedAt,
                availableForSale: item.availableForSale,
                bodyColors: item.bodyColors,
                bodyFinishes: item.bodyFinishes,
                bodyMaterials: item.bodyMaterials,
                bodyText: item.bodyText,
                book: item.book,
                bullets: item.bullets,
                bulletsByCategory: item.bulletsByCategory,
                case: item.case,
                currencyCode: item.currencyCode,
                description: item.description,
                detailsHash: item.detailsHash,
                engraving: item.engraving,
                imageSetHash: item.imageSetHash,
                normalizedData: nextNormalizedData,
                priceMaxCents: item.priceMaxCents,
                priceMinCents: item.priceMinCents,
                productVariationId: productVariation.id,
                productUrl: item.productUrl,
                refill: item.refill,
                sagaNumber: item.sagaNumber,
                sliderColors: item.sliderColors,
                sliderMaterials: item.sliderMaterials,
                sliderStyle: item.sliderStyle,
                sourceCollection: item.sourceCollection,
                sourceProductId: item.sourceProductId,
                tags: item.tags,
                tipLogo: item.tipLogo,
                title: item.title,
                titleFull: item.titleFull,
                updatedAt: now,
                variants: item.variants,
                visibleBullets: item.visibleBullets,
              },
              target: [
                schema.tmpGrimsmoPenVariations.penId,
                schema.tmpGrimsmoPenVariations.sourceHandle,
              ],
            })
            .returning()
        )[0];
  if (!variation) {
    throw new Error(`Failed to upsert Grimsmo pen ${item.sourceHandle}.`);
  }

  const imageJobs = await syncTmpImages(db, {
    images: item.images,
    now,
    productId: pen.productId,
    productVariationId: variation.productVariationId,
  });

  return {
    archived: item.sourceCollection === "archive",
    created: !existing,
    updated: Boolean(existing && existing.detailsHash !== item.detailsHash),
    versioned,
    ...imageJobs,
  };
}

/**
 * Upserts one Grimsmo knife variation and synchronizes versions and images.
 *
 * @param db - Database used for scraper persistence.
 *
 * @param item - Normalized source item to persist or identify.
 *
 * @returns Creation, archive, update, version, and image-job outcomes.
 *
 * @rejects When the database operation fails or a required row cannot be produced.
 */
export async function syncGrimsmoKnifeVariation(
  db: Database,
  item: NormalizedGrimsmoKnifeVariation,
): Promise<GrimsmoSyncResult> {
  const knife = await ensureGrimsmoKnife(db, item.product, item.knifeType);
  const now = new Date();
  const [existing] = await db
    .select()
    .from(schema.tmpGrimsmoKnifeVariations)
    .where(
      and(
        eq(schema.tmpGrimsmoKnifeVariations.knifeId, knife.id),
        eq(schema.tmpGrimsmoKnifeVariations.sourceHandle, item.sourceHandle),
      ),
    )
    .limit(1);
  const versioned = Boolean(
    existing &&
      (existing.detailsHash !== item.detailsHash ||
        existing.imageSetHash !== item.imageSetHash),
  );
  const productVariation = await ensureTmpProductVariation(db, {
    productId: knife.productId,
    sourceKey: item.sourceHandle,
  });

  if (existing && versioned) {
    await db.insert(schema.tmpGrimsmoKnifeVariationVersions).values({
      changeReason: getVariationChangeReason(existing, item),
      nextDetailsHash: item.detailsHash,
      nextImageSetHash: item.imageSetHash,
      previousDetailsHash: existing.detailsHash,
      previousImageSetHash: existing.imageSetHash,
      snapshot: existing.normalizedData,
      sourceHandle: existing.sourceHandle,
      variationId: existing.id,
    });
  }

  const nextNormalizedData = getKnifeVariationNormalizedData(item);
  const nextArchivedAt =
    item.sourceCollection === "archive" ? (existing?.archivedAt ?? now) : null;
  const shouldUpdateVariation = shouldUpdateGrimsmoVariation({
    existing,
    next: {
      archivedAt: nextArchivedAt,
      detailsHash: item.detailsHash,
      imageSetHash: item.imageSetHash,
      sourceCollection: item.sourceCollection,
    },
  });
  const variation =
    existing && !shouldUpdateVariation
      ? existing
      : (
          await db
            .insert(schema.tmpGrimsmoKnifeVariations)
            .values({
              archivedAt: nextArchivedAt,
              availableForSale: item.availableForSale,
              bladeFinishes: item.bladeFinishes,
              bladeSteels: item.bladeSteels,
              bodyText: item.bodyText,
              bullets: item.bullets,
              bulletsByCategory: item.bulletsByCategory,
              case: item.case,
              currencyCode: item.currencyCode,
              description: item.description,
              detailsHash: item.detailsHash,
              handleColors: item.handleColors,
              handleFinishes: item.handleFinishes,
              handleMaterials: item.handleMaterials,
              hardwareColors: item.hardwareColors,
              imageSetHash: item.imageSetHash,
              knifeId: knife.id,
              knifeNumber: item.knifeNumber,
              knifeType: item.knifeType,
              mechanisms: item.mechanisms,
              normalizedData: nextNormalizedData,
              patterns: item.patterns,
              priceMaxCents: item.priceMaxCents,
              priceMinCents: item.priceMinCents,
              productVariationId: productVariation.id,
              productUrl: item.productUrl,
              sourceCollection: item.sourceCollection,
              sourceHandle: item.sourceHandle,
              sourceProductId: item.sourceProductId,
              tags: item.tags,
              title: item.title,
              titleFull: item.titleFull,
              variants: item.variants,
            })
            .onConflictDoUpdate({
              set: {
                archivedAt: nextArchivedAt,
                availableForSale: item.availableForSale,
                bladeFinishes: item.bladeFinishes,
                bladeSteels: item.bladeSteels,
                bodyText: item.bodyText,
                bullets: item.bullets,
                bulletsByCategory: item.bulletsByCategory,
                case: item.case,
                currencyCode: item.currencyCode,
                description: item.description,
                detailsHash: item.detailsHash,
                handleColors: item.handleColors,
                handleFinishes: item.handleFinishes,
                handleMaterials: item.handleMaterials,
                hardwareColors: item.hardwareColors,
                imageSetHash: item.imageSetHash,
                knifeNumber: item.knifeNumber,
                knifeType: item.knifeType,
                mechanisms: item.mechanisms,
                normalizedData: nextNormalizedData,
                patterns: item.patterns,
                priceMaxCents: item.priceMaxCents,
                priceMinCents: item.priceMinCents,
                productVariationId: productVariation.id,
                productUrl: item.productUrl,
                sourceCollection: item.sourceCollection,
                sourceProductId: item.sourceProductId,
                tags: item.tags,
                title: item.title,
                titleFull: item.titleFull,
                updatedAt: now,
                variants: item.variants,
              },
              target: [
                schema.tmpGrimsmoKnifeVariations.knifeId,
                schema.tmpGrimsmoKnifeVariations.sourceHandle,
              ],
            })
            .returning()
        )[0];

  if (!variation) {
    throw new Error(`Failed to upsert Grimsmo knife ${item.sourceHandle}.`);
  }

  const imageJobs = await syncTmpImages(db, {
    images: item.images,
    now,
    productId: knife.productId,
    productVariationId: variation.productVariationId,
  });

  return {
    archived: item.sourceCollection === "archive",
    created: !existing,
    updated: Boolean(existing && existing.detailsHash !== item.detailsHash),
    versioned,
    ...imageJobs,
  };
}

/**
 * Archives missing inventory pen variations after a complete batch.
 *
 * @param db - Database used for scraper persistence.
 *
 * @param input - Complete pen-variation snapshot and expected Grimsmo source.
 *
 * @returns Number of pen variations newly archived.
 *
 * @rejects When the source is not a pen source or reconciliation persistence fails.
 */
export async function reconcileGrimsmoPenVariationBatch(
  db: Database,
  input: {
    /**
     * Normalized pen variations observed in the complete source snapshot.
     */
    items: readonly NormalizedGrimsmoPenVariation[];
    /**
     * Scraper source identifier for the record or job.
     */
    source: GrimsmoSourceName;
  },
) {
  const definition = getGrimsmoSourceDefinition(input.source);

  if (definition.kind !== "pen") {
    throw new Error(`Expected Grimsmo pen source, received ${input.source}.`);
  }

  const pen = await ensureGrimsmoPen(db, {
    detailsHash: "",
    productHandle: definition.productHandle,
    productUrl: `https://grimsmoknives.com/collections/${definition.productHandle}`,
    title: definition.title,
  });
  const inventoryHandles = input.items
    .filter((item) => item.sourceCollection === "inventory")
    .map((item) => item.sourceHandle);

  return archiveMissingPenVariations(db, pen.id, inventoryHandles);
}

/**
 * Archives missing inventory knife variations after a complete batch.
 *
 * @param db - Database used for scraper persistence.
 *
 * @param input - Complete knife-variation snapshot and expected Grimsmo source.
 *
 * @returns Number of knife variations newly archived.
 *
 * @rejects When the source is not a knife source or reconciliation persistence fails.
 */
export async function reconcileGrimsmoKnifeVariationBatch(
  db: Database,
  input: {
    /**
     * Normalized knife variations observed in the complete source snapshot.
     */
    items: readonly NormalizedGrimsmoKnifeVariation[];
    /**
     * Scraper source identifier for the record or job.
     */
    source: GrimsmoSourceName;
  },
) {
  const definition = getGrimsmoSourceDefinition(input.source);

  if (definition.kind !== "knife") {
    throw new Error(`Expected Grimsmo knife source, received ${input.source}.`);
  }

  const knife = await ensureGrimsmoKnife(
    db,
    {
      detailsHash: "",
      productHandle: definition.productHandle,
      productUrl: `https://grimsmoknives.com/collections/${definition.productHandle}`,
      title: definition.title,
    },
    definition.knifeType,
  );
  const inventoryHandles = input.items
    .filter((item) => item.sourceCollection === "inventory")
    .map((item) => item.sourceHandle);

  return archiveMissingKnifeVariations(db, knife.id, inventoryHandles);
}

/**
 * Returns the canonical Grimsmo maker, inserting it when absent.
 *
 * @param db - Database used for scraper persistence.
 *
 * @returns The canonical Grimsmo maker row.
 *
 * @rejects When the database operation fails or a required row cannot be produced.
 */
async function ensureGrimsmoMaker(db: Database) {
  const [maker] = await db
    .insert(schema.maker)
    .values(grimsmoMaker)
    .onConflictDoNothing({
      target: schema.maker.rootUrl,
    })
    .returning();

  const row = maker ?? (await getMakerByRootUrl(db, grimsmoMaker.rootUrl));

  if (!row) {
    throw new Error("Failed to ensure Grimsmo maker.");
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
 * Returns the stable Saga product, inserting or updating it as needed.
 *
 * @param db - Database used for scraper persistence.
 *
 * @param product - Normalized Grimsmo parent product.
 *
 * @returns The ensured Saga product row.
 *
 * @rejects When the database operation fails or a required row cannot be produced.
 */
async function ensureGrimsmoPen(
  db: Database,
  product: NormalizedGrimsmoProduct,
) {
  const maker = await ensureGrimsmoMaker(db);
  const now = new Date();
  const normalizedData = getProductNormalizedData(product);
  const detailsHash =
    product.detailsHash || hashProductNormalizedData(normalizedData);
  const [existing] = await db
    .select()
    .from(schema.tmpGrimsmoPens)
    .where(eq(schema.tmpGrimsmoPens.productHandle, product.productHandle))
    .limit(1);
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
    existingProduct ?? (await createTmpProduct(db, scraperSources.grimsmoSaga));

  if (existing && existing.detailsHash !== detailsHash) {
    await db.insert(schema.tmpGrimsmoPenVersions).values({
      changeReason: "details",
      nextDetailsHash: detailsHash,
      penId: existing.id,
      previousDetailsHash: existing.detailsHash,
      productHandle: existing.productHandle,
      snapshot: existing.normalizedData,
    });
  }

  if (existing && existing.detailsHash === detailsHash) {
    return existing;
  }

  const [pen] = await db
    .insert(schema.tmpGrimsmoPens)
    .values({
      detailsHash,
      makerId: maker.id,
      normalizedData,
      productHandle: product.productHandle,
      productId: tmpProduct.id,
      productUrl: product.productUrl,
      title: product.title,
    })
    .onConflictDoUpdate({
      set: {
        detailsHash,
        makerId: maker.id,
        normalizedData,
        productUrl: product.productUrl,
        title: product.title,
        updatedAt: now,
      },
      target: schema.tmpGrimsmoPens.productHandle,
    })
    .returning();

  if (!pen) {
    throw new Error(`Failed to ensure Grimsmo pen ${product.productHandle}.`);
  }

  return pen;
}

/**
 * Returns the stable Grimsmo knife product, inserting or updating it as needed.
 *
 * @param db - Database used for scraper persistence.
 *
 * @param product - Normalized Grimsmo parent product.
 *
 * @param knifeType - Grimsmo knife family represented by the product.
 *
 * @returns The ensured Grimsmo knife product row.
 *
 * @rejects When the database operation fails or a required row cannot be produced.
 */
async function ensureGrimsmoKnife(
  db: Database,
  product: NormalizedGrimsmoProduct,
  knifeType: GrimsmoKnifeType,
) {
  const maker = await ensureGrimsmoMaker(db);
  const now = new Date();
  const normalizedData = getProductNormalizedData(product);
  const detailsHash =
    product.detailsHash || hashProductNormalizedData(normalizedData);
  const [existing] = await db
    .select()
    .from(schema.tmpGrimsmoKnives)
    .where(eq(schema.tmpGrimsmoKnives.productHandle, product.productHandle))
    .limit(1);
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
    existingProduct ??
    (await createTmpProduct(db, grimsmoKnifeSources[knifeType]));

  if (existing && existing.detailsHash !== detailsHash) {
    await db.insert(schema.tmpGrimsmoKnifeVersions).values({
      changeReason: "details",
      knifeId: existing.id,
      knifeType: existing.knifeType,
      nextDetailsHash: detailsHash,
      previousDetailsHash: existing.detailsHash,
      snapshot: existing.normalizedData,
    });
  }

  if (existing && existing.detailsHash === detailsHash) {
    return existing;
  }

  const [knife] = await db
    .insert(schema.tmpGrimsmoKnives)
    .values({
      detailsHash,
      knifeType,
      makerId: maker.id,
      normalizedData,
      productHandle: product.productHandle,
      productId: tmpProduct.id,
      productUrl: product.productUrl,
      title: product.title,
    })
    .onConflictDoUpdate({
      set: {
        detailsHash,
        knifeType,
        makerId: maker.id,
        normalizedData,
        productHandle: product.productHandle,
        productUrl: product.productUrl,
        title: product.title,
        updatedAt: now,
      },
      target: schema.tmpGrimsmoKnives.productHandle,
    })
    .returning();

  if (!knife) {
    throw new Error(`Failed to ensure Grimsmo knife ${knifeType}.`);
  }

  return knife;
}

/**
 * Archives active pen variations absent from current inventory handles.
 *
 * @param db - Database used for scraper persistence.
 *
 * @param penId - Database identifier for the parent Saga pen.
 *
 * @param inventorySourceHandles - Variation handles present in current inventory.
 *
 * @returns Number of pen variations newly marked archived.
 *
 * @rejects When updating missing pen variations fails.
 */
async function archiveMissingPenVariations(
  db: Database,
  penId: number,
  inventorySourceHandles: readonly string[],
) {
  const now = new Date();
  const where =
    inventorySourceHandles.length > 0
      ? and(
          eq(schema.tmpGrimsmoPenVariations.penId, penId),
          isNull(schema.tmpGrimsmoPenVariations.archivedAt),
          notInArray(schema.tmpGrimsmoPenVariations.sourceHandle, [
            ...inventorySourceHandles,
          ]),
        )
      : and(
          eq(schema.tmpGrimsmoPenVariations.penId, penId),
          isNull(schema.tmpGrimsmoPenVariations.archivedAt),
        );
  const archived = await db
    .update(schema.tmpGrimsmoPenVariations)
    .set({
      archivedAt: now,
      updatedAt: now,
    })
    .where(where)
    .returning({ id: schema.tmpGrimsmoPenVariations.id });

  return archived.length;
}

/**
 * Archives active knife variations absent from current inventory handles.
 *
 * @param db - Database used for scraper persistence.
 *
 * @param knifeId - Database identifier for the parent knife.
 *
 * @param inventorySourceHandles - Variation handles present in current inventory.
 *
 * @returns Number of knife variations newly marked archived.
 *
 * @rejects When updating missing knife variations fails.
 */
async function archiveMissingKnifeVariations(
  db: Database,
  knifeId: number,
  inventorySourceHandles: readonly string[],
) {
  const now = new Date();
  const where =
    inventorySourceHandles.length > 0
      ? and(
          eq(schema.tmpGrimsmoKnifeVariations.knifeId, knifeId),
          isNull(schema.tmpGrimsmoKnifeVariations.archivedAt),
          notInArray(schema.tmpGrimsmoKnifeVariations.sourceHandle, [
            ...inventorySourceHandles,
          ]),
        )
      : and(
          eq(schema.tmpGrimsmoKnifeVariations.knifeId, knifeId),
          isNull(schema.tmpGrimsmoKnifeVariations.archivedAt),
        );
  const archived = await db
    .update(schema.tmpGrimsmoKnifeVariations)
    .set({
      archivedAt: now,
      updatedAt: now,
    })
    .where(where)
    .returning({ id: schema.tmpGrimsmoKnifeVariations.id });

  return archived.length;
}

/**
 * Projects a normalized Grimsmo product into persisted normalized data.
 *
 * @param product - Normalized Grimsmo parent product.
 *
 * @returns Persistable normalized parent-product data.
 */
function getProductNormalizedData(
  product: NormalizedGrimsmoProduct,
): GrimsmoProductNormalizedData {
  return {
    productHandle: product.productHandle,
    productUrl: product.productUrl,
    title: product.title,
  };
}

/**
 * Hashes persisted Grimsmo parent-product normalized data.
 *
 * @param data - Persisted parent-product normalized data to hash.
 *
 * @returns Deterministic normalized-data hash.
 */
function hashProductNormalizedData(data: GrimsmoProductNormalizedData) {
  return hashObject(data);
}

/**
 * Projects a normalized pen variation into persisted normalized data.
 *
 * @param item - Normalized source item to persist or identify.
 *
 * @returns Persistable normalized pen variation data.
 */
function getPenVariationNormalizedData(
  item: NormalizedGrimsmoPenVariation,
): GrimsmoPenVariationNormalizedData {
  return {
    availableForSale: item.availableForSale,
    bodyColors: item.bodyColors,
    bodyFinishes: item.bodyFinishes,
    bodyMaterials: item.bodyMaterials,
    book: item.book,
    bullets: item.bullets,
    bulletsByCategory: item.bulletsByCategory,
    case: item.case,
    description: item.description,
    engraving: item.engraving,
    imageSetHash: item.imageSetHash,
    images: item.images,
    priceMaxCents: item.priceMaxCents,
    priceMinCents: item.priceMinCents,
    productUrl: item.productUrl,
    refill: item.refill,
    sagaNumber: item.sagaNumber,
    sliderColors: item.sliderColors,
    sliderMaterials: item.sliderMaterials,
    sliderStyle: item.sliderStyle,
    tipLogo: item.tipLogo,
    title: item.title,
    titleFull: item.titleFull,
    variants: item.variants,
    visibleBullets: item.visibleBullets,
  };
}

/**
 * Projects a normalized knife variation into persisted normalized data.
 *
 * @param item - Normalized source item to persist or identify.
 *
 * @returns Persistable normalized knife variation data.
 */
function getKnifeVariationNormalizedData(
  item: NormalizedGrimsmoKnifeVariation,
): GrimsmoKnifeVariationNormalizedData {
  return {
    availableForSale: item.availableForSale,
    bladeFinishes: item.bladeFinishes,
    bladeSteels: item.bladeSteels,
    bodyText: item.bodyText,
    bullets: item.bullets,
    bulletsByCategory: item.bulletsByCategory,
    case: item.case,
    description: item.description,
    handleColors: item.handleColors,
    handleFinishes: item.handleFinishes,
    handleMaterials: item.handleMaterials,
    hardwareColors: item.hardwareColors,
    imageSetHash: item.imageSetHash,
    images: item.images,
    knifeNumber: item.knifeNumber,
    knifeType: item.knifeType,
    mechanisms: item.mechanisms,
    patterns: item.patterns,
    priceMaxCents: item.priceMaxCents,
    priceMinCents: item.priceMinCents,
    productUrl: item.productUrl,
    title: item.title,
    titleFull: item.titleFull,
    variants: item.variants,
  };
}

/**
 * Summarizes which Grimsmo variation fields changed.
 *
 * @param existing - Persisted state to compare.
 *
 * @param next - Normalized state proposed for persistence.
 *
 * @returns Stable change-reason label for the differing fields.
 */
function getVariationChangeReason(
  existing: {
    /**
     * Stable hash of normalized non-image details.
     */
    detailsHash: string;
    /**
     * Stable hash of source image identity and ordering.
     */
    imageSetHash: string;
  },
  next: {
    /**
     * Stable hash of normalized non-image details.
     */
    detailsHash: string;
    /**
     * Stable hash of source image identity and ordering.
     */
    imageSetHash: string;
  },
) {
  if (
    existing.detailsHash !== next.detailsHash &&
    existing.imageSetHash !== next.imageSetHash
  ) {
    return "details_and_images";
  }

  if (existing.detailsHash !== next.detailsHash) {
    return "details";
  }

  return "images";
}

/**
 * Checks whether persisted Grimsmo variation state differs from normalized input.
 *
 * @param options - Dependencies and controls for the operation.
 *
 * @returns Whether any persisted comparison field differs.
 */
export function shouldUpdateGrimsmoVariation({
  existing,
  next,
}: {
  /**
   * Persisted state compared with normalized input.
   */
  existing:
    | {
        /**
         * Timestamp when the record was archived, or `null` while active.
         */
        archivedAt: Date | null;
        /**
         * Stable hash of normalized non-image details.
         */
        detailsHash: string;
        /**
         * Stable hash of source image identity and ordering.
         */
        imageSetHash: string;
        /**
         * Collection that supplied the Grimsmo variation.
         */
        sourceCollection: string;
      }
    | undefined;
  /**
   * Normalized state proposed for persistence.
   */
  next: {
    /**
     * Timestamp when the record was archived, or `null` while active.
     */
    archivedAt: Date | null;
    /**
     * Stable hash of normalized non-image details.
     */
    detailsHash: string;
    /**
     * Stable hash of source image identity and ordering.
     */
    imageSetHash: string;
    /**
     * Collection that supplied the Grimsmo variation.
     */
    sourceCollection: string;
  };
}) {
  return (
    !existing ||
    existing.detailsHash !== next.detailsHash ||
    existing.imageSetHash !== next.imageSetHash ||
    existing.sourceCollection !== next.sourceCollection ||
    existing.archivedAt?.getTime() !== next.archivedAt?.getTime()
  );
}
