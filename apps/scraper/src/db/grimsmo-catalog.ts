import { type Database, schema } from "@package/database";
import { slugify } from "@package/services";
import { and, eq, inArray, sql } from "drizzle-orm";
import type {
  SagaCatalogAppearance,
  SagaCatalogImage,
  SagaCatalogSnapshot,
} from "../scraper-types.js";

/** Maximum canonical appearance choices retained for the Saga. */
const sagaAppearanceLimit = 100;

/** Maximum active canonical product images retained for the Saga. */
const sagaImageLimit = 30;

/** Stable source-system identity used by the Grimsmo Shopify catalog. */
const sagaSourceSystem = "shopify";

/** Display colors for every normalized Saga color emitted by the parser. */
const sagaColorHex = {
  Black: "#000000",
  Blue: "#2563EB",
  Blurple: "#5865F2",
  Bronze: "#CD7F32",
  Copper: "#B87333",
  Gold: "#D4AF37",
  Green: "#16A34A",
  Pink: "#EC4899",
  Plum: "#8E4585",
  Purple: "#9333EA",
  Raw: "#A8A29E",
  Red: "#DC2626",
  "Silver/Grey": "#A0A0A0",
} as const;

/** Options controlling canonical Saga material synchronization. */
export type SyncCanonicalSagaMaterialsOptions = {
  /** Whether to report the planned assignments without writing them. */
  dryRun?: boolean;
};

/** Outcome of reconciling source material names with the canonical Saga Pen. */
export type CanonicalSagaMaterialSyncResult = {
  /** Canonical material names that were already assigned. */
  existingMaterialNames: string[];
  /** Canonical material names newly assigned, or planned in dry-run mode. */
  newMaterialNames: string[];
  /** Canonical Saga product identifier. */
  productId: number;
  /** Source material names that could not be resolved to canonical rows. */
  unresolvedMaterialNames: string[];
};

/** Stable catalog identity established by the approved Saga seed manifest. */
const sagaIdentity = {
  makerSlug: "grimsmo",
  productSlug: "saga",
};

/**
 * Adds newly observed source materials to the canonical Grimsmo Saga Pen.
 *
 * Existing assignments are never removed, and unresolved names never create
 * lookup rows. Material-specific names resolve to their canonical parent and
 * preserve the specific material on the product assignment.
 *
 * @param db - Database containing the seeded canonical Pens catalog.
 * @param sourceMaterialNames - Normalized material labels observed in the feed.
 * @param options - Dry-run control for the reconciliation.
 * @returns Added, existing, and unresolved canonical material names.
 * @rejects When the seeded canonical Saga Pen cannot be resolved.
 */
