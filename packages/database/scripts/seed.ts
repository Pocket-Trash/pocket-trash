import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { eq, inArray } from "drizzle-orm";
import {
  createUploadStorage,
  type UploadStorage,
  type UploadTarget,
} from "../../storage/src/index.js";
import { createDb } from "../src/client.js";
import { createDatabaseEnv } from "../src/env.schema.js";
import {
  color,
  colorEffect,
  finish,
  maker,
  material,
  product,
  productImage,
  productMaterial,
  productSpinner,
  productSpinnerButton,
  productType,
  user,
  userSettings,
} from "../src/schema/index.js";

/**
 * Users required in shared non-production databases.
 *
 * @internal
 */
export const seedUsers = [
  { clerkId: "user_3FrjTtIKHL0ptK6jeljcf5kCM7J", username: "royanger" },
  { clerkId: "user_3JgqrEzHG8RsUFhfmm227e96VCq", username: "someadmin" },
  { clerkId: "user_3JRUuhMIDwBBiLyc4smN8pAtGS9", username: "ranger" },
  { clerkId: "user_3GacmU93tlb9EiT1wQCXRefMJi1", username: "bvg001" },
  { clerkId: "user_3FxAxWTSZhoYlM2C3Jlpk5kGvUA", username: "bvgdigi" },
  { clerkId: "user_3FtlpxLoJA3znNat7qXDb0RHcgm", username: "bvgdigital" },
] as const;

/** Clerk user that owns the shared KAP catalog seed. */
export const seedOwnerClerkId = "user_3FrjTtIKHL0ptK6jeljcf5kCM7J";

/**
 * Non-default preferences required by seeded users.
 *
 * @internal
 */
export const seedUserSettings = [
  {
    clerkId: "user_3FrjTtIKHL0ptK6jeljcf5kCM7J",
    values: {
      currencyCode: "CAD" as const,
      dimensionUnit: "mm" as const,
      weightUnit: "g" as const,
    },
  },
  {
    clerkId: "user_3JRUuhMIDwBBiLyc4smN8pAtGS9",
    values: { weightUnit: "oz" as const },
  },
] as const;

/**
 * Canonical product types inserted by the catalog seed.
 *
 * @internal
 */
export const seedProductTypes = [
  { name: "Pen", slug: "pen" },
  { name: "Spinner", slug: "spinner" },
  { name: "Spinner Button", slug: "spinner-button" },
  { name: "Slider", slug: "slider" },
  { name: "Slider Plate", slug: "slider-plate" },
  { name: "Slider Insert", slug: "slider-insert" },
  { name: "Fountain Pen", slug: "fountain-pen" },
] as const;

/**
 * Canonical makers inserted or updated by the catalog seed.
 *
 * @internal
 */
export const seedMakers = [
  { name: "Autmog", rootUrl: "https://www.autmog.com", slug: "autmog" },
  {
    name: "Inventery",
    rootUrl: "https://www.inventery.co",
    slug: "inventery",
  },
  { name: "KAP EDC", rootUrl: "https://www.kapedc.com", slug: "kap-edc" },
  { name: "Clean EDC", rootUrl: "https://cleanedc.com", slug: "clean-edc" },
  {
    name: "Magnus Fidgets",
    rootUrl: "https://magnusfidgets.com",
    slug: "magnus-fidgets",
  },
  {
    name: "Full Throttle Originals",
    rootUrl: "https://fullthrottleoriginals.com",
    slug: "full-throttle-originals",
  },
] as const;

/**
 * Canonical materials inserted by the catalog seed.
 *
 * @internal
 */
