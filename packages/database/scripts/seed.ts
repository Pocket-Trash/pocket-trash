import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { and, eq, inArray } from "drizzle-orm";
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
  compatibilityFamily,
  finish,
  finishOption,
  finishOptionColor,
  finishOptionFinish,
  magnetConfigurationLabel,
  magnetGroupLabel,
  maker,
  material,
  pattern,
  product,
  productCompatibilityFamily,
  productImage,
  productIncludedComponent,
  productInsertClickOption,
  productInsertMagnetGroup,
  productInsertMagnetOffer,
  productInsertMagnetSlot,
  productMagnetConfiguration,
  productMagnetGroup,
  productMagnetSlot,
  productMaterial,
  productSlider,
  productSliderInsert,
  productSliderInsertOffer,
  productSliderPlate,
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

/** Clerk user that owns deterministic development and preview slider fixtures. */
export const sliderFixtureOwnerClerkId = "user_3JRUuhMIDwBBiLyc4smN8pAtGS9";

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
    name: "Novel Carry",
    rootUrl: "https://novelcarry.com",
    slug: "novel-carry",
  },
  { name: "FidgetBoy", rootUrl: "https://fidgetboy.com", slug: "fidgetboy" },
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

/** Canonical patterns required by deterministic slider discovery fixtures. */
export const seedPatterns = [
  { name: "Machined Grid", slug: "machined-grid" },
  { name: "Ripple", slug: "ripple" },
] as const;

/** One deterministic generated image attached to a fixture product. */
export type SliderFixtureImage = {
  /** Stable image identity used to derive bytes and an object path. */
  key: string;
};

/** Complete body-hosted magnet configuration used by one fixture slider. */
export type SliderFixtureMagnetConfiguration = {
  /** Human-readable configuration label. */
  label: string;
  /** Source-relative layout label. */
  sourceLabel: string;
};

/** One catalog product in the deterministic development slider fixture. */
export type SliderFixtureProduct = {
  /** Maker-scoped compatibility-family slug, when assigned. */
  compatibilityFamily: string | null;
  /** Insert product selected as the advertised default, when applicable. */
  defaultInsertSlug: string | null;
  /** Deterministic generated gallery images. */
  images: SliderFixtureImage[];
  /** Exact included plate product slug for a slider. */
  includedPlateSlug: string | null;
  /** Product magnet-host system for sliders. */
  magnetSystem: "body-hosted" | "insert-driven" | null;
  /** Complete body-hosted configuration, when the source is complete. */
  magnetConfiguration: SliderFixtureMagnetConfiguration | null;
  /** Retained note when a complete body-hosted layout is unavailable. */
  magnetSetupSourceNote: string | null;
  /** Catalog maker display name. */
  maker: "FidgetBoy" | "Magnus Fidgets" | "Novel Carry";
  /** Catalog product display name. */
  name: string;
  /** Optional appearance-pattern slug. */
  pattern: "machined-grid" | "ripple" | null;
  /** Stable product slug. */
  slug: string;
  /** Catalog product subtype. */
  type: "slider" | "slider-insert" | "slider-plate";
  /** Stable meaningful-update timestamp. */
  updatedAt: string;
};

/** Deterministic slider catalog fixture applied to development and preview. */
export type SliderFixtureCatalog = {
  /** Fixture products in stable insertion order. */
  products: SliderFixtureProduct[];
};

/** Persisted default offer used to connect insert-driven slider fixtures. */
type SliderFixtureInsertOffer = {
  /** Persisted insert magnet-offer identifier. */
  id: number;
  /** Persisted slider-insert product identifier. */
  productId: number;
};

/** Maker definitions used to generate the compact slider fixture. */
const sliderFixtureMakers = [
  { name: "Magnus Fidgets" as const, slug: "magnus" },
  { name: "Novel Carry" as const, slug: "novel-carry" },
  { name: "FidgetBoy" as const, slug: "fidgetboy" },
];