export async function syncCanonicalSagaMaterials(
  db: Database,
  sourceMaterialNames: readonly string[],
  { dryRun = false }: SyncCanonicalSagaMaterialsOptions = {},
): Promise<CanonicalSagaMaterialSyncResult> {
  const names = uniqueNormalizedNames(sourceMaterialNames);
  const [saga] = await db
    .select({ productId: schema.product.id })
    .from(schema.product)
    .innerJoin(schema.maker, eq(schema.product.makerId, schema.maker.id))
    .innerJoin(
      schema.productDetailPen,
      eq(schema.productDetailPen.id, schema.product.id),
    )
    .where(
      and(
        eq(schema.maker.slug, sagaIdentity.makerSlug),
        eq(schema.product.slug, sagaIdentity.productSlug),
      ),
    )
    .limit(1);

  if (!saga) {
    throw new Error(
      "Canonical Grimsmo Saga Pen is missing; run the approved Pens seed before the scraper.",
    );
  }

  if (names.length === 0) {
    return {
      existingMaterialNames: [],
      newMaterialNames: [],
      productId: saga.productId,
      unresolvedMaterialNames: [],
    };
  }

  const [generalMaterials, specificMaterials] = await Promise.all([
    db
      .select({
        materialId: schema.material.id,
        materialName: schema.material.name,
        materialSpecificId: sql<number | null>`null`,
      })
      .from(schema.material)
      .where(inArray(sql`lower(${schema.material.name})`, names)),
    db
      .select({
        materialId: schema.material.id,
        materialName: schema.materialSpecific.name,
        materialSpecificId: schema.materialSpecific.id,
      })
      .from(schema.materialSpecific)
      .innerJoin(
        schema.material,
        eq(schema.materialSpecific.materialId, schema.material.id),
      )
      .where(inArray(sql`lower(${schema.materialSpecific.name})`, names)),
  ]);
  const resolvedByName = new Map(
    [...generalMaterials, ...specificMaterials].map((material) => [
      material.materialName.trim().toLowerCase(),
      material,
    ]),
  );
  const resolved = names.flatMap((name) => {
    const material = resolvedByName.get(name);
    return material ? [material] : [];
  });
  const existing =
    resolved.length === 0
      ? []
      : await db
          .select({
            materialId: schema.productMaterialComponent.materialId,
            materialSpecificId:
              schema.productMaterialComponent.materialSpecificId,
          })
          .from(schema.productMaterial)
          .innerJoin(
            schema.productMaterialComponent,
            eq(
              schema.productMaterialComponent.productMaterialId,
              schema.productMaterial.id,
            ),
          )
          .where(eq(schema.productMaterial.productId, saga.productId));
  const existingKeys = new Set(
    existing.map((assignment) =>
      materialAssignmentKey(
        assignment.materialId,
        assignment.materialSpecificId,
      ),
    ),
  );
  const newMaterials = resolved.filter(
    (material) =>
      !existingKeys.has(
        materialAssignmentKey(material.materialId, material.materialSpecificId),
      ),
  );

  if (!dryRun && newMaterials.length > 0) {
    const assignments = await db
      .insert(schema.productMaterial)
      .values(newMaterials.map(() => ({ productId: saga.productId })))
      .returning({ id: schema.productMaterial.id });
    if (assignments.length !== newMaterials.length)
      throw new Error("Failed to create Saga material assignments.");
    await db.insert(schema.productMaterialComponent).values(
      assignments.map(({ id }, index) => {
        const material = newMaterials[index];
        if (!material)
          throw new Error("Failed to match Saga material assignment.");
        return {
          materialId: material.materialId,
          materialSpecificId: material.materialSpecificId,
          productMaterialId: id,
        };
      }),
    );
  }

  const newKeys = new Set(
    newMaterials.map((material) =>
      materialAssignmentKey(material.materialId, material.materialSpecificId),
    ),
  );

  return {
    existingMaterialNames: resolved
      .filter(
        (material) =>
          !newKeys.has(
            materialAssignmentKey(
              material.materialId,
              material.materialSpecificId,
            ),
          ),
      )
      .map((material) => material.materialName),
    newMaterialNames: newMaterials.map((material) => material.materialName),
    productId: saga.productId,
    unresolvedMaterialNames: names.filter((name) => !resolvedByName.has(name)),
  };
}

/**
 * Returns unique, case-insensitive material names in stable order.
 *
 * @param names - Source material names to normalize.
 * @returns Sorted unique lower-case material names.
 */
function uniqueNormalizedNames(names: readonly string[]): string[] {
  return [...new Set(names.map((name) => name.trim().toLowerCase()))]
    .filter(Boolean)
    .sort();
}

/**
 * Builds a stable key for one general or specific material assignment.
 *
 * @param materialId - Canonical general material identifier.
 * @param materialSpecificId - Optional canonical alloy or grade identifier.
 * @returns Stable assignment key used for idempotent comparison.
 */
function materialAssignmentKey(
  materialId: number,
  materialSpecificId: number | null,
): string {
  return `${materialId}:${materialSpecificId ?? "general"}`;
}

/** One Saga source image that still needs canonical upload and attachment. */
export type CanonicalSagaImageCandidate = SagaCatalogImage & {
  /** Canonical source-listing identifier. */
  listingId: number;
  /** Canonical product identifier. */
  productId: number;
  /** Zero-based canonical product-image position. */
  position: number;
};

/** Result of reconciling one bounded Saga catalog snapshot. */
export type CanonicalSagaCatalogSyncResult = {
  /** Appearance candidates omitted because the product reached its cap. */
  cappedAppearanceCount: number;
  /** Source images that still need upload and attachment. */
  imageCandidates: CanonicalSagaImageCandidate[];
  /** Newly created appearance count. */
  newAppearanceCount: number;
  /** Newly created color names. */
  newColorNames: string[];
  /** Newly created finish names. */
  newFinishNames: string[];
  /** Newly assigned or created material names. */
  newMaterialNames: string[];
  /** Newly created slider-option names. */
  newSliderOptions: string[];
  /** Number of image uploads planned during a dry run. */
  plannedImageCount: number;
  /** Canonical Saga product identifier. */
  productId: number;
};