export const seedMaterials = [
  { name: "Aluminum", slug: "aluminum" },
  { name: "Brass", slug: "brass" },
  { name: "Bronze", slug: "bronze" },
  { name: "Copper", slug: "copper" },
  { name: "Cupronickel", slug: "cupronickel" },
  { name: "Damascus Steel", slug: "damascus-steel" },
  { name: "M390 Steel", slug: "m390-steel" },
  { name: "Mokume", slug: "mokume" },
  { name: "Mokuti", slug: "mokuti" },
  { name: "Stainless Steel", slug: "stainless-steel" },
  { name: "Superconductor", slug: "superconductor" },
  { name: "Titanium", slug: "titanium" },
  { name: "Tungsten", slug: "tungsten" },
  { name: "Ultem", slug: "ultem" },
  { name: "Zirconium", slug: "zirconium" },
  { name: "ZircuTi", slug: "zircuti" },
] as const;

/** Maps reviewed KAP material labels to catalog slugs. */
const materialTermSlugs: Readonly<Record<string, string>> = {
  "Aluminum / 7075 Al": "aluminum",
  Brass: "brass",
  Bronze: "bronze",
  Copper: "copper",
  Cupronickel: "cupronickel",
  "Damascus (Dama / BT Dama)": "damascus-steel",
  "M390 steel": "m390-steel",
  Mokume: "mokume",
  Mokuti: "mokuti",
  "Stainless steel (SS / 304SS)": "stainless-steel",
  "Superconductor (SC)": "superconductor",
  "Titanium (Ti / crystallized Ti)": "titanium",
  "Tungsten (W)": "tungsten",
  "Ultem / PEI": "ultem",
  "Zirconium (Zirc)": "zirconium",
  ZircuTi: "zircuti",
};

/**
 * Canonical finishes inserted by the catalog seed.
 *
 * @internal
 */
export const seedFinishes = [
  { name: "Anodized", slug: "anodized" },
  { name: "Cerakoted", slug: "cerakoted" },
  { name: "Polished", slug: "polished" },
  { name: "Machine finished", slug: "machine-finished" },
  { name: "Blackened", slug: "blackened" },
  { name: "Satin", slug: "satin" },
  { name: "Tumbled", slug: "tumbled" },
  { name: "Blasted", slug: "blasted" },
] as const;

/**
 * Canonical colors inserted by the catalog seed.
 *
 * @internal
 */
export const seedColors = [
  { hex: "#000000", name: "Black", slug: "black" },
  { hex: "#FFFFFF", name: "White", slug: "white" },
  { hex: "#808080", name: "Grey", slug: "grey" },
  { hex: "#C0C0C0", name: "Silver", slug: "silver" },
  { hex: "#DC2626", name: "Red", slug: "red" },
  { hex: "#F97316", name: "Orange", slug: "orange" },
  { hex: "#EAB308", name: "Yellow", slug: "yellow" },
  { hex: "#16A34A", name: "Green", slug: "green" },
  { hex: "#2563EB", name: "Blue", slug: "blue" },
  { hex: "#9333EA", name: "Purple", slug: "purple" },
  { hex: "#EC4899", name: "Pink", slug: "pink" },
  { hex: "#92400E", name: "Brown", slug: "brown" },
  { hex: "#CD7F32", name: "Bronze", slug: "bronze" },
  { hex: "#D4AF37", name: "Gold", slug: "gold" },
  { hex: "#0D9488", name: "Teal", slug: "teal" },
  { hex: "#06B6D4", name: "Cyan", slug: "cyan" },
] as const;

/**
 * Canonical color effects inserted by the catalog seed.
 *
 * @internal
 */
export const seedColorEffects = [
  { name: "Solid", slug: "solid" },
  { name: "Fade", slug: "fade" },
] as const;

/** One cached KAP image. */
type KapedcSeedImage = {
  /** Bunny object path holding the reviewed import. */
  cacheObjectPath: string;
  /** Validated image media type. */
  contentType: "image/jpeg" | "image/png" | "image/webp";
  /** Original image file name. */
  fileName: string;
  /** Expected image SHA-256 digest. */
  sha256: string;
  /** Expected image size in bytes. */
  size: number;
};

