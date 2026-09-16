import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export type AutmogPenImageRecord = {
  altText: string | null;
  height: number | null;
  position: number;
  sourceHash: string;
  sourceImageId: string | null;
  sourceUrl: string;
  width: number | null;
};

export type AutmogPenNormalizedData = {
  availableForSale: boolean;
  bodyDetails: string[];
  bodyShape: string | null;
  category: string | null;
  clip: string | null;
  finish: string | null;
  grip: string | null;
  imageSetHash: string;
  images: AutmogPenImageRecord[];
  materials: string[];
  mechanism: string | null;
  nose: string | null;
  priceMaxCents: number | null;
  priceMinCents: number | null;
  productUrl: string;
  refill: string | null;
  size: string | null;
  title: string;
  variants: unknown[];
};

export type GrimsmoProductNormalizedData = {
  productHandle: string;
  productUrl: string;
  title: string;
};

export type GrimsmoVariationImageRecord = {
  altText: string | null;
  height: number | null;
  position: number;
  sourceHash: string;
  sourceImageId: string | null;
  sourceUrl: string;
  width: number | null;
};

export type GrimsmoPenVariationNormalizedData = {
  availableForSale: boolean;
  bodyColors: string[];
  bodyFinishes: string[];
  bodyMaterials: string[];
  book: string | null;
  bullets: string[];
  bulletsByCategory: Record<string, string[]>;
  case: string | null;
  description: string | null;
  engraving: string | null;
  imageSetHash: string;
  images: GrimsmoVariationImageRecord[];
  priceMaxCents: number | null;
  priceMinCents: number | null;
  productUrl: string;
  refill: string | null;
  sagaNumber: string | null;
  sliderColors: string[];
  sliderMaterials: string[];
  sliderStyle: string | null;
  tipLogo: string | null;
  title: string;
  titleFull: string;
  variants: unknown[];
  visibleBullets: string[];
};

export type GrimsmoKnifeVariationNormalizedData = {
  availableForSale: boolean;
  bladeFinishes: string[];
  bladeSteels: string[];
  bodyText: string | null;
  bullets: string[];
  bulletsByCategory: Record<string, string[]>;
  case: string | null;
  description: string | null;
  handleColors: string[];
  handleFinishes: string[];
  handleMaterials: string[];
  hardwareColors: string[];
  imageSetHash: string;
  images: GrimsmoVariationImageRecord[];
  knifeNumber: string | null;
  knifeType: string;
  mechanisms: string[];
  patterns: string[];
  priceMaxCents: number | null;
  priceMinCents: number | null;
  productUrl: string;
  title: string;
  titleFull: string;
  variants: unknown[];
};

export type ScraperRunStats = {
  archivedCount?: number;
  deadLetterFailedImageJobs?: number;
  deadLetterFailedItemJobs?: number;
  deadLetterRequeueFailedImageJobs?: number;
  deadLetterRequeueFailedItemJobs?: number;
  deadLetterRequeuedImageJobs?: number;
  deadLetterRequeuedItemJobs?: number;
  enqueuedImageJobs?: number;
  enqueuedItemJobs?: number;
  failedImageJobs?: number;
  failedItemJobs?: number;
  fetchedCount?: number;
  processedImageJobs?: number;
  processedItemJobs?: number;
  skippedImageJobs?: number;
  updatedCount?: number;
};

export const maker = pgTable(
  "maker",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity({ startWith: 1000 }),
    name: text("name").notNull(),
    rootUrl: text("root_url"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    rootUrlUnique: uniqueIndex("makers_root_url_unique").on(table.rootUrl),
  }),
);

export const scraperRuns = pgTable(
  "scraper_runs",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity({ startWith: 1000 }),
    source: text("source").notNull(),
    jobType: text("job_type").notNull(),
    status: text("status").notNull(),
    startedAt: timestamp("started_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    finishedAt: timestamp("finished_at", { mode: "date", withTimezone: true }),
    heartbeatAt: timestamp("heartbeat_at", {
      mode: "date",
      withTimezone: true,
    }),
    errorMessage: text("error_message"),
    stats: jsonb("stats")
      .$type<ScraperRunStats>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
  },
  (table) => ({
    sourceJobStatusIdx: index("scraper_runs_source_job_status_idx").on(
      table.source,
      table.jobType,
      table.status,
    ),
    startedAtIdx: index("scraper_runs_started_at_idx").on(table.startedAt),
  }),
);