/** Controls whether Saga catalog reconciliation may persist changes. */
export type SyncCanonicalSagaCatalogOptions = {
  /** Whether to report planned changes without writing them. */
  dryRun?: boolean;
};

/** Uploaded image metadata required by canonical Saga persistence. */
export type CanonicalSagaUploadedImage = {
  /** Normalized image media type. */
  contentType: string;
  /** Original or generated file name. */
  fileName: string;
  /** Canonical Bunny object path. */
  objectPath: string;
  /** Canonical product-image position. */
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

/** Result of attaching one uploaded Saga image. */
export type CanonicalSagaImageSyncResult = {
  /** Whether the image was omitted because the gallery reached 30 images. */
  capped: boolean;
  /** Whether canonical image data changed. */
  changed: boolean;
  /** Canonical product-image identifier, or `null` when capped. */
  productImageId: number | null;
};

/** Seeded canonical identity for the Grimsmo Saga. */
type SagaIdentity = {
  /** Canonical Grimsmo maker identifier. */
  makerId: number;
  /** Canonical Saga product identifier. */
  productId: number;
};

/** Counts produced while adding capped Saga appearances. */
type SagaAppearanceSyncResult = {
  /** Candidate count omitted because the product reached its cap. */
  cappedAppearanceCount: number;
  /** Newly persisted appearance count. */
  newAppearanceCount: number;
};

/** One named canonical lookup row. */
type SagaLookupRow = {
  /** Canonical lookup identifier. */
  id: number;
  /** Canonical lookup name. */
  name: string;
};

/** Canonical identifiers forming one Saga appearance. */
type SagaAppearanceIdentity = {
  /** Canonical color identifiers. */
  colorIds: readonly number[];
  /** Canonical finish identifiers. */
  finishIds: readonly number[];
  /** Canonical slider-pattern identifier, or `null`. */
  patternId: number | null;
};

/** One row with a zero-based display position. */
type PositionedRow = {
  /** Zero-based display position. */
  position: number;
};

/**
 * Reconciles bounded Saga taxonomy, appearances, and product-image candidates.
 *
 * Existing canonical values are preserved. The product is capped at 100
 * appearance options and 30 active product images.
 *
 * @param db - Canonical application database.
 * @param snapshot - Bounded normalized Saga snapshot.
 * @param options - Dry-run control for read-only planning.
 * @returns Created taxonomy, capped appearance, and pending image counts.
 * @rejects When the seeded Saga product or required configuration slots are absent.
 */
export async function syncCanonicalSagaCatalog(
  db: Database,
  snapshot: SagaCatalogSnapshot,
  options: SyncCanonicalSagaCatalogOptions = {},
): Promise<CanonicalSagaCatalogSyncResult> {
  const identity = await loadSagaIdentity(db);
  const existingNames = await loadExistingLookupNames(db, snapshot);
  const newColorNames = snapshot.colorNames.filter(
    (name) => !existingNames.colors.has(normalizeName(name)),
  );
  const newFinishNames = snapshot.finishNames.filter(
    (name) => !existingNames.finishes.has(normalizeName(name)),
  );
  const newSliderOptions = snapshot.sliderOptions.filter(
    (name) => !existingNames.patterns.has(normalizeName(name)),
  );

  if (options.dryRun) {
    const [appearanceCount, activeImageCount, assignedMaterialNames] =
      await Promise.all([
        countSagaAppearances(db, identity.productId),
        countSagaImages(db, identity.productId),
        loadAssignedMaterialNames(db, identity.productId),
      ]);
    const availableAppearances = Math.max(
      0,
      sagaAppearanceLimit - appearanceCount,
    );
    return {
      cappedAppearanceCount: Math.max(
        0,
        snapshot.appearances.length - availableAppearances,
      ),
      imageCandidates: [],
      newAppearanceCount: Math.min(
        availableAppearances,
        snapshot.appearances.length,
      ),
      newColorNames,
      newFinishNames,
      newMaterialNames: snapshot.materialNames.filter(
        (name) => !assignedMaterialNames.has(normalizeName(name)),
      ),
      newSliderOptions,
      plannedImageCount: Math.min(
        snapshot.images.length,
        Math.max(0, sagaImageLimit - activeImageCount),
      ),
      productId: identity.productId,
    };
  }

  await ensureNamedLookups(db, snapshot);
  const newMaterialNames = await syncSagaMaterials(
    db,
    identity.productId,
    snapshot.materialNames,
  );
  const appearanceResult = await syncSagaAppearances(
    db,
    identity.productId,
    snapshot.appearances,
  );
  const imageCandidates = await loadSagaImageCandidates(
    db,
    identity,
    snapshot.images,
  );

  return {
    ...appearanceResult,
    imageCandidates,
    newColorNames,
    newFinishNames,
    newMaterialNames,
    newSliderOptions,
    plannedImageCount: imageCandidates.length,
    productId: identity.productId,
  };
}

/**
 * Attaches one uploaded Saga image while enforcing the 30-image hard cap.
 *
 * @param db - Canonical application database.
 * @param input - Stable source identity and uploaded-object metadata.
 * @returns Whether the image changed canonical state or was capped.
 * @rejects When source ownership validation or persistence fails.
 */
export async function syncCanonicalSagaImage(
  db: Database,
  input: {
    /** Canonical source-listing identifier. */
    listingId: number;
    /** Canonical product identifier. */
    productId: number;
    /** Uploaded object and stable source-image metadata. */
    uploaded: CanonicalSagaUploadedImage;
  },
): Promise<CanonicalSagaImageSyncResult> {
  return await db.transaction(async (tx) => {
    await tx.execute(
      sql`select ${schema.product.id} from ${schema.product} where ${schema.product.id} = ${input.productId} for update`,
    );
    const [mapping] = await tx
      .select({ productId: schema.productSourceListing.productId })
      .from(schema.productSourceListing)
      .where(
        and(
          eq(schema.productSourceListing.listingId, input.listingId),
          eq(schema.productSourceListing.productId, input.productId),
        ),
      )
      .limit(1);
    if (!mapping)
      throw new Error("Saga source listing no longer owns product.");

    const [existingImage] = await tx
      .select({
        deletedAt: schema.productImage.deletedAt,
        id: schema.productImage.id,
      })
      .from(schema.productImage)
      .where(
        and(
          eq(schema.productImage.productId, input.productId),
          eq(schema.productImage.sha256, input.uploaded.sha256),
        ),
      )
      .limit(1);
    if (!existingImage) {
      const activeImageCount = await countSagaImages(tx, input.productId);
      if (activeImageCount >= sagaImageLimit)
        return { capped: true, changed: false, productImageId: null };
    }

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
    if (!productImage) throw new Error("Failed to create Saga product image.");
    if (existingImage?.deletedAt)
      await tx
        .update(schema.productImage)
        .set({
          contentType: input.uploaded.contentType,
          deletedAt: null,
          deletedByClerkId: null,
          deletedByRole: null,
          fileName: input.uploaded.fileName,
          objectPath: input.uploaded.objectPath,
          position: input.uploaded.position,
          size: input.uploaded.size,
          url: input.uploaded.url,
        })
        .where(eq(schema.productImage.id, existingImage.id));

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
      capped: false,
      changed:
        !existingImage || Boolean(existingImage.deletedAt) || mappingChanged,
      productImageId: productImage.id,
    };
  });
}