/** One reviewed KAP product and its cached image gallery. */
type KapedcSeedProduct = {
  /** Product description from the reviewed source snapshot. */
  description: string;
  /** Cached images in source order. */
  images: KapedcSeedImage[];
  /** Reviewed material labels for the product. */
  materialTerms: string[];
  /** Display name from the source catalog. */
  name: string;
  /** Stable product slug. */
  slug: string;
  /** Original KAP product page URL. */
  sourceUrl: string;
  /** Catalog subtype represented by the product. */
  type: "spinner" | "spinner-button";
};

/** Reviewed KAP catalog snapshot stored with the seed. */
type KapedcSeedSnapshot = {
  /** Time the source catalog was imported. */
  importedAt: string;
  /** Reviewed products included in the snapshot. */
  products: KapedcSeedProduct[];
};

/** Bunny settings needed to copy seed images. */
type SeedBunnyConfig = {
  /** Bunny storage access key. */
  accessKey: string;
  /** Public CDN base URL. */
  cdnBaseUrl: string;
  /** Bunny storage API endpoint. */
  endpoint: string;
  /** Environment-specific image object prefix. */
  imageFolderPrefix: string;
  /** Environment-specific resource object prefix. */
  resourceFolderPrefix: string;
  /** Bunny storage zone name. */
  zoneName: string;
};

/** Maximum Bunny attempts for one idempotent seed request. */
const bunnySeedMaxAttempts = 4;

/** Initial delay before retrying a transient Bunny seed request. */
const bunnySeedBackoffMs = 100;

/** HTTP statuses that indicate a bounded Bunny seed retry may succeed. */
const retryableBunnySeedStatuses = new Set([408, 429, 500, 502, 503, 504]);

/** Fetch cause codes that identify a transient network failure. */
const retryableBunnySeedErrorCodes = new Set([
  "EAI_AGAIN",
  "ECONNREFUSED",
  "ECONNRESET",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "ETIMEDOUT",
  "UND_ERR_BODY_TIMEOUT",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_SOCKET",
]);

/** Identifies a Bunny response that is safe for the seed to retry. */
class TransientBunnySeedError extends Error {}

/**
 * Consumes one Bunny seed response within its retry attempt.
 *
 * @template T - Consumed response type.
 */
type BunnySeedResponseConsumer<T> = {
  /**
   * Consumes a Bunny response.
   *
   * @param response - Bunny response to consume.
   * @returns Consumed response value.
   * @rejects When reading or transforming the response fails.
   */
  (response: Response): Promise<T>;
};

/** Seed product paired with its database identifier. */
type SeededKapedcProduct = {
  /** Reviewed product data. */
  product: KapedcSeedProduct;
  /** Persisted product identifier. */
  productId: number;
};

/**
 * Normalizes an optional seed URL for stable comparisons and storage.
 *
 * @param url - URL to trim and remove trailing slashes from.
 * @returns The normalized URL, or `null` when the input is absent or blank.
 * @internal
 */
export function normalizeSeedUrl(url: string | null): string | null {
  return url?.trim().replace(/\/+$/, "") || null;
}

/**
 * Resolves a reviewed KAP material label to its catalog slug.
 *
 * @param term - Reviewed source material label.
 * @returns Matching catalog material slug.
 * @throws When the reviewed label has no catalog mapping.
 */
export function materialSlugForTerm(term: string): string {
  const slug = materialTermSlugs[term];
  if (!slug) throw new Error(`Unmapped KAP material term: ${term}.`);
  return slug;
}

/**
 * Selects the immutable image namespace used by catalog seed records.
 *
 * Isolated previews reference the shared preview baseline. Preview seed rows
 * are non-owned; development and production own their configured objects.
 *
 * @param imageFolderPrefix - Environment image namespace.
 * @returns Image namespace that owns immutable seed objects.
 */
