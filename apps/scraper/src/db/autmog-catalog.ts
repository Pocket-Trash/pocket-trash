import { type Database, schema } from "@package/database";
import { slugify } from "@package/services";
import { and, eq, inArray } from "drizzle-orm";
import type {
  NormalizedAutmogPen,
  NormalizedAutmogPenImage,
} from "../scraper-types.js";

/** Stable source-system identity used by Autmog's Shopify catalog. */
const autmogSourceSystem = "shopify";

/** Supported direct compatibility targets emitted by the reviewed normalizer. */
type AutmogCompatibilityTarget =
  | {
      /** Selects a compatibility-group target. */
      kind: "group";
      /** Canonical terminology key for the group. */
      key: string;
    }
  | {
      /** Selects an exact refill-product target. */
      kind: "refill";
      /** Canonical maker slug for the refill. */
      makerSlug: string;
      /** Canonical normalized refill model. */
      normalizedModel: string;
    };

/** One canonical source image that still needs to be uploaded and attached. */
export type CanonicalAutmogImageCandidate = Omit<
  NormalizedAutmogPenImage,
  "sourceImageId"
> & {
  /** Canonical source-listing identifier. */
  listingId: number;
  /** Canonical product identifier. */
  productId: number;
  /** Stable Shopify image identifier. */
  sourceImageId: string;
};

/** Read-only plan or applied result for one normalized Autmog listing. */
export type CanonicalAutmogPenSyncResult = {
  /** Whether the canonical product was created by this operation. */
  created: boolean;
  /** Whether the operation intentionally omitted database writes. */
  dryRun: boolean;
  /** Source images that differ from their canonical mappings. */
  imageCandidates: CanonicalAutmogImageCandidate[];
  /** Canonical listing identifier, absent when a dry run plans a new product. */
  listingId: number | null;
  /** Canonical product identifier, absent when a dry run plans a new product. */
  productId: number | null;
  /** Whether an existing canonical product changed. */
  updated: boolean;
};

/** Uploaded image metadata required by canonical product-image persistence. */
export type CanonicalAutmogUploadedImage = {
  /** Normalized image media type. */
  contentType: string;
  /** Original or generated file name. */
  fileName: string;
  /** Canonical Bunny object path. */
  objectPath: string;
  /** Source image position. */
  position: number;
  /** Exact encoded-byte SHA-256 digest. */
  sha256: string;
  /** Exact encoded byte count. */
  size: number;
  /** Stable Shopify image identifier. */
  sourceImageId: string;
  /** Original Shopify image URL. */
  sourceUrl: string;
  /** Public delivery URL. */
  url: string;
};

/** Canonical lookup IDs required to persist one normalized Autmog Pen. */
type AutmogCatalogLookups = {
  /** Direct compatible target resolved from reviewed source text. */
  compatibility:
    | {
        /** Canonical compatibility-group identifier. */
        targetGroupId: number;
        /** Exact refill target omitted for group compatibility. */
        targetRefillProductId: null;
      }
    | {
        /** Group target omitted for exact-refill compatibility. */
        targetGroupId: null;
        /** Canonical exact refill-product identifier. */
        targetRefillProductId: number;
      }
    | null;
  /** Canonical fixed-finish identifier. */
  finishId: number;
  /** Canonical Autmog maker identifier. */
  makerId: number;
  /** Canonical general-material identifiers. */
  materialIds: number[];
  /** Canonical nose-profile concept identifier. */
  noseConceptId: number | null;
  /** Canonical body-pattern identifier. */
  patternId: number | null;
  /** Canonical Pen product-type identifier. */
  penProductTypeId: number;
};