/** Deterministic product records used in development and preview databases. */
export const sliderFixtureCatalog: SliderFixtureCatalog = {
  products: [
    ...sliderFixtureMakers.flatMap((fixtureMaker, makerIndex) =>
      Array.from({ length: 7 }, (_, productIndex): SliderFixtureProduct => {
        const ordinal = makerIndex * 7 + productIndex + 1;
        const slug = `${fixtureMaker.slug}-demo-slider-${String(productIndex + 1).padStart(2, "0")}`;
        const bodyHosted = productIndex % 2 === 0;
        const hasCompleteConfiguration = makerIndex === 0 && productIndex === 0;
        const hasIncompleteSource = makerIndex === 1 && productIndex === 2;
        return {
          compatibilityFamily: `${fixtureMaker.slug}-standard`,
          defaultInsertSlug: bodyHosted
            ? null
            : `${fixtureMaker.slug}-demo-insert`,
          images: [
            { key: `${slug}-primary` },
            ...(ordinal === 21 ? [{ key: `${slug}-gallery` }] : []),
          ],
          includedPlateSlug: `${fixtureMaker.slug}-demo-plate`,
          magnetConfiguration: hasCompleteConfiguration
            ? { label: "Medium", sourceLabel: "Four-corner layout" }
            : null,
          magnetSetupSourceNote: hasIncompleteSource
            ? "The maker documents the click count but not every magnet position."
            : null,
          magnetSystem: bodyHosted ? "body-hosted" : "insert-driven",
          maker: fixtureMaker.name,
          name: `${fixtureMaker.name} Demo Slider ${String(productIndex + 1).padStart(2, "0")}`,
          pattern:
            productIndex % 3 === 0
              ? "machined-grid"
              : productIndex % 3 === 1
                ? "ripple"
                : null,
          slug,
          type: "slider" as const,
          updatedAt: new Date(Date.UTC(2026, 7, 1 + ordinal, 12)).toISOString(),
        };
      }),
    ),
    ...sliderFixtureMakers.map((fixtureMaker, index): SliderFixtureProduct => {
      const slug = `${fixtureMaker.slug}-demo-plate`;
      return {
        compatibilityFamily: `${fixtureMaker.slug}-standard`,
        defaultInsertSlug: null,
        images: [
          { key: `${slug}-primary` },
          ...(index === sliderFixtureMakers.length - 1
            ? [{ key: `${slug}-gallery` }]
            : []),
        ],
        includedPlateSlug: null,
        magnetConfiguration: null,
        magnetSetupSourceNote: null,
        magnetSystem: null,
        maker: fixtureMaker.name,
        name: `${fixtureMaker.name} Demo Plate`,
        pattern: index === 0 ? "machined-grid" : null,
        slug,
        type: "slider-plate" as const,
        updatedAt: new Date(Date.UTC(2026, 8, 1 + index, 12)).toISOString(),
      };
    }),
    ...sliderFixtureMakers.map((fixtureMaker, index): SliderFixtureProduct => {
      const slug = `${fixtureMaker.slug}-demo-insert`;
      return {
        compatibilityFamily: `${fixtureMaker.slug}-standard`,
        defaultInsertSlug: null,
        images: [
          { key: `${slug}-primary` },
          ...(index === sliderFixtureMakers.length - 1
            ? [{ key: `${slug}-gallery` }]
            : []),
        ],
        includedPlateSlug: null,
        magnetConfiguration: null,
        magnetSetupSourceNote: null,
        magnetSystem: null,
        maker: fixtureMaker.name,
        name: `${fixtureMaker.name} Demo Insert`,
        pattern: index === 1 ? "ripple" : null,
        slug,
        type: "slider-insert" as const,
        updatedAt: new Date(Date.UTC(2026, 9, 1 + index, 12)).toISOString(),
      };
    }),
  ],
};

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
 * Converts a reviewed catalog snapshot timestamp into a stable seed timestamp.
 *
 * @param importedAt - ISO timestamp recorded with the reviewed source snapshot.
 * @returns Deterministic timestamp reused whenever the snapshot is applied.
 * @throws When the reviewed timestamp is invalid.
 */