export function seedImageFolderPrefix(imageFolderPrefix: string): string {
  const normalized = imageFolderPrefix.replace(/^\/+|\/+$/gu, "");
  return /^images\/preview\/pr-[1-9]\d*$/u.test(normalized)
    ? "images/preview"
    : normalized;
}

/**
 * Loads the reviewed KAP product and primary-image snapshot.
 *
 * @returns The reviewed KAP seed snapshot.
 */
export async function loadKapedcSeedData(): Promise<KapedcSeedSnapshot> {
  const path = fileURLToPath(
    new URL("../seed-data/kapedc.json", import.meta.url),
  );
  return JSON.parse(await readFile(path, "utf8")) as KapedcSeedSnapshot;
}

/**
 * Upserts the users and preferences needed in non-production databases.
 *
 * @param db - Database client receiving the seed values.
 * @rejects When a user read or write fails.
 * @internal
 */
export async function seedUsersAndSettings(db: ReturnType<typeof createDb>) {
  for (const value of seedUsers) {
    await db
      .insert(user)
      .values(value)
      .onConflictDoUpdate({
        set: { username: value.username },
        target: user.clerkId,
      });
  }

  const users = await db
    .select({ clerkId: user.clerkId, id: user.id })
    .from(user)
    .where(
      inArray(
        user.clerkId,
        seedUsers.map(({ clerkId }) => clerkId),
      ),
    );
  const ids = new Map(users.map(({ clerkId, id }) => [clerkId, id]));

  for (const value of seedUserSettings) {
    const userId = ids.get(value.clerkId);
    if (!userId) throw new Error(`Seed user ${value.clerkId} is missing.`);
    await db
      .insert(userSettings)
      .values({ ...value.values, userId })
      .onConflictDoUpdate({
        set: value.values,
        target: userSettings.userId,
      });
  }
}

/**
 * Upserts the canonical catalog lookup values.
 *
 * @param db - Database client receiving the seed values.
 * @rejects When a catalog read or write fails.
 * @internal
 */
export async function seedCatalog(db: ReturnType<typeof createDb>) {
  for (const value of seedProductTypes) {
    await db
      .insert(productType)
      .values(value)
      .onConflictDoUpdate({
        set: { name: value.name, updatedAt: new Date() },
        target: productType.slug,
      });
  }

  const existingMakers = await db.select().from(maker);
  for (const value of seedMakers) {
    const existing = existingMakers.find(
      ({ name }) => name.toLocaleLowerCase() === value.name.toLocaleLowerCase(),
    );
    const rootUrl = normalizeSeedUrl(value.rootUrl);

    if (existing) {
      await db
        .update(maker)
        .set({ name: value.name, rootUrl, updatedAt: new Date() })
        .where(eq(maker.id, existing.id));
    } else {
      await db
        .insert(maker)
        .values({ name: value.name, rootUrl, slug: value.slug });
    }
  }

  for (const value of seedMaterials) {
    await db
      .insert(material)
      .values(value)
      .onConflictDoUpdate({
        set: { name: value.name, updatedAt: new Date() },
        target: material.slug,
      });
  }

  for (const [table, values] of [
    [finish, seedFinishes],
    [colorEffect, seedColorEffects],
  ] as const) {
    for (const value of values) {
      await db
        .insert(table)
        .values(value)
        .onConflictDoUpdate({
          set: { name: value.name, updatedAt: new Date() },
          target: table.slug,
        });
    }
  }

  for (const value of seedColors) {
    await db
      .insert(color)
      .values(value)
      .onConflictDoUpdate({
        set: { hex: value.hex, name: value.name, updatedAt: new Date() },
        target: color.slug,
      });
  }
}

/**
 * Upserts the reviewed KAP products and their material assignments.
 *
 * @param db - Database client receiving the seed values.
 * @param snapshot - Reviewed KAP catalog snapshot.
 * @returns Persisted products paired with their source records.
 * @rejects When catalog lookups or writes fail.
 */