/** Current canonical state owned by one Autmog source listing. */
type ExistingAutmogCatalogState = {
  /** Existing direct compatible target. */
  compatibility: {
    /** Existing compatibility-group identifier. */
    targetGroupId: number | null;
    /** Existing exact refill-product identifier. */
    targetRefillProductId: number | null;
  } | null;
  /** Existing source-owned product description. */
  description: string | null;
  /** Existing fixed-finish identifier. */
  finishId: number | null;
  /** Existing canonical source-listing identifier. */
  listingId: number;
  /** Existing mutable source-listing URL. */
  listingUrl: string;
  /** Existing sorted general-material identifiers. */
  materialIds: number[];
  /** Existing source-owned product name. */
  name: string;
  /** Existing nose-profile concept identifier. */
  noseConceptId: number | null;
  /** Existing body-pattern identifier. */
  patternId: number | null;
  /** Existing canonical product identifier. */
  productId: number;
  /** Existing canonical product-type identifier. */
  productTypeId: number;
  /** Existing mutable maker product URL. */
  productUrl: string | null;
  /** Existing mutable Shopify handle. */
  sourceHandle: string | null;
};

/**
 * Plans or applies one normalized Autmog listing against canonical Pens storage.
 *
 * Existing products are resolved by Autmog maker, Shopify source system, and
 * Shopify record ID. URL and handle remain mutable source-owned fields.
 *
 * @param db - Canonical application database.
 * @param item - Normalized Autmog source listing.
 * @param options - Dry-run control for read-only planning.
 * @returns Creation, update, identity, and image-candidate results.
 * @rejects When canonical lookup data is absent or persistence fails.
 */
export async function syncCanonicalAutmogPen(
  db: Database,
  item: NormalizedAutmogPen,
  options: {
    /** Whether to report proposed changes without writing them. */
    dryRun?: boolean;
  } = {},
): Promise<CanonicalAutmogPenSyncResult> {
  if (!options.dryRun) await ensureCanonicalFinish(db, item);
  const lookups = await resolveLookups(db, item);
  const existing = await loadExistingState(db, lookups.makerId, item);

  if (!existing) {
    if (options.dryRun) {
      return {
        created: true,
        dryRun: true,
        imageCandidates: [],
        listingId: null,
        productId: null,
        updated: false,
      };
    }
    const created = await createCanonicalPen(db, item, lookups);
    return {
      created: true,
      dryRun: false,
      imageCandidates: item.images.flatMap((image) =>
        image.sourceImageId === null
          ? []
          : [
              {
                ...image,
                listingId: created.listingId,
                productId: created.productId,
                sourceImageId: image.sourceImageId,
              },
            ],
      ),
      ...created,
      updated: false,
    };
  }

  const desired = desiredState(item, lookups);
  const changed = stateChanged(existing, desired);
  const imageCandidates = await loadImageCandidates(db, existing, item.images);

  if (options.dryRun || !changed) {
    return {
      created: false,
      dryRun: Boolean(options.dryRun),
      imageCandidates,
      listingId: existing.listingId,
      productId: existing.productId,
      updated: changed,
    };
  }

  await updateCanonicalPen(db, existing, item, lookups);
  return {
    created: false,
    dryRun: false,
    imageCandidates,
    listingId: existing.listingId,
    productId: existing.productId,
    updated: true,
  };
}

/**
 * Attaches one already-uploaded Autmog image to its canonical product/listing.
 *
 * @param db - Canonical application database.
 * @param input - Stable source identity and uploaded-object metadata.
 * @returns Whether a product image or source mapping changed.
 * @rejects When ownership validation or canonical persistence fails.
 */