/**
 * Loads the seeded Saga product and maker identity.
 *
 * @param db - Canonical application database.
 * @returns Canonical maker and product identifiers.
 * @rejects When the approved Saga seed has not been applied.
 */
async function loadSagaIdentity(db: Database): Promise<SagaIdentity> {
  const [identity] = await db
    .select({ makerId: schema.maker.id, productId: schema.product.id })
    .from(schema.product)
    .innerJoin(schema.maker, eq(schema.product.makerId, schema.maker.id))
    .innerJoin(
      schema.productDetailPen,
      eq(schema.productDetailPen.id, schema.product.id),
    )
    .where(
      and(
        eq(schema.maker.slug, sagaIdentity.makerSlug),
        eq(schema.product.slug, sagaIdentity.productSlug),
      ),
    )
    .limit(1);
  if (!identity)
    throw new Error(
      "Canonical Grimsmo Saga Pen is missing; run the approved Pens seed before the scraper.",
    );
  return identity;
}

/**
 * Loads existing taxonomy names relevant to one Saga snapshot.
 *
 * @param db - Canonical application database.
 * @param snapshot - Bounded normalized Saga snapshot.
 * @returns Case-insensitive existing color, finish, and pattern names.
 */
async function loadExistingLookupNames(
  db: Database,
  snapshot: SagaCatalogSnapshot,
) {
  const [colors, finishes, patterns] = await Promise.all([
    snapshot.colorNames.length
      ? db
          .select({ name: schema.color.name })
          .from(schema.color)
          .where(
            inArray(
              sql`lower(${schema.color.name})`,
              snapshot.colorNames.map(normalizeName),
            ),
          )
      : [],
    snapshot.finishNames.length
      ? db
          .select({ name: schema.finish.name })
          .from(schema.finish)
          .where(
            inArray(
              sql`lower(${schema.finish.name})`,
              snapshot.finishNames.map(normalizeName),
            ),
          )
      : [],
    snapshot.sliderOptions.length
      ? db
          .select({ name: schema.pattern.name })
          .from(schema.pattern)
          .where(
            inArray(
              sql`lower(${schema.pattern.name})`,
              snapshot.sliderOptions.map(normalizeName),
            ),
          )
      : [],
  ]);
  return {
    colors: new Set(colors.map((row) => normalizeName(row.name))),
    finishes: new Set(finishes.map((row) => normalizeName(row.name))),
    patterns: new Set(patterns.map((row) => normalizeName(row.name))),
  };
}