export const material = pgTable(
  "material",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity({ startWith: 1000 }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    slugUnique: uniqueIndex("materials_slug_unique").on(table.slug),
  }),
);

export const mechanism = pgTable(
  "mechanism",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity({ startWith: 1000 }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    slugUnique: uniqueIndex("mechanisms_slug_unique").on(table.slug),
  }),
);

export const productType = pgTable(
  "product_type",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity({ startWith: 1000 }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    imageUrl: text("image_url"),
    imageAlt: text("image_alt"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    slugUnique: uniqueIndex("product_types_slug_unique").on(table.slug),
  }),
);

export const tmpProducts = pgTable(
  "tmp_products",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity({ startWith: 1000 }),
    source: text("source").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    sourceIdx: index("tmp_products_source_idx").on(table.source),
  }),
);

export const tmpProductVariations = pgTable(
  "tmp_product_variations",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity({ startWith: 1000 }),
    productId: bigint("product_id", { mode: "number" })
      .notNull()
      .references(() => tmpProducts.id, { onDelete: "cascade" }),
    sourceKey: text("source_key").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    productIdIdx: index("tmp_product_variations_product_id_idx").on(
      table.productId,
    ),
    productSourceKeyUnique: uniqueIndex(
      "tmp_product_variations_product_source_key_unique",
    ).on(table.productId, table.sourceKey),
    idProductIdUnique: uniqueIndex(
      "tmp_product_variations_id_product_id_unique",
    ).on(table.id, table.productId),
  }),
);

export const tmpImages = pgTable(
  "tmp_images",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity({ startWith: 1000 }),
    productId: bigint("product_id", { mode: "number" })
      .notNull()
      .references(() => tmpProducts.id, { onDelete: "cascade" }),
    productVariationId: bigint("product_variation_id", {
      mode: "number",
    }).references(() => tmpProductVariations.id, { onDelete: "cascade" }),
    sourceImageId: text("source_image_id"),
    sourceUrl: text("source_url").notNull(),
    position: integer("position").notNull(),
    altText: text("alt_text"),
    width: integer("width"),
    height: integer("height"),
    sourceHash: text("source_hash").notNull(),
    imageProvider: text("image_provider"),
    imageFileId: text("image_file_id"),
    imagePath: text("image_path"),
    imageUrl: text("image_url"),
    status: text("status").notNull().default("pending_upload"),
    uploadedAt: timestamp("uploaded_at", { mode: "date", withTimezone: true }),
    pendingDeleteAt: timestamp("pending_delete_at", {
      mode: "date",
      withTimezone: true,
    }),
    deletedAt: timestamp("deleted_at", { mode: "date", withTimezone: true }),
    lastSeenAt: timestamp("last_seen_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    productIdIdx: index("tmp_images_product_id_idx").on(table.productId),
    productImageSourceHashUnique: uniqueIndex(
      "tmp_images_product_source_hash_unique",
    )
      .on(table.productId, table.sourceHash)
      .where(sql`${table.productVariationId} is null`),
    productVariationIdIdx: index("tmp_images_product_variation_id_idx").on(
      table.productVariationId,
    ),
    productVariationProductFk: foreignKey({
      columns: [table.productVariationId, table.productId],
      foreignColumns: [tmpProductVariations.id, tmpProductVariations.productId],
      name: "tmp_images_product_variation_product_fk",
    }),
    statusIdx: index("tmp_images_status_idx").on(table.status),
    variationImageSourceHashUnique: uniqueIndex(
      "tmp_images_variation_source_hash_unique",
    )
      .on(table.productVariationId, table.sourceHash)
      .where(sql`${table.productVariationId} is not null`),
  }),
);