export async function syncCanonicalAutmogImage(
  db: Database,
  input: {
    /** Canonical source-listing identifier. */
    listingId: number;
    /** Canonical product identifier. */
    productId: number;
    /** Uploaded object and stable source-image metadata. */
    uploaded: CanonicalAutmogUploadedImage;
  },
): Promise<{
  /** Whether the product image or source mapping changed. */
  changed: boolean;
  /** Canonical product-image identifier. */
  productImageId: number;
}> {
  return await db.transaction(async (tx) => {
    const [mapping] = await tx
      .select({
        productId: schema.productSourceListing.productId,
      })
      .from(schema.productSourceListing)
      .where(
        and(
          eq(schema.productSourceListing.listingId, input.listingId),
          eq(schema.productSourceListing.productId, input.productId),
        ),
      )
      .limit(1);
    if (!mapping)
      throw new Error("Autmog source listing no longer owns product.");

    const [existingImage] = await tx
      .select({ id: schema.productImage.id })
      .from(schema.productImage)
      .where(
        and(
          eq(schema.productImage.productId, input.productId),
          eq(schema.productImage.sha256, input.uploaded.sha256),
        ),
      )
      .limit(1);
    const [productImage] = existingImage
      ? [existingImage]
      : await tx
          .insert(schema.productImage)
          .values({
            contentType: input.uploaded.contentType,
            fileName: input.uploaded.fileName,
            objectPath: input.uploaded.objectPath,
            position: input.uploaded.position,
            productId: input.productId,
            sha256: input.uploaded.sha256,
            size: input.uploaded.size,
            storageOwned: true,
            storageProvider: "bunny",
            url: input.uploaded.url,
          })
          .returning({ id: schema.productImage.id });
    if (!productImage)
      throw new Error("Failed to create Autmog product image.");

    const [sourceImage] = await tx
      .select({
        id: schema.catalogSourceImage.id,
        position: schema.catalogSourceImage.position,
        productImageId: schema.catalogSourceImage.productImageId,
        sourceHash: schema.catalogSourceImage.sourceHash,
        sourceUrl: schema.catalogSourceImage.sourceUrl,
      })
      .from(schema.catalogSourceImage)
      .where(
        and(
          eq(schema.catalogSourceImage.listingId, input.listingId),
          eq(
            schema.catalogSourceImage.sourceImageId,
            input.uploaded.sourceImageId,
          ),
        ),
      )
      .limit(1);
    const mappingChanged =
      sourceImage?.productImageId !== productImage.id ||
      sourceImage?.sourceHash !== input.uploaded.sha256 ||
      sourceImage?.sourceUrl !== input.uploaded.sourceUrl ||
      sourceImage?.position !== input.uploaded.position;

    if (!sourceImage) {
      await tx.insert(schema.catalogSourceImage).values({
        listingId: input.listingId,
        position: input.uploaded.position,
        productImageId: productImage.id,
        sourceHash: input.uploaded.sha256,
        sourceImageId: input.uploaded.sourceImageId,
        sourceUrl: input.uploaded.sourceUrl,
      });
    } else if (mappingChanged) {
      await tx
        .update(schema.catalogSourceImage)
        .set({
          position: input.uploaded.position,
          productImageId: productImage.id,
          sourceHash: input.uploaded.sha256,
          sourceUrl: input.uploaded.sourceUrl,
          updatedAt: new Date(),
        })
        .where(eq(schema.catalogSourceImage.id, sourceImage.id));
    }

    return {
      changed: !existingImage || mappingChanged,
      productImageId: productImage.id,
    };
  });
}

/**
 * Resolves exact canonical lookup rows without inventing taxonomy.
 *
 * @param db - Canonical application database.
 * @param item - Normalized Autmog source listing.
 * @returns Canonical identifiers needed for persistence.
 * @rejects When required taxonomy or compatibility rows are absent.
 */