/**
 * Creates normalized lookup rows discovered in the Saga feed.
 *
 * @param db - Canonical application database.
 * @param snapshot - Bounded normalized Saga snapshot.
 * @rejects When a lookup cannot be persisted or a color lacks a hex value.
 */
async function ensureNamedLookups(
  db: Database,
  snapshot: SagaCatalogSnapshot,
): Promise<void> {
  if (snapshot.materialNames.length)
    await db
      .insert(schema.material)
      .values(
        snapshot.materialNames.map((name) => ({ name, slug: slugify(name) })),
      )
      .onConflictDoNothing();
  if (snapshot.finishNames.length)
    await db
      .insert(schema.finish)
      .values(
        snapshot.finishNames.map((name) => ({ name, slug: slugify(name) })),
      )
      .onConflictDoNothing();
  if (snapshot.sliderOptions.length)
    await db
      .insert(schema.pattern)
      .values(
        snapshot.sliderOptions.map((name) => ({ name, slug: slugify(name) })),
      )
      .onConflictDoNothing();
  if (snapshot.colorNames.length)
    await db
      .insert(schema.color)
      .values(
        snapshot.colorNames.map((name) => ({
          hex: colorHex(name),
          name,
          slug: slugify(name),
        })),
      )
      .onConflictDoNothing();
}

/**
 * Assigns newly observed materials directly to the Saga product.
 *
 * @param db - Canonical application database.
 * @param productId - Canonical Saga product identifier.
 * @param names - Normalized material names observed in the feed.
 * @returns Newly assigned material names.
 * @rejects When a material assignment cannot be persisted.
 */
async function syncSagaMaterials(
  db: Database,
  productId: number,
  names: readonly string[],
): Promise<string[]> {
  if (names.length === 0) return [];
  const materials = await db
    .select({ id: schema.material.id, name: schema.material.name })
    .from(schema.material)
    .where(
      inArray(sql`lower(${schema.material.name})`, names.map(normalizeName)),
    );
  const existingAssignments = await db
    .select({
      id: schema.productMaterial.id,
      materialId: schema.productMaterialComponent.materialId,
    })
    .from(schema.productMaterial)
    .innerJoin(
      schema.productMaterialComponent,
      eq(
        schema.productMaterialComponent.productMaterialId,
        schema.productMaterial.id,
      ),
    )
    .where(eq(schema.productMaterial.productId, productId));
  const assignmentByMaterial = new Map(
    existingAssignments.map((row) => [row.materialId, row.id]),
  );
  const created: string[] = [];
  for (const material of materials.sort((left, right) =>
    left.name.localeCompare(right.name),
  )) {
    let assignmentId = assignmentByMaterial.get(material.id);
    if (assignmentId === undefined) {
      const [assignment] = await db
        .insert(schema.productMaterial)
        .values({ productId })
        .returning({ id: schema.productMaterial.id });
      if (!assignment) throw new Error("Failed to assign Saga material.");
      await db.insert(schema.productMaterialComponent).values({
        materialId: material.id,
        productMaterialId: assignment.id,
      });
      assignmentId = assignment.id;
      assignmentByMaterial.set(material.id, assignment.id);
      created.push(material.name);
    }
  }
  return created;
}