export const tmpAutmogPens = pgTable(
  "tmp_autmog_pens",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity({ startWith: 1000 }),
    productId: bigint("product_id", { mode: "number" })
      .notNull()
      .references(() => tmpProducts.id, { onDelete: "cascade" }),
    makerId: bigint("maker_id", { mode: "number" })
      .notNull()
      .references(() => maker.id, { onDelete: "restrict" }),
    mechanismId: bigint("mechanism_id", { mode: "number" }).references(
      () => mechanism.id,
      { onDelete: "restrict" },
    ),
    sourceProductId: text("source_product_id").notNull(),
    sourceHandle: text("source_handle").notNull(),
    title: text("title").notNull(),
    productUrl: text("product_url").notNull(),
    description: text("description"),
    size: text("size"),
    refill: text("refill"),
    nose: text("nose"),
    clip: text("clip"),
    grip: text("grip"),
    finish: text("finish"),
    bodyDetails: jsonb("body_details")
      .$type<string[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    tags: jsonb("tags").$type<string[]>().default(sql`'[]'::jsonb`).notNull(),
    variants: jsonb("variants")
      .$type<unknown[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    normalizedData: jsonb("normalized_data")
      .$type<AutmogPenNormalizedData>()
      .notNull(),
    detailsHash: text("details_hash").notNull(),
    imageSetHash: text("image_set_hash").notNull(),
    priceMinCents: integer("price_min_cents"),
    priceMaxCents: integer("price_max_cents"),
    currencyCode: text("currency_code").notNull().default("USD"),
    availableForSale: boolean("available_for_sale").notNull().default(false),
    archivedAt: timestamp("archived_at", { mode: "date", withTimezone: true }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    makerIdIdx: index("tmp_autmog_pens_maker_id_idx").on(table.makerId),
    mechanismIdIdx: index("tmp_autmog_pens_mechanism_id_idx").on(
      table.mechanismId,
    ),
    productIdUnique: uniqueIndex("tmp_autmog_pens_product_id_unique").on(
      table.productId,
    ),
    sourceProductIdUnique: uniqueIndex(
      "tmp_autmog_pens_source_product_id_unique",
    ).on(table.sourceProductId),
  }),
);

export const tmpAutmogPenMaterials = pgTable(
  "tmp_autmog_pen_materials",
  {
    penId: bigint("pen_id", { mode: "number" })
      .notNull()
      .references(() => tmpAutmogPens.id, { onDelete: "cascade" }),
    materialId: bigint("material_id", { mode: "number" })
      .notNull()
      .references(() => material.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    materialIdIdx: index("tmp_autmog_pen_materials_material_id_idx").on(
      table.materialId,
    ),
    pk: primaryKey({
      columns: [table.penId, table.materialId],
      name: "tmp_autmog_pen_materials_pk",
    }),
  }),
);

export const tmpGrimsmoPens = pgTable(
  "tmp_grimsmo_pens",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity({ startWith: 1000 }),
    productId: bigint("product_id", { mode: "number" })
      .notNull()
      .references(() => tmpProducts.id, { onDelete: "cascade" }),
    makerId: bigint("maker_id", { mode: "number" })
      .notNull()
      .references(() => maker.id, { onDelete: "restrict" }),
    productHandle: text("product_handle").notNull(),
    title: text("title").notNull(),
    productUrl: text("product_url").notNull(),
    normalizedData: jsonb("normalized_data")
      .$type<GrimsmoProductNormalizedData>()
      .notNull(),
    detailsHash: text("details_hash").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    makerIdIdx: index("tmp_grimsmo_pens_maker_id_idx").on(table.makerId),
    productIdUnique: uniqueIndex("tmp_grimsmo_pens_product_id_unique").on(
      table.productId,
    ),
    productHandleUnique: uniqueIndex(
      "tmp_grimsmo_pens_product_handle_unique",
    ).on(table.productHandle),
  }),
);

