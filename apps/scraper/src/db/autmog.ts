import {
  createDb,
  type Database,
  type ScraperRunStats,
  schema,
} from "@package/database";
import { and, eq, isNull, lt, notInArray } from "drizzle-orm";
import { type NormalizedAutmogPen, scraperSources } from "../scraper-types.js";
import {
  createTmpProduct,
  syncTmpImages,
  type TmpImageUploadJobCandidate,
} from "./images.js";

const autmogMaker = {
  name: "Autmog",
  rootUrl: "https://www.autmog.com",
};

export type AutmogPenSyncResult = {
  created: boolean;
  dbResponse: AutmogPenSyncDbResponse;
  deleteImageJobs: { imageId: number }[];
  mutationInput: AutmogPenSyncMutationInput;
  uploadImageJobs: TmpImageUploadJobCandidate[];
  updated: boolean;
  versioned: boolean;
};

export type AutmogPenSyncMutationInput = {
  images: {
    altText: string | null;
    height: number | null;
    position: number;
    sourceHash: string;
    sourceImageId: string | null;
    sourceUrl: string;
    width: number | null;
  }[];
  pen: {
    availableForSale: boolean;
    bodyDetails: string[];
    clip: string | null;
    currencyCode: string;
    description: string | null;
    detailsHash: string;
    finish: string | null;
    grip: string | null;
    imageSetHash: string;
    makerId: number;
    materials: string[];
    mechanism: string | null;
    mechanismId: number | null;
    nose: string | null;
    priceMaxCents: number | null;
    priceMinCents: number | null;
    productTypes: string[];
    productUrl: string;
    refill: string | null;
    size: string | null;
    sourceHandle: string;
    sourceProductId: string;
    tags: string[];
    title: string;
  };
};

export type AutmogPenSyncDbResponse = {
  images: {
    deleteJobImageIds: number[];
    uploadJobImageIds: number[];
    upserted: {
      altText: string | null;
      height: number | null;
      id: number;
      imageFileId: string | null;
      imagePath: string | null;
      imageProvider: string | null;
      imageUrl: string | null;
      productId: number;
      productVariationId: number | null;
      sourceHash: string;
      status: string;
      width: number | null;
    }[];
  };
  pen: {
    detailsHash: string;
    archivedAt: Date | null;
    id: number;
    imageSetHash: string;
    makerId: number;
    sourceHandle: string;
    sourceProductId: string;
    title: string;
  };
  product: {
    id: number;
    source: string;
  };
};

export type ScraperRunUpdate = {
  errorMessage?: string;
  stats?: ScraperRunStats;
  status: "completed" | "failed";
};

export function createScraperDb(databaseUrl: string): Database {
  return createDb({ databaseUrl });
}

export async function startScraperRun(
  db: Database,
  input: {
    jobType: string;
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
    throw new Error(
      `Scraper run already active for ${input.source}:${input.jobType}.`,
    );
  }

  const [run] = await db
    .insert(schema.scraperRuns)
    .values({
      jobType: input.jobType,
      source: input.source,
      status: "running",
    })
    .returning();

  if (!run) {
    throw new Error("Failed to create scraper run.");
  }

  return run;
}

export async function pruneScraperRuns(db: Database, now = new Date()) {
  const cutoff = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  await db
    .delete(schema.scraperRuns)
    .where(lt(schema.scraperRuns.startedAt, cutoff));
}

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

function slugifyCanonicalName(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "value"
  );
}

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

async function getMakerByRootUrl(db: Database, rootUrl: string) {
  const [maker] = await db
    .select()
    .from(schema.maker)
    .where(eq(schema.maker.rootUrl, rootUrl))
    .limit(1);

  return maker;
}

function getChangeReason(
  existing: { detailsHash: string; imageSetHash: string },
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