async function resolveLookups(
  db: Database,
  item: NormalizedAutmogPen,
): Promise<AutmogCatalogLookups> {
  const [maker] = await db
    .select({ id: schema.maker.id })
    .from(schema.maker)
    .where(
      and(eq(schema.maker.slug, "autmog"), eq(schema.maker.name, "Autmog")),
    )
    .limit(1);
  if (!maker) throw new Error("Canonical Autmog maker does not exist.");

  const [penType] = await db
    .select({ id: schema.productType.id })
    .from(schema.productType)
    .where(eq(schema.productType.slug, "pen"))
    .limit(1);
  if (!penType) throw new Error("Canonical Pen product type does not exist.");

  const materialSlugs = canonicalMaterialSlugs(item.materials);
  if (materialSlugs.length === 0)
    throw new Error(
      `Autmog ${item.sourceProductId} has no canonical material.`,
    );
  const materials = await db
    .select({ id: schema.material.id, slug: schema.material.slug })
    .from(schema.material)
    .where(inArray(schema.material.slug, materialSlugs));
  const materialBySlug = new Map(materials.map((row) => [row.slug, row.id]));
  const missingMaterial = materialSlugs.find(
    (slug) => !materialBySlug.has(slug),
  );
  if (missingMaterial)
    throw new Error(`Canonical material ${missingMaterial} does not exist.`);

  const finishSlug = canonicalFinish(item).slug;
  const [finish] = await db
    .select({ id: schema.finish.id })
    .from(schema.finish)
    .where(eq(schema.finish.slug, finishSlug))
    .limit(1);
  if (!finish)
    throw new Error(`Canonical finish ${finishSlug} does not exist.`);

  const patternSlug = item.bodyDetails.includes("grip lines")
    ? "grip-lines"
    : null;
  const [pattern] = patternSlug
    ? await db
        .select({ id: schema.pattern.id })
        .from(schema.pattern)
        .where(eq(schema.pattern.slug, patternSlug))
        .limit(1)
    : [];
  if (patternSlug && !pattern)
    throw new Error(`Canonical pattern ${patternSlug} does not exist.`);

  const noseKey = canonicalNoseKey(item.nose);
  const [nose] = noseKey
    ? await db
        .select({ id: schema.catalogTerminologyConcept.id })
        .from(schema.catalogTerminologyConcept)
        .where(
          and(
            eq(schema.catalogTerminologyConcept.namespace, "pen-nose-profile"),
            eq(schema.catalogTerminologyConcept.key, noseKey),
          ),
        )
        .limit(1)
    : [];
  if (noseKey && !nose)
    throw new Error(`Canonical nose profile ${noseKey} does not exist.`);

  return {
    compatibility: await resolveCompatibility(db, item),
    finishId: finish.id,
    makerId: maker.id,
    materialIds: materialSlugs.map((slug) => {
      const materialId = materialBySlug.get(slug);
      if (materialId === undefined)
        throw new Error(`Canonical material ${slug} does not exist.`);
      return materialId;
    }),
    noseConceptId: nose?.id ?? null,
    patternId: pattern?.id ?? null,
    penProductTypeId: penType.id,
  };
}

/**
 * Resolves reviewed group or exact-refill compatibility.
 *
 * @param db - Canonical application database.
 * @param item - Normalized Autmog source listing.
 * @returns The compatible target, or `null` when compatibility is unknown.
 * @rejects When the reviewed target is absent from the canonical catalog.
 */
async function resolveCompatibility(
  db: Database,
  item: NormalizedAutmogPen,
): Promise<AutmogCatalogLookups["compatibility"]> {
  const target = compatibilityTarget(item);
  if (!target) return null;
  if (target.kind === "group") {
    const [group] = await db
      .select({ id: schema.refillCompatibilityGroup.id })
      .from(schema.refillCompatibilityGroup)
      .innerJoin(
        schema.catalogTerminologyConcept,
        eq(
          schema.refillCompatibilityGroup.conceptId,
          schema.catalogTerminologyConcept.id,
        ),
      )
      .where(
        and(
          eq(
            schema.catalogTerminologyConcept.namespace,
            "refill-compatibility-group",
          ),
          eq(schema.catalogTerminologyConcept.key, target.key),
        ),
      )
      .limit(1);
    if (!group)
      throw new Error(`Canonical refill group ${target.key} does not exist.`);
    return { targetGroupId: group.id, targetRefillProductId: null };
  }

  const [refill] = await db
    .select({ id: schema.productDetailRefill.id })
    .from(schema.productDetailRefill)
    .innerJoin(
      schema.maker,
      eq(schema.productDetailRefill.makerId, schema.maker.id),
    )
    .where(
      and(
        eq(schema.maker.slug, target.makerSlug),
        eq(schema.productDetailRefill.normalizedModel, target.normalizedModel),
      ),
    )
    .limit(1);
  if (!refill)
    throw new Error(
      `Canonical refill ${target.makerSlug}:${target.normalizedModel} does not exist.`,
    );
  return { targetGroupId: null, targetRefillProductId: refill.id };
}