/**
 * Adds distinct Saga appearance combinations until the 100-option cap.
 *
 * @param db - Canonical application database.
 * @param productId - Canonical Saga product identifier.
 * @param appearances - Distinct normalized appearances in source order.
 * @returns Created and capped appearance counts.
 * @rejects When lookups or persistence is unavailable.
 */
async function syncSagaAppearances(
  db: Database,
  productId: number,
  appearances: readonly SagaCatalogAppearance[],
): Promise<SagaAppearanceSyncResult> {
  const [
    finishRows,
    colorRows,
    patternRows,
    optionRows,
    finishLinks,
    colorLinks,
  ] = await Promise.all([
    db
      .select({ id: schema.finish.id, name: schema.finish.name })
      .from(schema.finish),
    db
      .select({ id: schema.color.id, name: schema.color.name })
      .from(schema.color),
    db
      .select({ id: schema.pattern.id, name: schema.pattern.name })
      .from(schema.pattern),
    db
      .select({
        id: schema.finishOption.id,
        patternId: schema.finishOption.patternId,
        position: schema.finishOption.position,
      })
      .from(schema.finishOption)
      .where(eq(schema.finishOption.productId, productId)),
    db
      .select({
        finishId: schema.finishOptionFinish.finishId,
        optionId: schema.finishOptionFinish.finishOptionId,
      })
      .from(schema.finishOptionFinish),
    db
      .select({
        colorId: schema.finishOptionColor.colorId,
        optionId: schema.finishOptionColor.finishOptionId,
      })
      .from(schema.finishOptionColor),
  ]);
  const finishByName = lookupIdByName(finishRows);
  const colorByName = lookupIdByName(colorRows);
  const patternByName = lookupIdByName(patternRows);
  const existingSignatures = new Set(
    optionRows.map((option) =>
      appearanceSignature({
        colorIds: colorLinks
          .filter((link) => link.optionId === option.id)
          .map((link) => link.colorId),
        finishIds: finishLinks
          .filter((link) => link.optionId === option.id)
          .map((link) => link.finishId),
        patternId: option.patternId,
      }),
    ),
  );
  let nextOptionPosition = nextChoicePosition(optionRows);
  let newAppearanceCount = 0;
  let cappedAppearanceCount = 0;

  for (const appearance of appearances) {
    const finishIds = appearance.finishNames.map((name) =>
      requireLookupId(finishByName, name, "finish"),
    );
    const colorIds = appearance.colorNames.map((name) =>
      requireLookupId(colorByName, name, "color"),
    );
    const patternId =
      appearance.sliderOption === null
        ? null
        : requireLookupId(
            patternByName,
            appearance.sliderOption,
            "slider option",
          );
    const signature = appearanceSignature({ colorIds, finishIds, patternId });
    if (existingSignatures.has(signature)) continue;
    if (optionRows.length + newAppearanceCount >= sagaAppearanceLimit) {
      cappedAppearanceCount += 1;
      continue;
    }
    await db.transaction(async (tx) => {
      const [option] = await tx
        .insert(schema.finishOption)
        .values({ patternId, position: nextOptionPosition, productId })
        .returning({ id: schema.finishOption.id });
      if (!option) throw new Error("Failed to create Saga appearance.");
      if (finishIds.length)
        await tx.insert(schema.finishOptionFinish).values(
          finishIds.map((finishId, position) => ({
            finishId,
            finishOptionId: option.id,
            position,
          })),
        );
      if (colorIds.length)
        await tx.insert(schema.finishOptionColor).values(
          colorIds.map((colorId, position) => ({
            colorId,
            finishOptionId: option.id,
            position,
          })),
        );
    });
    existingSignatures.add(signature);
    newAppearanceCount += 1;
    nextOptionPosition += 1;
  }
  return { cappedAppearanceCount, newAppearanceCount };
}