export function catalogSeedTimestamp(importedAt: string): Date {
  const timestamp = new Date(importedAt);
  if (Number.isNaN(timestamp.getTime()))
    throw new Error("Catalog seed timestamp is invalid.");
  return timestamp;
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
    [pattern, seedPatterns],
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
  const updatedAt = catalogSeedTimestamp(snapshot.importedAt);

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
      updatedAt,
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
        set: { updatedAt },
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

/** Tiny valid PNG payloads used by generated fixture galleries. */
const sliderFixturePngs = [
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZCwAAAABJRU5ErkJggg==",
] as const;

/**
 * Returns stable, valid PNG bytes for one fixture gallery position.
 *
 * @param position - Zero-based image position.
 * @returns Deterministic PNG bytes.
 */
function sliderFixtureImageBytes(position: number): Uint8Array {
  return Buffer.from(
    sliderFixturePngs[position % sliderFixturePngs.length] ??
      sliderFixturePngs[0],
    "base64",
  );
}

/**
 * Uploads and records generated fixture images without duplicating rows or
 * rewriting already-active objects on repeated seed runs.
 *
 * @param db - Database client receiving image records.
 * @param storage - Environment-scoped upload storage.
 * @param productId - Persisted fixture product identifier.
 * @param images - Ordered deterministic fixture images.
 * @rejects When image validation, upload, or persistence fails.
 */
async function seedSliderFixtureImages(
  db: ReturnType<typeof createDb>,
  storage: UploadStorage,
  productId: number,
  images: SliderFixtureImage[],
) {
  const existing = await db
    .select({
      deletedAt: productImage.deletedAt,
      id: productImage.id,
      objectPath: productImage.objectPath,
      position: productImage.position,
      sha256: productImage.sha256,
    })
    .from(productImage)
    .where(eq(productImage.productId, productId));
  for (const [position, image] of images.entries()) {
    const bytes = sliderFixtureImageBytes(position);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const target = storage.createImageTarget(
      {
        contentType: "image/png",
        fileName: `${image.key}.png`,
        sha256,
        size: bytes.byteLength,
      },
      { entity: "products", entityId: productId },
    );
    const matching = existing.find((candidate) => candidate.sha256 === sha256);
    if (
      matching?.deletedAt === null &&
      matching.objectPath === target.objectPath
    ) {
      if (matching.position !== position)
        await db
          .update(productImage)
          .set({ position })
          .where(eq(productImage.id, matching.id));
      continue;
    }
    await storage.putImage({
      body: bytes,
      contentLength: target.size,
      contentType: target.contentType,
      objectPath: target.objectPath,
    });
    const values = {
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
      uploadedByClerkId: sliderFixtureOwnerClerkId,
      url: target.url,
    } as const;
    if (matching) {
      await db
        .update(productImage)
        .set(values)
        .where(eq(productImage.id, matching.id));
    } else {
      await db.insert(productImage).values({ ...values, productId });
    }
  }
}

/**
 * Seeds the compact deterministic slider catalog used by development and
 * preview deployments.
 *
 * @param db - Database client receiving fixture records.
 * @param storage - Environment-scoped storage receiving generated fixture images.
 * @rejects When required catalog lookups are missing or any write fails.
 */
export async function seedSliderFixtures(
  db: ReturnType<typeof createDb>,
  storage: UploadStorage,
): Promise<void> {
  const makerRows = await db
    .select({ id: maker.id, name: maker.name })
    .from(maker)
    .where(
      inArray(
        maker.name,
        sliderFixtureMakers.map(({ name }) => name),
      ),
    );
  const makersByName = new Map(makerRows.map(({ id, name }) => [name, id]));
  const typeRows = await db
    .select({ id: productType.id, slug: productType.slug })
    .from(productType)
    .where(
      inArray(productType.slug, ["slider", "slider-plate", "slider-insert"]),
    );
  const typesBySlug = new Map(typeRows.map(({ id, slug }) => [slug, id]));
  const [titanium] = await db
    .select({ id: material.id })
    .from(material)
    .where(eq(material.slug, "titanium"))
    .limit(1);
  const [machineFinish] = await db
    .select({ id: finish.id })
    .from(finish)
    .where(eq(finish.slug, "machine-finished"))
    .limit(1);
  const [solidEffect] = await db
    .select({ id: colorEffect.id })
    .from(colorEffect)
    .where(eq(colorEffect.slug, "solid"))
    .limit(1);
  const [silver] = await db
    .select({ id: color.id })
    .from(color)
    .where(eq(color.slug, "silver"))
    .limit(1);
  const patternRows = await db
    .select({ id: pattern.id, slug: pattern.slug })
    .from(pattern)
    .where(
      inArray(
        pattern.slug,
        seedPatterns.map(({ slug }) => slug),
      ),
    );
  const patternsBySlug = new Map(patternRows.map(({ id, slug }) => [slug, id]));
  if (!titanium || !machineFinish || !solidEffect || !silver)
    throw new Error(
      "Slider fixture lookups are missing after catalog seeding.",
    );

  const familyIds = new Map<string, number>();
  for (const fixtureMaker of sliderFixtureMakers) {
    const makerId = makersByName.get(fixtureMaker.name);
    if (!makerId)
      throw new Error(`Slider fixture maker ${fixtureMaker.name} is missing.`);
    const familySlug = `${fixtureMaker.slug}-standard`;
    const updatedAt = new Date("2026-08-01T12:00:00.000Z");
    const [family] = await db
      .insert(compatibilityFamily)
      .values({
        makerId,
        name: `${fixtureMaker.name} Standard`,
        slug: familySlug,
        updatedAt,
      })
      .onConflictDoUpdate({
        set: { name: `${fixtureMaker.name} Standard`, updatedAt },
        target: [compatibilityFamily.makerId, compatibilityFamily.slug],
      })
      .returning({ id: compatibilityFamily.id });
    if (!family) throw new Error(`Failed to seed family ${familySlug}.`);
    familyIds.set(familySlug, family.id);
  }

  const productIds = new Map<string, number>();
  for (const fixtureProduct of sliderFixtureCatalog.products) {
    const makerId = makersByName.get(fixtureProduct.maker);
    const productTypeId = typesBySlug.get(fixtureProduct.type);
    if (!makerId || !productTypeId)
      throw new Error(
        `Fixture lookups are missing for ${fixtureProduct.slug}.`,
      );
    const updatedAt = catalogSeedTimestamp(fixtureProduct.updatedAt);
    const productValues = {
      approvalStatus: "approved" as const,
      description: `Deterministic ${fixtureProduct.maker} development fixture.`,
      isPrivate: false,
      makerId,
      makerProductUrl: null,
      makerProductUrlValid: false,
      name: fixtureProduct.name,
      ownerClerkId: sliderFixtureOwnerClerkId,
      productTypeId,
      slug: fixtureProduct.slug,
      updatedAt,
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
      throw new Error(`Failed to seed fixture ${fixtureProduct.slug}.`);
    productIds.set(fixtureProduct.slug, seededProduct.id);

    if (fixtureProduct.type === "slider") {
      await db
        .insert(productSlider)
        .values({
          id: seededProduct.id,
          inherentClickCount:
            fixtureProduct.magnetSystem === "body-hosted" ? 4 : null,
          lengthMm: "52",
          magnetSetupSourceNote: fixtureProduct.magnetSetupSourceNote,
          magnetSystem: fixtureProduct.magnetSystem ?? "body-hosted",
          thicknessMm: "12",
          updatedAt,
          weightBasis: "complete-build",
          weightG: "96",
          widthMm: "24",
        })
        .onConflictDoUpdate({
          set: {
            inherentClickCount:
              fixtureProduct.magnetSystem === "body-hosted" ? 4 : null,
            lengthMm: "52",
            magnetSetupSourceNote: fixtureProduct.magnetSetupSourceNote,
            magnetSystem: fixtureProduct.magnetSystem ?? "body-hosted",
            thicknessMm: "12",
            updatedAt,
            weightBasis: "complete-build",
            weightG: "96",
            widthMm: "24",
          },
          target: productSlider.id,
        });
    } else {
      const subtype =
        fixtureProduct.type === "slider-plate"
          ? productSliderPlate
          : productSliderInsert;
      await db
        .insert(subtype)
        .values({
          id: seededProduct.id,
          lengthMm: "48",
          thicknessMm: "4",
          updatedAt,
          weightG: "24",
          widthMm: "20",
        })
        .onConflictDoUpdate({
          set: {
            lengthMm: "48",
            thicknessMm: "4",
            updatedAt,
            weightG: "24",
            widthMm: "20",
          },
          target: subtype.id,
        });
    }

    await db
      .insert(productMaterial)
      .values({ materialId: titanium.id, productId: seededProduct.id })
      .onConflictDoNothing();
    const patternId = fixtureProduct.pattern
      ? patternsBySlug.get(fixtureProduct.pattern)
      : null;
    if (fixtureProduct.pattern && !patternId)
      throw new Error(`Fixture pattern ${fixtureProduct.pattern} is missing.`);
    const [appearance] = await db
      .insert(finishOption)
      .values({
        colorEffectId: solidEffect.id,
        patternId,
        position: 0,
        productId: seededProduct.id,
      })
      .onConflictDoUpdate({
        set: { colorEffectId: solidEffect.id, patternId },
        target: [finishOption.productId, finishOption.position],
      })
      .returning({ id: finishOption.id });
    if (!appearance)
      throw new Error(`Failed to seed appearance for ${fixtureProduct.slug}.`);
    await Promise.all([
      db
        .insert(finishOptionFinish)
        .values({
          finishId: machineFinish.id,
          finishOptionId: appearance.id,
          position: 0,
        })
        .onConflictDoNothing(),
      db
        .insert(finishOptionColor)
        .values({
          colorId: silver.id,
          finishOptionId: appearance.id,
          position: 0,
        })
        .onConflictDoNothing(),
    ]);
    if (fixtureProduct.compatibilityFamily) {
      const compatibilityFamilyId = familyIds.get(
        fixtureProduct.compatibilityFamily,
      );
      if (!compatibilityFamilyId)
        throw new Error(
          `Fixture family ${fixtureProduct.compatibilityFamily} is missing.`,
        );
      await db
        .insert(productCompatibilityFamily)
        .values({
          compatibilityFamilyId,
          productId: seededProduct.id,
          reviewedAt: updatedAt,
          reviewedByClerkId: sliderFixtureOwnerClerkId,
        })
        .onConflictDoUpdate({
          set: {
            reviewedAt: updatedAt,
            reviewedByClerkId: sliderFixtureOwnerClerkId,
          },
          target: [
            productCompatibilityFamily.productId,
            productCompatibilityFamily.compatibilityFamilyId,
          ],
        });
    }
  }

  const [configurationLabel] = await db
    .insert(magnetConfigurationLabel)
    .values({ name: "Medium", normalizedName: "medium" })
    .onConflictDoUpdate({
      set: { name: "Medium" },
      target: magnetConfigurationLabel.normalizedName,
    })
    .returning({ id: magnetConfigurationLabel.id });
  const [groupLabel] = await db
    .insert(magnetGroupLabel)
    .values({ name: "Corners", normalizedName: "corners" })
    .onConflictDoUpdate({
      set: { name: "Corners" },
      target: magnetGroupLabel.normalizedName,
    })
    .returning({ id: magnetGroupLabel.id });
  if (!configurationLabel || !groupLabel)
    throw new Error("Slider fixture magnet vocabulary could not be seeded.");

  const insertOffers = new Map<string, SliderFixtureInsertOffer>();
  for (const fixtureInsert of sliderFixtureCatalog.products.filter(
    ({ type }) => type === "slider-insert",
  )) {
    const insertProductId = productIds.get(fixtureInsert.slug);
    if (!insertProductId)
      throw new Error(`Fixture insert ${fixtureInsert.slug} is missing.`);
    const [clickOption] = await db
      .insert(productInsertClickOption)
      .values({ clickCount: 3, insertProductId, insertionPosition: 0 })
      .onConflictDoUpdate({
        set: { insertionPosition: 0 },
        target: [
          productInsertClickOption.insertProductId,
          productInsertClickOption.clickCount,
        ],
      })
      .returning({ id: productInsertClickOption.id });
    if (!clickOption)
      throw new Error(`Fixture click option ${fixtureInsert.slug} is missing.`);
    const [existingOffer] = await db
      .select({ id: productInsertMagnetOffer.id })
      .from(productInsertMagnetOffer)
      .where(
        and(
          eq(productInsertMagnetOffer.insertProductId, insertProductId),
          eq(productInsertMagnetOffer.isAdvertisedDefault, true),
        ),
      )
      .limit(1);
    const offerValues = {
      clickOptionId: clickOption.id,
      configurationLabelId: configurationLabel.id,
      isAdvertisedDefault: true,
      sourceLabel: "Default setup",
      sourceNotes: null,
    };
    let offerId = existingOffer?.id;
    if (offerId) {
      await db
        .update(productInsertMagnetOffer)
        .set(offerValues)
        .where(eq(productInsertMagnetOffer.id, offerId));
    } else {
      const [offer] = await db
        .insert(productInsertMagnetOffer)
        .values({ ...offerValues, insertProductId })
        .returning({ id: productInsertMagnetOffer.id });
      offerId = offer?.id;
    }
    if (!offerId)
      throw new Error(`Fixture offer ${fixtureInsert.slug} is missing.`);
    const [group] = await db
      .insert(productInsertMagnetGroup)
      .values({
        diameterMm: "6.35",
        displayOrder: 0,
        grade: "N52",
        groupKey: "corners",
        groupLabelId: groupLabel.id,
        offerId,
        thicknessMm: "3.175",
      })
      .onConflictDoUpdate({
        set: {
          diameterMm: "6.35",
          displayOrder: 0,
          grade: "N52",
          groupLabelId: groupLabel.id,
          thicknessMm: "3.175",
        },
        target: [
          productInsertMagnetGroup.offerId,
          productInsertMagnetGroup.groupKey,
        ],
      })
      .returning({ id: productInsertMagnetGroup.id });
    if (!group)
      throw new Error(`Fixture magnet group ${fixtureInsert.slug} is missing.`);
    for (const [displayOrder, half] of ["half-a", "half-b"].entries()) {
      await db
        .insert(productInsertMagnetSlot)
        .values({
          displayOrder,
          documentedColumn: 1,
          documentedRow: 1,
          groupId: group.id,
          half: half as "half-a" | "half-b",
          offerId,
          slotKey: half === "half-a" ? "A1" : "B1",
          state: "occupied",
        })
        .onConflictDoUpdate({
          set: { displayOrder, groupId: group.id, state: "occupied" },
          target: [
            productInsertMagnetSlot.offerId,
            productInsertMagnetSlot.slotKey,
          ],
        });
    }
    insertOffers.set(fixtureInsert.slug, {
      id: offerId,
      productId: insertProductId,
    });
  }

  for (const fixtureSlider of sliderFixtureCatalog.products.filter(
    ({ type }) => type === "slider",
  )) {
    const sliderProductId = productIds.get(fixtureSlider.slug);
    const plateProductId = fixtureSlider.includedPlateSlug
      ? productIds.get(fixtureSlider.includedPlateSlug)
      : null;
    if (!sliderProductId || !plateProductId)
      throw new Error(`Fixture assembly ${fixtureSlider.slug} is incomplete.`);
    await db
      .insert(productIncludedComponent)
      .values({
        componentProductId: plateProductId,
        productId: sliderProductId,
      })
      .onConflictDoNothing();

    if (fixtureSlider.magnetConfiguration) {
      await db
        .insert(productMagnetConfiguration)
        .values({
          configurationLabelId: configurationLabel.id,
          productId: sliderProductId,
          sourceLabel: fixtureSlider.magnetConfiguration.sourceLabel,
          sourceNotes: null,
        })
        .onConflictDoUpdate({
          set: {
            configurationLabelId: configurationLabel.id,
            sourceLabel: fixtureSlider.magnetConfiguration.sourceLabel,
            sourceNotes: null,
          },
          target: productMagnetConfiguration.productId,
        });
      const [group] = await db
        .insert(productMagnetGroup)
        .values({
          configurationProductId: sliderProductId,
          diameterMm: "6.35",
          displayOrder: 0,
          grade: "N52",
          groupKey: "corners",
          groupLabelId: groupLabel.id,
          thicknessMm: "3.175",
        })
        .onConflictDoUpdate({
          set: {
            diameterMm: "6.35",
            displayOrder: 0,
            grade: "N52",
            groupLabelId: groupLabel.id,
            thicknessMm: "3.175",
          },
          target: [
            productMagnetGroup.configurationProductId,
            productMagnetGroup.groupKey,
          ],
        })
        .returning({ id: productMagnetGroup.id });
      if (!group)
        throw new Error(`Fixture body group ${fixtureSlider.slug} is missing.`);
      for (const [displayOrder, half] of ["half-a", "half-b"].entries()) {
        await db
          .insert(productMagnetSlot)
          .values({
            configurationProductId: sliderProductId,
            displayOrder,
            documentedColumn: 1,
            documentedRow: 1,
            groupId: group.id,
            half: half as "half-a" | "half-b",
            slotKey: half === "half-a" ? "A1" : "B1",
            state: "occupied",
          })
          .onConflictDoUpdate({
            set: { displayOrder, groupId: group.id, state: "occupied" },
            target: [
              productMagnetSlot.configurationProductId,
              productMagnetSlot.slotKey,
            ],
          });
      }
    }

    if (fixtureSlider.defaultInsertSlug) {
      const insertOffer = insertOffers.get(fixtureSlider.defaultInsertSlug);
      if (!insertOffer)
        throw new Error(
          `Fixture default ${fixtureSlider.defaultInsertSlug} is missing.`,
        );
      await db
        .insert(productSliderInsertOffer)
        .values({
          insertOfferId: insertOffer.id,
          insertProductId: insertOffer.productId,
          isAdvertisedDefault: true,
          sliderProductId,
        })
        .onConflictDoUpdate({
          set: { isAdvertisedDefault: true },
          target: [
            productSliderInsertOffer.sliderProductId,
            productSliderInsertOffer.insertOfferId,
          ],
        });
    }
  }

  for (const fixtureProduct of sliderFixtureCatalog.products) {
    const productId = productIds.get(fixtureProduct.slug);
    if (!productId)
      throw new Error(`Fixture image owner ${fixtureProduct.slug} is missing.`);
    await seedSliderFixtureImages(
      db,
      storage,
      productId,
      fixtureProduct.images,
    );
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
  await seedSliderFixtures(
    db,
    createUploadStorage({
      accessKey: bunnyConfig.accessKey,
      cdnBaseUrl: bunnyConfig.cdnBaseUrl,
      endpoint: bunnyConfig.endpoint,
      folderPrefix: bunnyConfig.resourceFolderPrefix,
      imageFolderPrefix: bunnyConfig.imageFolderPrefix,
      zoneName: bunnyConfig.zoneName,
    }),
  );
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