export async function seedKapedcProducts(
  db: ReturnType<typeof createDb>,
  snapshot: KapedcSeedSnapshot,
): Promise<SeededKapedcProduct[]> {
  const [kapMaker] = await db
    .select({ id: maker.id })
    .from(maker)
    .where(eq(maker.name, "KAP EDC"))
    .limit(1);
  if (!kapMaker) throw new Error("KAP EDC maker is missing after seeding.");

  const types = await db
    .select({ id: productType.id, slug: productType.slug })
    .from(productType)
    .where(inArray(productType.slug, ["spinner", "spinner-button"]));
  const typeIds = new Map(types.map(({ id, slug }) => [slug, id]));
  const materials = await db
    .select({ id: material.id, slug: material.slug })
    .from(material);
  const materialIds = new Map(materials.map(({ id, slug }) => [slug, id]));
  const seeded = [];

  for (const value of snapshot.products) {
    const productTypeId = typeIds.get(value.type);
    if (!productTypeId)
      throw new Error(`Product type ${value.type} is missing.`);
    const productValues = {
      description: value.description || null,
      isPrivate: false,
      makerId: kapMaker.id,
      makerProductUrl: normalizeSeedUrl(value.sourceUrl),
      makerProductUrlValid: true,
      name: value.name.trim(),
      ownerClerkId: seedOwnerClerkId,
      productTypeId,
      slug: value.slug,
      updatedAt: new Date(),
    };
    const [seededProduct] = await db
      .insert(product)
      .values(productValues)
      .onConflictDoUpdate({
        set: productValues,
        target: [product.productTypeId, product.slug],
      })
      .returning({ id: product.id });
    if (!seededProduct)
      throw new Error(`Failed to seed KAP product ${value.name}.`);

    const subtype =
      value.type === "spinner" ? productSpinner : productSpinnerButton;
    await db
      .insert(subtype)
      .values({ id: seededProduct.id })
      .onConflictDoUpdate({
        set: { updatedAt: new Date() },
        target: subtype.id,
      });

    for (const term of value.materialTerms) {
      const slug = materialSlugForTerm(term);
      const materialId = materialIds.get(slug);
      if (!materialId) throw new Error(`Seed material ${slug} is missing.`);
      await db
        .insert(productMaterial)
        .values({ materialId, productId: seededProduct.id })
        .onConflictDoNothing();
    }

    seeded.push({ product: value, productId: seededProduct.id });
  }

  return seeded;
}

/**
 * Seeds each KAP image from the environment-owned or shared baseline prefix.
 *
 * @param db - Database client receiving image records.
 * @param config - Bunny storage settings for the selected environment.
 * @param seededProducts - Persisted products paired with source records.
 * @rejects When an image cannot be verified, copied, or recorded.
 */