/**
 * Selects missing Saga images and ensures their source-listing identities.
 *
 * @param db - Canonical application database.
 * @param identity - Canonical Saga maker and product identifiers.
 * @param images - Bounded distinct source-image candidates.
 * @returns Missing images with canonical listing ownership and positions.
 */
async function loadSagaImageCandidates(
  db: Database,
  identity: SagaIdentity,
  images: readonly SagaCatalogImage[],
): Promise<CanonicalSagaImageCandidate[]> {
  const activeImageCount = await countSagaImages(db, identity.productId);
  const remaining = Math.max(0, sagaImageLimit - activeImageCount);
  if (remaining === 0 || images.length === 0) return [];
  const mapped = await db
    .select({
      sourceImageId: schema.catalogSourceImage.sourceImageId,
      sourceRecordId: schema.catalogSourceListing.sourceRecordId,
    })
    .from(schema.catalogSourceImage)
    .innerJoin(
      schema.catalogSourceListing,
      eq(schema.catalogSourceImage.listingId, schema.catalogSourceListing.id),
    )
    .innerJoin(
      schema.productSourceListing,
      eq(schema.catalogSourceListing.id, schema.productSourceListing.listingId),
    )
    .innerJoin(
      schema.productImage,
      eq(schema.catalogSourceImage.productImageId, schema.productImage.id),
    )
    .where(
      and(
        eq(schema.productSourceListing.productId, identity.productId),
        sql`${schema.productImage.deletedAt} is null`,
      ),
    );
  const mappedKeys = new Set(
    mapped.map((row) => `${row.sourceRecordId}:${row.sourceImageId}`),
  );
  const selected = images
    .filter(
      (image) =>
        !mappedKeys.has(`${image.sourceProductId}:${image.sourceImageId}`),
    )
    .slice(0, remaining);
  const candidates: CanonicalSagaImageCandidate[] = [];
  for (const [index, image] of selected.entries()) {
    const listingId = await ensureSagaSourceListing(db, identity, image);
    candidates.push({
      ...image,
      listingId,
      position: activeImageCount + index,
      productId: identity.productId,
    });
  }
  return candidates;
}

/**
 * Ensures one Saga Shopify listing identity and product mapping.
 *
 * @param db - Canonical application database.
 * @param identity - Canonical Saga maker and product identifiers.
 * @param image - Source image carrying its listing identity.
 * @returns Canonical source-listing identifier.
 * @rejects When the source listing cannot be created or updated.
 */
async function ensureSagaSourceListing(
  db: Database,
  identity: SagaIdentity,
  image: SagaCatalogImage,
): Promise<number> {
  const [existing] = await db
    .select({ id: schema.catalogSourceListing.id })
    .from(schema.catalogSourceListing)
    .where(
      and(
        eq(schema.catalogSourceListing.makerId, identity.makerId),
        eq(schema.catalogSourceListing.sourceSystem, sagaSourceSystem),
        eq(schema.catalogSourceListing.sourceRecordId, image.sourceProductId),
      ),
    )
    .limit(1);
  const listingId = existing
    ? existing.id
    : (
        await db
          .insert(schema.catalogSourceListing)
          .values({
            listingUrl: image.listingUrl,
            makerId: identity.makerId,
            sourceHandle: image.sourceHandle,
            sourceRecordId: image.sourceProductId,
            sourceSystem: sagaSourceSystem,
          })
          .returning({ id: schema.catalogSourceListing.id })
      )[0]?.id;
  if (listingId === undefined)
    throw new Error("Failed to create Saga source listing.");
  if (existing)
    await db
      .update(schema.catalogSourceListing)
      .set({
        listingUrl: image.listingUrl,
        sourceHandle: image.sourceHandle,
        updatedAt: new Date(),
      })
      .where(eq(schema.catalogSourceListing.id, listingId));
  await db
    .insert(schema.productSourceListing)
    .values({ listingId, productId: identity.productId })
    .onConflictDoNothing();
  return listingId;
}