/**
 * Loads one unambiguous source-owned canonical product and its relationships.
 *
 * @param db - Canonical application database.
 * @param makerId - Canonical Autmog maker identifier.
 * @param item - Normalized Autmog source listing.
 * @returns Existing source-owned state, or `null` for a new Shopify identity.
 * @rejects When source identity or scraper-owned facts are ambiguous.
 */
async function loadExistingState(
  db: Database,
  makerId: number,
  item: NormalizedAutmogPen,
): Promise<ExistingAutmogCatalogState | null> {
  const listings = await db
    .select({
      description: schema.product.description,
      listingId: schema.catalogSourceListing.id,
      listingUrl: schema.catalogSourceListing.listingUrl,
      name: schema.product.name,
      productId: schema.product.id,
      productTypeId: schema.product.productTypeId,
      productUrl: schema.product.makerProductUrl,
      sourceHandle: schema.catalogSourceListing.sourceHandle,
    })
    .from(schema.catalogSourceListing)
    .innerJoin(
      schema.productSourceListing,
      eq(schema.catalogSourceListing.id, schema.productSourceListing.listingId),
    )
    .innerJoin(
      schema.product,
      eq(schema.productSourceListing.productId, schema.product.id),
    )
    .where(
      and(
        eq(schema.catalogSourceListing.makerId, makerId),
        eq(schema.catalogSourceListing.sourceSystem, autmogSourceSystem),
        eq(schema.catalogSourceListing.sourceRecordId, item.sourceProductId),
      ),
    );
  if (listings.length > 1)
    throw new Error(
      `Autmog ${item.sourceProductId} has ambiguous source identity.`,
    );
  const listing = listings[0];
  if (!listing) return null;

  const [materials, appearances, noses, compatibility] = await Promise.all([
    db
      .select({ materialId: schema.productMaterial.materialId })
      .from(schema.productMaterial)
      .where(eq(schema.productMaterial.productId, listing.productId)),
    db
      .select({
        finishId: schema.finishOptionFinish.finishId,
        patternId: schema.finishOption.patternId,
      })
      .from(schema.finishOption)
      .leftJoin(
        schema.finishOptionFinish,
        eq(schema.finishOption.id, schema.finishOptionFinish.finishOptionId),
      )
      .where(eq(schema.finishOption.productId, listing.productId)),
    db
      .select({ conceptId: schema.penNoseProfileAssignment.conceptId })
      .from(schema.penNoseProfileAssignment)
      .where(eq(schema.penNoseProfileAssignment.productId, listing.productId)),
    db
      .select({
        targetGroupId: schema.refillCompatibilityAssertion.targetGroupId,
        targetRefillProductId:
          schema.refillCompatibilityAssertion.targetRefillProductId,
      })
      .from(schema.refillCompatibilityAssertion)
      .where(
        eq(schema.refillCompatibilityAssertion.penProductId, listing.productId),
      ),
  ]);
  if (appearances.length > 1 || noses.length > 1 || compatibility.length > 1)
    throw new Error(
      `Autmog ${item.sourceProductId} has ambiguous canonical facts.`,
    );
  return {
    ...listing,
    compatibility: compatibility[0] ?? null,
    finishId: appearances[0]?.finishId ?? null,
    materialIds: materials.map((row) => row.materialId).sort((a, b) => a - b),
    noseConceptId: noses[0]?.conceptId ?? null,
    patternId: appearances[0]?.patternId ?? null,
  };
}

/**
 * Creates one canonical Autmog Pen and all source-owned relationships.
 *
 * @param db - Canonical application database.
 * @param item - Normalized Autmog source listing.
 * @param lookups - Prevalidated canonical relationship identifiers.
 * @returns Canonical product and source-listing identifiers.
 * @rejects When any transactional insert fails.
 */