export async function seedKapedcImages(
  db: ReturnType<typeof createDb>,
  config: SeedBunnyConfig,
  seededProducts: SeededKapedcProduct[],
): Promise<void> {
  const seedFolderPrefix = seedImageFolderPrefix(config.imageFolderPrefix);
  const storageOwned = seedFolderPrefix !== "images/preview";
  const storage = createUploadStorage({
    accessKey: config.accessKey,
    cdnBaseUrl: config.cdnBaseUrl,
    endpoint: config.endpoint,
    /**
     * Classifies transient storage responses for the operation retry loop.
     *
     * @param request - Bunny request URL or object.
     * @param init - Bunny request options.
     * @returns The permanent or successful Bunny response.
     * @rejects When Bunny returns a transient response or the request fails.
     */
    fetch: async (request, init) => {
      const response = await fetch(request, init);
      await rejectTransientBunnySeedResponse(response);
      return response;
    },
    folderPrefix: config.resourceFolderPrefix,
    imageFolderPrefix: seedFolderPrefix,
    zoneName: config.zoneName,
  });

  for (const seeded of seededProducts) {
    const images = await db
      .select({
        deletedAt: productImage.deletedAt,
        id: productImage.id,
        objectPath: productImage.objectPath,
        position: productImage.position,
        sha256: productImage.sha256,
        storageOwned: productImage.storageOwned,
        uploadedByClerkId: productImage.uploadedByClerkId,
        url: productImage.url,
      })
      .from(productImage)
      .where(eq(productImage.productId, seeded.productId));
    for (const [position, source] of seeded.product.images.entries()) {
      const target = storage.createImageTarget(source, {
        entity: "products",
        entityId: seeded.productId,
      });
      const matching = images.find(({ sha256 }) => sha256 === source.sha256);
      if (
        matching?.deletedAt === null &&
        matching.objectPath === target.objectPath
      ) {
        if (!storageOwned)
          await ensureSeedImage({
            config,
            productName: seeded.product.name,
            source,
            storage,
            storageOwned,
            target,
          });
        const uploadedByClerkId = storageOwned ? seedOwnerClerkId : null;
        if (
          matching.position !== position ||
          matching.storageOwned !== storageOwned ||
          matching.uploadedByClerkId !== uploadedByClerkId ||
          matching.url !== target.url
        )
          await db
            .update(productImage)
            .set({
              position,
              storageOwned,
              uploadedByClerkId,
              url: target.url,
            })
            .where(eq(productImage.id, matching.id));
        continue;
      }

      const targetAlreadyReferenced = images.some(
        ({ objectPath }) => objectPath === target.objectPath,
      );

      try {
        await ensureSeedImage({
          config,
          productName: seeded.product.name,
          source,
          storage,
          storageOwned,
          target,
        });
        const imageValues = {
          contentType: target.contentType,
          deletedAt: null,
          deletedByClerkId: null,
          deletedByRole: null,
          fileName: target.fileName,
          objectPath: target.objectPath,
          position,
          sha256: target.sha256,
          size: target.size,
          storageProvider: "bunny",
          storageOwned,
          uploadedByClerkId: storageOwned ? seedOwnerClerkId : null,
          url: target.url,
        };
        if (matching) {
          await db
            .update(productImage)
            .set(imageValues)
            .where(eq(productImage.id, matching.id));
        } else {
          await db.insert(productImage).values({
            ...imageValues,
            productId: seeded.productId,
          });
        }
      } catch (error) {
        if (storageOwned && !targetAlreadyReferenced)
          await bunnySeedOperation(
            "image cleanup",
            async () => await storage.delete(target.objectPath),
          ).catch(() => undefined);
        throw error;
      }
    }
  }
}

/**
 * Reuses an available immutable seed object or uploads its verified cache
 * source when the selected environment owns the object or the shared baseline
 * has not been populated yet.
 *
 * @param input - Seed source, target, storage, and ownership context.
 * @rejects When availability checks, cache verification, or upload fails.
 */
async function ensureSeedImage(input: {
  /** Bunny settings used to read the import cache. */
  config: SeedBunnyConfig;
  /** Product name used in verification errors. */
  productName: string;
  /** Reviewed seed-image metadata. */
  source: KapedcSeedImage;
  /** Storage client for the selected seed namespace. */
  storage: UploadStorage;
  /** Whether this database owns the target object. */
  storageOwned: boolean;
  /** Content-addressed seed image target. */
  target: UploadTarget;
}): Promise<void> {
  if (!input.storageOwned) {
    const url = new URL(input.target.url);
    url.search = "";
    const response = await bunnySeedRequest(
      "shared image availability check",
      async () =>
        await fetch(url, {
          method: "HEAD",
          signal: AbortSignal.timeout(30_000),
        }),
      async (response) => response,
    );
    if (response.ok) return;
    if (response.status !== 404)
      throw new Error(
        `Shared seed image availability check failed: ${response.status}.`,
      );
  }

  const bytes = await downloadCacheObject(
    input.config,
    input.source.cacheObjectPath,
  );
  if (
    bytes.byteLength !== input.source.size ||
    createHash("sha256").update(bytes).digest("hex") !== input.source.sha256
  ) {
    throw new Error(
      `Cached image verification failed for ${input.productName}.`,
    );
  }
  await bunnySeedOperation(
    "image upload",
    async () =>
      await input.storage.putImage({
        body: bytes,
        contentLength: input.target.size,
        contentType: input.target.contentType,
        objectPath: input.target.objectPath,
      }),
  );
}