/**
 * Counts active canonical product images for the Saga.
 *
 * @param db - Database query surface.
 * @param productId - Canonical Saga product identifier.
 * @returns Active image count.
 */
async function countSagaImages(
  db: Pick<Database, "select">,
  productId: number,
): Promise<number> {
  const rows = await db
    .select({ id: schema.productImage.id })
    .from(schema.productImage)
    .where(
      and(
        eq(schema.productImage.productId, productId),
        sql`${schema.productImage.deletedAt} is null`,
      ),
    );
  return rows.length;
}

/**
 * Counts canonical appearance options for the Saga.
 *
 * @param db - Canonical application database.
 * @param productId - Canonical Saga product identifier.
 * @returns Persisted appearance count.
 */
async function countSagaAppearances(
  db: Database,
  productId: number,
): Promise<number> {
  return (
    await db
      .select({ id: schema.finishOption.id })
      .from(schema.finishOption)
      .where(eq(schema.finishOption.productId, productId))
  ).length;
}

/**
 * Loads normalized material names already assigned to the Saga.
 *
 * @param db - Canonical application database.
 * @param productId - Canonical Saga product identifier.
 * @returns Case-insensitive assigned material names.
 */
async function loadAssignedMaterialNames(
  db: Database,
  productId: number,
): Promise<Set<string>> {
  const rows = await db
    .select({ name: schema.material.name })
    .from(schema.productMaterial)
    .innerJoin(
      schema.productMaterialComponent,
      eq(
        schema.productMaterialComponent.productMaterialId,
        schema.productMaterial.id,
      ),
    )
    .innerJoin(
      schema.material,
      eq(schema.productMaterialComponent.materialId, schema.material.id),
    )
    .where(eq(schema.productMaterial.productId, productId));
  return new Set(rows.map((row) => normalizeName(row.name)));
}

/**
 * Returns a normalized case-insensitive lookup label.
 *
 * @param name - Source or canonical lookup name.
 * @returns Trimmed lower-case name.
 */
function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Returns the configured display color for one normalized Saga color.
 *
 * @param name - Normalized color name emitted by the Saga parser.
 * @returns Six-digit canonical hex color.
 * @throws When the parser emits a color without an explicit mapping.
 */
function colorHex(name: string): string {
  const hex = sagaColorHex[name as keyof typeof sagaColorHex];
  if (!hex) throw new Error(`Saga color ${name} has no canonical hex value.`);
  return hex;
}

/**
 * Maps case-insensitive lookup names to identifiers.
 *
 * @param rows - Canonical named lookup rows.
 * @returns Lookup identifiers keyed by normalized name.
 */
function lookupIdByName(rows: readonly SagaLookupRow[]) {
  return new Map(rows.map((row) => [normalizeName(row.name), row.id]));
}

/**
 * Resolves one required canonical lookup identifier.
 *
 * @param lookup - Identifier map keyed by normalized name.
 * @param name - Source lookup name to resolve.
 * @param kind - Domain label included in failures.
 * @returns Canonical lookup identifier.
 * @throws When the expected lookup row is absent.
 */
function requireLookupId(
  lookup: ReadonlyMap<string, number>,
  name: string,
  kind: string,
): number {
  const id = lookup.get(normalizeName(name));
  if (id === undefined)
    throw new Error(`Canonical Saga ${kind} ${name} is missing.`);
  return id;
}

/**
 * Builds one stable appearance signature from canonical lookup identifiers.
 *
 * @param input - Canonical color, finish, and optional pattern identifiers.
 * @returns Order-independent serialized appearance identity.
 */
function appearanceSignature(input: SagaAppearanceIdentity): string {
  return JSON.stringify({
    colorIds: [...input.colorIds].sort((left, right) => left - right),
    finishIds: [...input.finishIds].sort((left, right) => left - right),
    patternId: input.patternId,
  });
}

/**
 * Returns the next zero-based position after existing ordered rows.
 *
 * @param rows - Existing rows carrying display positions.
 * @returns Next available position.
 */
function nextChoicePosition(rows: readonly PositionedRow[]): number {
  return rows.reduce((maximum, row) => Math.max(maximum, row.position), -1) + 1;
}