async function createCanonicalPen(
  db: Database,
  item: NormalizedAutmogPen,
  lookups: AutmogCatalogLookups,
): Promise<{
  /** Created canonical source-listing identifier. */
  listingId: number;
  /** Created canonical product identifier. */
  productId: number;
}> {
  return await db.transaction(async (tx) => {
    const [product] = await tx
      .insert(schema.product)
      .values({
        description: item.description,
        makerId: lookups.makerId,
        makerProductUrl: item.productUrl,
        makerProductUrlValid: true,
        name: item.title,
        productTypeId: lookups.penProductTypeId,
        slug: item.sourceHandle,
      })
      .returning({ id: schema.product.id });
    if (!product) throw new Error("Failed to create canonical Autmog product.");
    await tx.insert(schema.productDetailPen).values({ id: product.id });
    const [listing] = await tx
      .insert(schema.catalogSourceListing)
      .values({
        listingUrl: item.productUrl,
        makerId: lookups.makerId,
        sourceHandle: item.sourceHandle,
        sourceRecordId: item.sourceProductId,
        sourceSystem: autmogSourceSystem,
      })
      .returning({ id: schema.catalogSourceListing.id });
    if (!listing) throw new Error("Failed to create canonical Autmog listing.");
    await tx.insert(schema.productSourceListing).values({
      listingId: listing.id,
      productId: product.id,
    });
    await replaceSourceOwnedFacts(tx, product.id, lookups);
    return { listingId: listing.id, productId: product.id };
  });
}

/**
 * Updates only source-owned facts for one existing canonical Autmog Pen.
 *
 * @param db - Canonical application database.
 * @param existing - Current source-owned canonical state.
 * @param item - Normalized Autmog source listing.
 * @param lookups - Prevalidated canonical relationship identifiers.
 * @rejects When the transactional update fails.
 */
async function updateCanonicalPen(
  db: Database,
  existing: ExistingAutmogCatalogState,
  item: NormalizedAutmogPen,
  lookups: AutmogCatalogLookups,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(schema.product)
      .set({
        description: item.description,
        makerProductUrl: item.productUrl,
        makerProductUrlValid: true,
        name: item.title,
        updatedAt: new Date(),
      })
      .where(eq(schema.product.id, existing.productId));
    await tx
      .update(schema.catalogSourceListing)
      .set({
        listingUrl: item.productUrl,
        sourceHandle: item.sourceHandle,
        updatedAt: new Date(),
      })
      .where(eq(schema.catalogSourceListing.id, existing.listingId));
    await replaceSourceOwnedFacts(tx, existing.productId, lookups);
  });
}

/**
 * Replaces the exact source-owned relationships for an Autmog Pen.
 *
 * @param tx - Active canonical catalog transaction.
 * @param productId - Canonical Autmog product identifier.
 * @param lookups - Prevalidated canonical relationship identifiers.
 * @rejects When any replacement write fails.
 */
async function replaceSourceOwnedFacts(
  tx: Parameters<Parameters<Database["transaction"]>[0]>[0],
  productId: number,
  lookups: AutmogCatalogLookups,
): Promise<void> {
  await tx
    .delete(schema.refillCompatibilityAssertion)
    .where(eq(schema.refillCompatibilityAssertion.penProductId, productId));
  await tx
    .delete(schema.penNoseProfileAssignment)
    .where(eq(schema.penNoseProfileAssignment.productId, productId));
  await tx
    .delete(schema.finishOption)
    .where(eq(schema.finishOption.productId, productId));
  await tx
    .delete(schema.productMaterial)
    .where(eq(schema.productMaterial.productId, productId));

  await tx
    .insert(schema.productMaterial)
    .values(
      lookups.materialIds.map((materialId) => ({ materialId, productId })),
    );
  const [appearance] = await tx
    .insert(schema.finishOption)
    .values({ patternId: lookups.patternId, position: 0, productId })
    .returning({ id: schema.finishOption.id });
  if (!appearance) throw new Error("Failed to create Autmog appearance.");
  await tx.insert(schema.finishOptionFinish).values({
    finishId: lookups.finishId,
    finishOptionId: appearance.id,
    position: 0,
  });
  if (lookups.noseConceptId !== null)
    await tx.insert(schema.penNoseProfileAssignment).values({
      conceptId: lookups.noseConceptId,
      productId,
    });
  if (lookups.compatibility)
    await tx.insert(schema.refillCompatibilityAssertion).values({
      penProductId: productId,
      ...lookups.compatibility,
    });
}