/**
 * Seeds every approved non-production baseline record.
 *
 * @param db - Database client receiving the seed values.
 * @param bunnyConfig - Bunny settings used for product images.
 */
export async function seedDatabase(
  db: ReturnType<typeof createDb>,
  bunnyConfig: SeedBunnyConfig,
): Promise<void> {
  await seedUsersAndSettings(db);
  await seedCatalog(db);
  const snapshot = await loadKapedcSeedData();
  const products = await seedKapedcProducts(db, snapshot);
  await seedKapedcImages(db, bunnyConfig, products);
}

/**
 * Downloads a reviewed image from the restricted import cache.
 *
 * @param config - Bunny storage settings.
 * @param objectPath - Validated import-cache object path.
 * @returns Downloaded image bytes.
 * @rejects When the path is invalid or Bunny cannot return the object.
 */
async function downloadCacheObject(
  config: SeedBunnyConfig,
  objectPath: string,
): Promise<Uint8Array> {
  if (!/^imports\/kapedc\/\d+\/[a-zA-Z0-9._-]+$/u.test(objectPath))
    throw new Error("Invalid KAP image cache path.");
  const encodedPath = objectPath.split("/").map(encodeURIComponent).join("/");
  const result = await bunnySeedRequest(
    "image cache download",
    async () =>
      await fetch(
        `${config.endpoint.replace(/\/+$/u, "")}/${encodeURIComponent(config.zoneName)}/${encodedPath}`,
        {
          headers: { AccessKey: config.accessKey },
          signal: AbortSignal.timeout(30_000),
        },
      ),
    async (response) => ({
      bytes: response.ok ? new Uint8Array(await response.arrayBuffer()) : null,
      response,
    }),
  );
  if (!result.response.ok)
    throw new Error(
      `Bunny image cache download failed: ${result.response.status}.`,
    );
  if (!result.bytes) throw new Error("Bunny image cache download was empty.");
  return result.bytes;
}

/**
 * Runs one idempotent Bunny seed request with bounded exponential backoff.
 *
 * Only timeouts, network failures, rate limits, and selected server statuses
 * retry. Permanent responses remain available to the caller for immediate,
 * operation-specific failure handling.
 *
 * @template T - Consumed response type.
 * @param operation - Human-readable seed operation for exhaustion errors.
 * @param request - Idempotent Bunny request to attempt.
 * @param consume - Response consumer that must complete within the attempt.
 * @returns The consumed value from the first permanent or successful response.
 * @rejects When a permanent request error occurs or transient attempts exhaust.
 */
async function bunnySeedRequest<T>(
  operation: string,
  request: () => Promise<Response>,
  consume: BunnySeedResponseConsumer<T>,
): Promise<T> {
  return await bunnySeedOperation(operation, async () => {
    const response = await request();
    await rejectTransientBunnySeedResponse(response);
    try {
      return await consume(response);
    } catch (error) {
      if (isTransientBunnySeedError(error))
        await response.body?.cancel().catch(() => undefined);
      throw error;
    }
  });
}

/**
 * Rejects a retryable Bunny response after releasing its body.
 *
 * @param response - Bunny response to classify.
 * @rejects When the response status is transient.
 */
async function rejectTransientBunnySeedResponse(
  response: Response,
): Promise<void> {
  if (!retryableBunnySeedStatuses.has(response.status)) return;
  await response.body?.cancel().catch(() => undefined);
  throw new TransientBunnySeedError(`Bunny returned ${response.status}.`);
}