export const tmpGrimsmoPenVariations = pgTable(
  "tmp_grimsmo_pen_variations",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity({ startWith: 1000 }),
    productVariationId: bigint("product_variation_id", { mode: "number" })
      .notNull()
      .references(() => tmpProductVariations.id, { onDelete: "cascade" }),
    penId: bigint("pen_id", { mode: "number" })
      .notNull()
      .references(() => tmpGrimsmoPens.id, { onDelete: "cascade" }),
    sourceProductId: text("source_product_id").notNull(),
    sourceHandle: text("source_handle").notNull(),
    sourceCollection: text("source_collection").notNull(),
    title: text("title").notNull(),
    titleFull: text("title_full").notNull(),
    productUrl: text("product_url").notNull(),
    description: text("description"),
    bodyText: text("body_text"),
    sagaNumber: text("saga_number"),
    bullets: jsonb("bullets")
      .$type<string[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    bulletsByCategory: jsonb("bullets_by_category")
      .$type<Record<string, string[]>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    visibleBullets: jsonb("visible_bullets")
      .$type<string[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    bodyFinishes: jsonb("body_finishes")
      .$type<string[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    bodyColors: jsonb("body_colors")
      .$type<string[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    bodyMaterials: jsonb("body_materials")
      .$type<string[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    sliderStyle: text("slider_style"),
    sliderMaterials: jsonb("slider_materials")
      .$type<string[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    sliderColors: jsonb("slider_colors")
      .$type<string[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    refill: text("refill"),
    case: text("case"),
    engraving: text("engraving"),
    tipLogo: text("tip_logo"),
    book: text("book"),
    tags: jsonb("tags").$type<string[]>().default(sql`'[]'::jsonb`).notNull(),
    variants: jsonb("variants")
      .$type<unknown[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    normalizedData: jsonb("normalized_data")
      .$type<GrimsmoPenVariationNormalizedData>()
      .notNull(),
    detailsHash: text("details_hash").notNull(),
    imageSetHash: text("image_set_hash").notNull(),
    priceMinCents: integer("price_min_cents"),
    priceMaxCents: integer("price_max_cents"),
    currencyCode: text("currency_code").notNull().default("USD"),
    availableForSale: boolean("available_for_sale").notNull().default(false),
    archivedAt: timestamp("archived_at", { mode: "date", withTimezone: true }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    penHandleUnique: uniqueIndex(
      "tmp_grimsmo_pen_variations_pen_handle_unique",
    ).on(table.penId, table.sourceHandle),
    penIdIdx: index("tmp_grimsmo_pen_variations_pen_id_idx").on(table.penId),
    productVariationIdUnique: uniqueIndex(
      "tmp_grimsmo_pen_variations_product_variation_id_unique",
    ).on(table.productVariationId),
    sourceProductIdIdx: index(
      "tmp_grimsmo_pen_variations_source_product_id_idx",
    ).on(table.sourceProductId),
  }),
);

export const tmpGrimsmoKnives = pgTable(
  "tmp_grimsmo_knives",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity({ startWith: 1000 }),
    productId: bigint("product_id", { mode: "number" })
      .notNull()
      .references(() => tmpProducts.id, { onDelete: "cascade" }),
    makerId: bigint("maker_id", { mode: "number" })
      .notNull()
      .references(() => maker.id, { onDelete: "restrict" }),
    knifeType: text("knife_type").notNull(),
    productHandle: text("product_handle").notNull(),
    title: text("title").notNull(),
    productUrl: text("product_url").notNull(),
    normalizedData: jsonb("normalized_data")
      .$type<GrimsmoProductNormalizedData>()
      .notNull(),
    detailsHash: text("details_hash").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    knifeTypeUnique: uniqueIndex("tmp_grimsmo_knives_knife_type_unique").on(
      table.knifeType,
    ),
    makerIdIdx: index("tmp_grimsmo_knives_maker_id_idx").on(table.makerId),
    productIdUnique: uniqueIndex("tmp_grimsmo_knives_product_id_unique").on(
      table.productId,
    ),
    productHandleUnique: uniqueIndex(
      "tmp_grimsmo_knives_product_handle_unique",
    ).on(table.productHandle),
  }),
);

export const tmpGrimsmoKnifeVariations = pgTable(
  "tmp_grimsmo_knife_variations",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity({ startWith: 1000 }),
    productVariationId: bigint("product_variation_id", { mode: "number" })
      .notNull()
      .references(() => tmpProductVariations.id, { onDelete: "cascade" }),
    knifeId: bigint("knife_id", { mode: "number" })
      .notNull()
      .references(() => tmpGrimsmoKnives.id, { onDelete: "cascade" }),
    knifeType: text("knife_type").notNull(),
    sourceProductId: text("source_product_id").notNull(),
    sourceHandle: text("source_handle").notNull(),
    sourceCollection: text("source_collection").notNull(),
    title: text("title").notNull(),
    titleFull: text("title_full").notNull(),
    productUrl: text("product_url").notNull(),
    description: text("description"),
    bodyText: text("body_text"),
    knifeNumber: text("knife_number"),
    bullets: jsonb("bullets")
      .$type<string[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    bulletsByCategory: jsonb("bullets_by_category")
      .$type<Record<string, string[]>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    handleFinishes: jsonb("handle_finishes")
      .$type<string[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    handleColors: jsonb("handle_colors")
      .$type<string[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    handleMaterials: jsonb("handle_materials")
      .$type<string[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    hardwareColors: jsonb("hardware_colors")
      .$type<string[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    patterns: jsonb("patterns")
      .$type<string[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    bladeSteels: jsonb("blade_steels")
      .$type<string[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    bladeFinishes: jsonb("blade_finishes")
      .$type<string[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    mechanisms: jsonb("mechanisms")
      .$type<string[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    case: text("case"),
    tags: jsonb("tags").$type<string[]>().default(sql`'[]'::jsonb`).notNull(),
    variants: jsonb("variants")
      .$type<unknown[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    normalizedData: jsonb("normalized_data")
      .$type<GrimsmoKnifeVariationNormalizedData>()
      .notNull(),
    detailsHash: text("details_hash").notNull(),
    imageSetHash: text("image_set_hash").notNull(),
    priceMinCents: integer("price_min_cents"),
    priceMaxCents: integer("price_max_cents"),
    currencyCode: text("currency_code").notNull().default("USD"),
    availableForSale: boolean("available_for_sale").notNull().default(false),
    archivedAt: timestamp("archived_at", { mode: "date", withTimezone: true }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    knifeHandleUnique: uniqueIndex(
      "tmp_grimsmo_knife_variations_knife_handle_unique",
    ).on(table.knifeId, table.sourceHandle),
    knifeIdIdx: index("tmp_grimsmo_knife_variations_knife_id_idx").on(
      table.knifeId,
    ),
    productVariationIdUnique: uniqueIndex(
      "tmp_grimsmo_knife_variations_product_variation_id_unique",
    ).on(table.productVariationId),
    sourceProductIdIdx: index(
      "tmp_grimsmo_knife_variations_source_product_id_idx",
    ).on(table.sourceProductId),
  }),
);

export const tmpProductProductTypes = pgTable(
  "tmp_product_product_types",
  {
    productId: bigint("product_id", { mode: "number" })
      .notNull()
      .references(() => tmpProducts.id, { onDelete: "cascade" }),
    productTypeId: bigint("product_type_id", { mode: "number" })
      .notNull()
      .references(() => productType.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    pk: primaryKey({
      columns: [table.productId, table.productTypeId],
      name: "tmp_product_product_types_pk",
    }),
    productTypeIdIdx: index("tmp_product_product_types_product_type_id_idx").on(
      table.productTypeId,
    ),
  }),
);

export const tmpAutmogPenVersions = pgTable(
  "tmp_autmog_pen_versions",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity({ startWith: 1000 }),
    penId: bigint("pen_id", { mode: "number" })
      .notNull()
      .references(() => tmpAutmogPens.id, { onDelete: "cascade" }),
    sourceProductId: text("source_product_id").notNull(),
    previousDetailsHash: text("previous_details_hash"),
    nextDetailsHash: text("next_details_hash").notNull(),
    previousImageSetHash: text("previous_image_set_hash"),
    nextImageSetHash: text("next_image_set_hash").notNull(),
    snapshot: jsonb("snapshot").$type<AutmogPenNormalizedData>().notNull(),
    changeReason: text("change_reason").notNull(),
    capturedAt: timestamp("captured_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    replacedAt: timestamp("replaced_at", { mode: "date", withTimezone: true }),
  },
  (table) => ({
    penIdIdx: index("tmp_autmog_pen_versions_pen_id_idx").on(table.penId),
    sourceProductIdIdx: index(
      "tmp_autmog_pen_versions_source_product_id_idx",
    ).on(table.sourceProductId),
  }),
);

export const tmpGrimsmoPenVersions = pgTable(
  "tmp_grimsmo_pen_versions",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity({ startWith: 1000 }),
    penId: bigint("pen_id", { mode: "number" })
      .notNull()
      .references(() => tmpGrimsmoPens.id, { onDelete: "cascade" }),
    productHandle: text("product_handle").notNull(),
    previousDetailsHash: text("previous_details_hash"),
    nextDetailsHash: text("next_details_hash").notNull(),
    snapshot: jsonb("snapshot").$type<GrimsmoProductNormalizedData>().notNull(),
    changeReason: text("change_reason").notNull(),
    capturedAt: timestamp("captured_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    replacedAt: timestamp("replaced_at", { mode: "date", withTimezone: true }),
  },
  (table) => ({
    penIdIdx: index("tmp_grimsmo_pen_versions_pen_id_idx").on(table.penId),
    productHandleIdx: index("tmp_grimsmo_pen_versions_product_handle_idx").on(
      table.productHandle,
    ),
  }),
);

export const tmpGrimsmoPenVariationVersions = pgTable(
  "tmp_grimsmo_pen_variation_versions",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity({ startWith: 1000 }),
    variationId: bigint("variation_id", { mode: "number" })
      .notNull()
      .references(() => tmpGrimsmoPenVariations.id, { onDelete: "cascade" }),
    sourceHandle: text("source_handle").notNull(),
    previousDetailsHash: text("previous_details_hash"),
    nextDetailsHash: text("next_details_hash").notNull(),
    previousImageSetHash: text("previous_image_set_hash"),
    nextImageSetHash: text("next_image_set_hash").notNull(),
    snapshot: jsonb("snapshot")
      .$type<GrimsmoPenVariationNormalizedData>()
      .notNull(),
    changeReason: text("change_reason").notNull(),
    capturedAt: timestamp("captured_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    replacedAt: timestamp("replaced_at", { mode: "date", withTimezone: true }),
  },
  (table) => ({
    sourceHandleIdx: index(
      "tmp_grimsmo_pen_variation_versions_source_handle_idx",
    ).on(table.sourceHandle),
    variationIdIdx: index(
      "tmp_grimsmo_pen_variation_versions_variation_id_idx",
    ).on(table.variationId),
  }),
);

export const tmpGrimsmoKnifeVersions = pgTable(
  "tmp_grimsmo_knife_versions",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity({ startWith: 1000 }),
    knifeId: bigint("knife_id", { mode: "number" })
      .notNull()
      .references(() => tmpGrimsmoKnives.id, { onDelete: "cascade" }),
    knifeType: text("knife_type").notNull(),
    previousDetailsHash: text("previous_details_hash"),
    nextDetailsHash: text("next_details_hash").notNull(),
    snapshot: jsonb("snapshot").$type<GrimsmoProductNormalizedData>().notNull(),
    changeReason: text("change_reason").notNull(),
    capturedAt: timestamp("captured_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    replacedAt: timestamp("replaced_at", { mode: "date", withTimezone: true }),
  },
  (table) => ({
    knifeIdIdx: index("tmp_grimsmo_knife_versions_knife_id_idx").on(
      table.knifeId,
    ),
    knifeTypeIdx: index("tmp_grimsmo_knife_versions_knife_type_idx").on(
      table.knifeType,
    ),
  }),
);

export const tmpGrimsmoKnifeVariationVersions = pgTable(
  "tmp_grimsmo_knife_variation_versions",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity({ startWith: 1000 }),
    variationId: bigint("variation_id", { mode: "number" })
      .notNull()
      .references(() => tmpGrimsmoKnifeVariations.id, { onDelete: "cascade" }),
    sourceHandle: text("source_handle").notNull(),
    previousDetailsHash: text("previous_details_hash"),
    nextDetailsHash: text("next_details_hash").notNull(),
    previousImageSetHash: text("previous_image_set_hash"),
    nextImageSetHash: text("next_image_set_hash").notNull(),
    snapshot: jsonb("snapshot")
      .$type<GrimsmoKnifeVariationNormalizedData>()
      .notNull(),
    changeReason: text("change_reason").notNull(),
    capturedAt: timestamp("captured_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    replacedAt: timestamp("replaced_at", { mode: "date", withTimezone: true }),
  },
  (table) => ({
    sourceHandleIdx: index(
      "tmp_grimsmo_knife_variation_versions_source_handle_idx",
    ).on(table.sourceHandle),
    variationIdIdx: index(
      "tmp_grimsmo_knife_variation_versions_variation_id_idx",
    ).on(table.variationId),
  }),
);

export type Maker = typeof maker.$inferSelect;
export type NewMaker = typeof maker.$inferInsert;
export type Material = typeof material.$inferSelect;
export type NewMaterial = typeof material.$inferInsert;
export type Mechanism = typeof mechanism.$inferSelect;
export type NewMechanism = typeof mechanism.$inferInsert;
export type ProductType = typeof productType.$inferSelect;
export type NewProductType = typeof productType.$inferInsert;
export type ScraperRun = typeof scraperRuns.$inferSelect;
export type NewScraperRun = typeof scraperRuns.$inferInsert;
export type TmpImage = typeof tmpImages.$inferSelect;
export type NewTmpImage = typeof tmpImages.$inferInsert;
export type TmpAutmogPen = typeof tmpAutmogPens.$inferSelect;
export type NewTmpAutmogPen = typeof tmpAutmogPens.$inferInsert;
export type TmpAutmogPenMaterial = typeof tmpAutmogPenMaterials.$inferSelect;
export type NewTmpAutmogPenMaterial = typeof tmpAutmogPenMaterials.$inferInsert;
export type TmpAutmogPenVersion = typeof tmpAutmogPenVersions.$inferSelect;
export type NewTmpAutmogPenVersion = typeof tmpAutmogPenVersions.$inferInsert;
export type TmpGrimsmoPen = typeof tmpGrimsmoPens.$inferSelect;
export type NewTmpGrimsmoPen = typeof tmpGrimsmoPens.$inferInsert;
export type TmpGrimsmoPenVariation =
  typeof tmpGrimsmoPenVariations.$inferSelect;
export type NewTmpGrimsmoPenVariation =
  typeof tmpGrimsmoPenVariations.$inferInsert;
export type TmpGrimsmoPenVersion = typeof tmpGrimsmoPenVersions.$inferSelect;
export type NewTmpGrimsmoPenVersion = typeof tmpGrimsmoPenVersions.$inferInsert;
export type TmpGrimsmoPenVariationVersion =
  typeof tmpGrimsmoPenVariationVersions.$inferSelect;
export type NewTmpGrimsmoPenVariationVersion =
  typeof tmpGrimsmoPenVariationVersions.$inferInsert;
export type TmpGrimsmoKnife = typeof tmpGrimsmoKnives.$inferSelect;
export type NewTmpGrimsmoKnife = typeof tmpGrimsmoKnives.$inferInsert;
export type TmpGrimsmoKnifeVariation =
  typeof tmpGrimsmoKnifeVariations.$inferSelect;
export type NewTmpGrimsmoKnifeVariation =
  typeof tmpGrimsmoKnifeVariations.$inferInsert;
export type TmpGrimsmoKnifeVersion =
  typeof tmpGrimsmoKnifeVersions.$inferSelect;
export type NewTmpGrimsmoKnifeVersion =
  typeof tmpGrimsmoKnifeVersions.$inferInsert;
export type TmpGrimsmoKnifeVariationVersion =
  typeof tmpGrimsmoKnifeVariationVersions.$inferSelect;
export type NewTmpGrimsmoKnifeVariationVersion =
  typeof tmpGrimsmoKnifeVariationVersions.$inferInsert;
export type TmpProduct = typeof tmpProducts.$inferSelect;
export type NewTmpProduct = typeof tmpProducts.$inferInsert;
export type TmpProductVariation = typeof tmpProductVariations.$inferSelect;
export type NewTmpProductVariation = typeof tmpProductVariations.$inferInsert;
export type TmpProductProductType = typeof tmpProductProductTypes.$inferSelect;
export type NewTmpProductProductType =
  typeof tmpProductProductTypes.$inferInsert;