/**
 * Finds source images whose canonical mappings are absent or changed.
 *
 * @param db - Canonical application database.
 * @param existing - Canonical listing and product identity.
 * @param images - Normalized Shopify images to compare.
 * @returns Upload candidates with stable canonical ownership.
 * @rejects When source-image mappings cannot be read.
 */
async function loadImageCandidates(
  db: Database,
  existing: Pick<ExistingAutmogCatalogState, "listingId" | "productId">,
  images: readonly NormalizedAutmogPenImage[],
): Promise<CanonicalAutmogImageCandidate[]> {
  const sourceIds = images.flatMap((image) =>
    image.sourceImageId === null ? [] : [image.sourceImageId],
  );
  const mappings = sourceIds.length
    ? await db
        .select({
          position: schema.catalogSourceImage.position,
          sourceImageId: schema.catalogSourceImage.sourceImageId,
          sourceUrl: schema.catalogSourceImage.sourceUrl,
        })
        .from(schema.catalogSourceImage)
        .where(
          and(
            eq(schema.catalogSourceImage.listingId, existing.listingId),
            inArray(schema.catalogSourceImage.sourceImageId, sourceIds),
          ),
        )
    : [];
  const byId = new Map(mappings.map((row) => [row.sourceImageId, row]));
  return images.flatMap((image) => {
    if (image.sourceImageId === null) return [];
    const mapped = byId.get(image.sourceImageId);
    if (
      mapped?.sourceUrl === image.sourceUrl &&
      mapped.position === image.position
    )
      return [];
    return [
      {
        ...image,
        listingId: existing.listingId,
        productId: existing.productId,
        sourceImageId: image.sourceImageId,
      },
    ];
  });
}

/**
 * Selects the source-owned desired state used for idempotence checks.
 *
 * @param item - Normalized Autmog source listing.
 * @param lookups - Prevalidated canonical relationship identifiers.
 * @returns Comparable desired canonical state.
 */
function desiredState(
  item: NormalizedAutmogPen,
  lookups: AutmogCatalogLookups,
) {
  return {
    compatibility: lookups.compatibility,
    description: item.description,
    finishId: lookups.finishId,
    listingUrl: item.productUrl,
    materialIds: [...lookups.materialIds].sort((a, b) => a - b),
    name: item.title,
    noseConceptId: lookups.noseConceptId,
    patternId: lookups.patternId,
    productTypeId: lookups.penProductTypeId,
    productUrl: item.productUrl,
    sourceHandle: item.sourceHandle,
  };
}

/**
 * Returns whether source-owned canonical facts differ from normalized input.
 *
 * @param existing - Current canonical state.
 * @param desired - Desired state derived from the source listing.
 * @returns Whether an update transaction is required.
 */
function stateChanged(
  existing: ExistingAutmogCatalogState,
  desired: ReturnType<typeof desiredState>,
): boolean {
  return (
    existing.description !== desired.description ||
    existing.finishId !== desired.finishId ||
    existing.listingUrl !== desired.listingUrl ||
    existing.name !== desired.name ||
    existing.noseConceptId !== desired.noseConceptId ||
    existing.patternId !== desired.patternId ||
    existing.productTypeId !== desired.productTypeId ||
    existing.productUrl !== desired.productUrl ||
    existing.sourceHandle !== desired.sourceHandle ||
    JSON.stringify(existing.materialIds) !==
      JSON.stringify(desired.materialIds) ||
    (existing.compatibility?.targetGroupId ?? null) !==
      (desired.compatibility?.targetGroupId ?? null) ||
    (existing.compatibility?.targetRefillProductId ?? null) !==
      (desired.compatibility?.targetRefillProductId ?? null)
  );
}

/**
 * Maps normalized material labels onto existing canonical general materials.
 *
 * @param materials - Source material labels.
 * @returns Unique canonical general-material slugs.
 */
