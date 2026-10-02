import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { eq, inArray } from "drizzle-orm";
import { createUploadStorage } from "../../storage/src/index.js";
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
  { name: "Fountain Pen", slug: "fountain-pen" },
] as const;

/**
 * Canonical makers inserted or updated by the catalog seed.
 *
 * @internal
 */
export const seedMakers = [
  { name: "Autmog", rootUrl: "https://www.autmog.com" },
  { name: "Inventery", rootUrl: "https://www.inventery.co" },
  { name: "KAP EDC", rootUrl: "https://www.kapedc.com" },
  { name: "Clean EDC", rootUrl: "https://cleanedc.com" },
  { name: "Magnus Fidgets", rootUrl: "https://magnusfidgets.com" },
  {
    name: "Full Throttle Originals",
    rootUrl: "https://fullthrottleoriginals.com",
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
 * Reports whether a seeded image already belongs to the selected environment.
 *
 * @param objectPath - Stored Bunny image object path.
 * @param imageFolderPrefix - Selected environment image prefix.
 * @returns Whether the object path is inside the selected prefix.
 */
export function isSeedImageInTargetPrefix(
  objectPath: string,
  imageFolderPrefix: string,
): boolean {
  return objectPath.startsWith(
    `${imageFolderPrefix.replace(/^\/+|\/+$/gu, "")}/`,
  );
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
      await db.insert(maker).values({ name: value.name, rootUrl });
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
 * Copies each cached KAP image into the selected environment prefix.
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
  const storage = createUploadStorage({
    accessKey: config.accessKey,
    cdnBaseUrl: config.cdnBaseUrl,
    endpoint: config.endpoint,
    folderPrefix: config.resourceFolderPrefix,
    imageFolderPrefix: config.imageFolderPrefix,
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
      })
      .from(productImage)
      .where(eq(productImage.productId, seeded.productId));
    for (const [position, source] of seeded.product.images.entries()) {
      const matching = images.find(({ sha256 }) => sha256 === source.sha256);
      if (
        matching?.deletedAt === null &&
        isSeedImageInTargetPrefix(matching.objectPath, config.imageFolderPrefix)
      ) {
        if (matching.position !== position)
          await db
            .update(productImage)
            .set({ position })
            .where(eq(productImage.id, matching.id));
        continue;
      }

      const bytes = await downloadCacheObject(config, source.cacheObjectPath);
      if (
        bytes.byteLength !== source.size ||
        createHash("sha256").update(bytes).digest("hex") !== source.sha256
      ) {
        throw new Error(
          `Cached image verification failed for ${seeded.product.name}.`,
        );
      }
      const target = storage.createImageTarget(source, {
        entity: "products",
        entityId: seeded.productId,
      });
      const targetAlreadyReferenced = images.some(
        ({ objectPath }) => objectPath === target.objectPath,
      );

      try {
        await storage.putImage({
          body: bytes,
          contentLength: target.size,
          contentType: target.contentType,
          objectPath: target.objectPath,
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
          uploadedByClerkId: seedOwnerClerkId,
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
        if (!targetAlreadyReferenced)
          await storage.delete(target.objectPath).catch(() => undefined);
        throw error;
      }
    }
  }
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
  const response = await fetch(
    `${config.endpoint.replace(/\/+$/u, "")}/${encodeURIComponent(config.zoneName)}/${encodedPath}`,
    {
      headers: { AccessKey: config.accessKey },
      signal: AbortSignal.timeout(30_000),
    },
  );
  if (!response.ok)
    throw new Error(`Bunny image cache download failed: ${response.status}.`);
  return new Uint8Array(await response.arrayBuffer());
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