/**
 * Runs one idempotent Bunny seed operation with bounded exponential backoff.
 *
 * @template T - Operation result type.
 * @param operation - Human-readable seed operation for exhaustion errors.
 * @param attemptOperation - Complete idempotent operation to retry.
 * @returns The first successful operation result.
 * @rejects When a permanent error occurs or transient attempts exhaust.
 */
async function bunnySeedOperation<T>(
  operation: string,
  attemptOperation: () => Promise<T>,
): Promise<T> {
  let lastFailure: unknown;
  for (let attempt = 1; attempt <= bunnySeedMaxAttempts; attempt += 1) {
    try {
      return await attemptOperation();
    } catch (error) {
      if (!isTransientBunnySeedError(error)) throw error;
      lastFailure = error;
    }

    if (attempt === bunnySeedMaxAttempts)
      throw new Error(
        `Bunny seed ${operation} failed after ${attempt} attempts. It is safe to rerun pnpm db:seed after Bunny recovers.`,
        { cause: lastFailure },
      );
    await new Promise<void>((resolve) =>
      setTimeout(resolve, bunnySeedBackoffMs * 2 ** (attempt - 1)),
    );
  }

  throw new Error(`Bunny seed ${operation} retry invariant failed.`);
}

/**
 * Reports whether a rejected Bunny request is safe to retry.
 *
 * @param error - Request rejection to classify.
 * @returns Whether the rejection represents a timeout or network failure.
 */
function isTransientBunnySeedError(error: unknown): boolean {
  const cause =
    error instanceof TypeError && error.cause && typeof error.cause === "object"
      ? error.cause
      : null;
  const code = cause && "code" in cause ? cause.code : null;
  return (
    error instanceof TransientBunnySeedError ||
    (error instanceof Error &&
      (error.name === "AbortError" || error.name === "TimeoutError")) ||
    (typeof code === "string" && retryableBunnySeedErrorCodes.has(code))
  );
}

/**
 * Reads the Bunny settings required by the seed command.
 *
 * @returns Validated Bunny seed configuration.
 * @throws When a required environment variable is missing.
 */
function readBunnyConfig(): SeedBunnyConfig {
  const entries = {
    accessKey: [
      "BUNNY_STORAGE_ACCESS_KEY",
      process.env.BUNNY_STORAGE_ACCESS_KEY,
    ],
    cdnBaseUrl: ["BUNNY_CDN_BASE_URL", process.env.BUNNY_CDN_BASE_URL],
    endpoint: ["BUNNY_STORAGE_ENDPOINT", process.env.BUNNY_STORAGE_ENDPOINT],
    imageFolderPrefix: [
      "BUNNY_IMAGE_FOLDER_PREFIX",
      process.env.BUNNY_IMAGE_FOLDER_PREFIX,
    ],
    resourceFolderPrefix: [
      "BUNNY_RESOURCE_FOLDER_PREFIX",
      process.env.BUNNY_RESOURCE_FOLDER_PREFIX,
    ],
    zoneName: ["BUNNY_STORAGE_ZONE_NAME", process.env.BUNNY_STORAGE_ZONE_NAME],
  } as const;
  for (const [, [name, value]] of Object.entries(entries))
    if (!value) throw new Error(`${name} is required to seed KAP images.`);
  return Object.fromEntries(
    Object.entries(entries).map(([key, [, value]]) => [key, value]),
  ) as SeedBunnyConfig;
}

/**
 * Seeds the configured database with canonical catalog lookup values.
 *
 * @rejects When the database URL is absent or seeding fails.
 */
async function main() {
  const env = createDatabaseEnv({ DATABASE_URL: process.env.DATABASE_URL });
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to seed the database.");
  }

  await seedDatabase(
    createDb({ databaseUrl: env.DATABASE_URL }),
    readBunnyConfig(),
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