function canonicalMaterialSlugs(materials: readonly string[]): string[] {
  return [
    ...new Set(
      materials.flatMap((material) => {
        const normalized = material.toLowerCase();
        if (normalized.includes("titanium")) return ["titanium"];
        if (normalized.includes("aluminum") || normalized.includes("aluminium"))
          return ["aluminum"];
        if (normalized.includes("brass")) return ["brass"];
        if (normalized.includes("bronze")) return ["bronze"];
        if (normalized.includes("copper")) return ["copper"];
        if (normalized.includes("stainless") || normalized === "steel")
          return ["stainless-steel"];
        if (normalized.includes("ultem")) return ["ultem"];
        if (normalized.includes("zirconium") || normalized === "zirc")
          return ["zirconium"];
        return [];
      }),
    ),
  ];
}

/**
 * Maps reviewed Autmog source text to one fixed canonical finish.
 *
 * @param item - Normalized Autmog source listing.
 * @returns The KVR or default machine-finish slug.
 */
function canonicalFinish(item: NormalizedAutmogPen): {
  /** Canonical display name. */
  name: string;
  /** Canonical URL-safe identity. */
  slug: string;
} {
  const source = `${item.title} ${item.description ?? ""}`;
  if (/\bkvr\b/iu.test(source)) return { name: "KVR", slug: "kvr" };

  const name = item.finish?.trim();
  if (name) {
    const finishSlug = slugify(name);
    if (finishSlug)
      return {
        name: name.charAt(0).toUpperCase() + name.slice(1),
        slug: finishSlug,
      };
  }

  return { name: "Machine finish", slug: "machine-finish" };
}

/**
 * Creates a source-derived finish before resolving canonical relationships.
 *
 * @param db - Canonical application database.
 * @param item - Normalized Autmog source listing.
 * @returns Completion after the finish exists or a concurrent insert wins.
 * @rejects When the finish cannot be inserted or resolved.
 */
async function ensureCanonicalFinish(
  db: Database,
  item: NormalizedAutmogPen,
): Promise<void> {
  await db
    .insert(schema.finish)
    .values(canonicalFinish(item))
    .onConflictDoNothing();
}

/**
 * Maps normalized nose wording onto the approved canonical concept keys.
 *
 * @param value - Normalized source nose label.
 * @returns Canonical nose-profile key, or `null` when unresolved.
 */
function canonicalNoseKey(value: string | null): string | null {
  if (value === "cone") return "conical";
  if (value === "round") return "round";
  if (value === "step") return "step";
  return null;
}

/**
 * Applies the approved Autmog refill-target normalizer without evidence rows.
 *
 * @param item - Normalized Autmog source listing.
 * @returns Reviewed direct compatibility target, or `null` when unknown.
 */
function compatibilityTarget(
  item: NormalizedAutmogPen,
): AutmogCompatibilityTarget | null {
  const value = `${item.title} ${item.description ?? ""}`;
  if (
    ["7426342486203", "7444415742139", "7455381651643"].includes(
      item.sourceProductId,
    )
  )
    return { kind: "group", key: "parker-g2" };
  if (item.sourceProductId === "7357869162683")
    return { kind: "group", key: "pilot-g2-standard" };
  if (item.sourceProductId === "7649912520891" || /energel/iu.test(value))
    return { kind: "group", key: "energel" };
  if (/sxr-?5/iu.test(value))
    return { kind: "group", key: "jetstream-sxr-full-size" };
  if (/umr-83/iu.test(value))
    return { kind: "refill", makerSlug: "uni-ball", normalizedModel: "umr-83" };
  if (/ohto\s*c-30[57]|schmidt.*p812[67]/iu.test(value)) return null;
  if (/parker|iso\s*g2|easy\s*flow|p812[67]/iu.test(value))
    return { kind: "group", key: "parker-g2" };
  if (/pilot\s*g2|rollerball/iu.test(value))
    return { kind: "group", key: "pilot-g2-standard" };
  return null;
}
