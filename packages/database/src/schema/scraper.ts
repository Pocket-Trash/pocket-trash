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

/** Normalized source image metadata for autmog pen. */
export type AutmogPenImageRecord = {
  /** Alternative text supplied for the source image. */
  altText: string | null;
  /** Source image height in pixels. */
  height: number | null;
  /** Stable source ordering position. */
  position: number;
  /** Hash used to detect changes to the source image. */
  sourceHash: string;
  /** Source-specific image identifier. */
  sourceImageId: string | null;
  /** Absolute source image URL. */
  sourceUrl: string;
  /** Source image width in pixels. */
  width: number | null;
};

/** Normalized autmog pen payload produced by its source adapter. */
export type AutmogPenNormalizedData = {
  /** Whether the source currently offers the item for sale. */
  availableForSale: boolean;
  /** Normalized construction details for the pen body. */
  bodyDetails: string[];
  /** Normalized pen-body shape. */
  bodyShape: string | null;
  /** Normalized source product category. */
  category: string | null;
  /** Normalized pen-clip description. */
  clip: string | null;
  /** Normalized overall finish description. */
  finish: string | null;
  /** Normalized pen-grip description. */
  grip: string | null;
  /** Hash of the normalized image set used for change detection. */
  imageSetHash: string;
  /** Normalized source images in display order. */
  images: AutmogPenImageRecord[];
  /** Normalized materials used by the product. */
  materials: string[];
  /** Normalized pen mechanism description. */
  mechanism: string | null;
  /** Normalized pen-nose description. */
  nose: string | null;
  /** Maximum source price in minor currency units. */
  priceMaxCents: number | null;
  /** Minimum source price in minor currency units. */
  priceMinCents: number | null;
  /** Canonical source product URL. */
  productUrl: string;
  /** Normalized compatible refill description. */
  refill: string | null;
  /** Normalized product size description. */
  size: string | null;
  /** Normalized source title. */
  title: string;
  /** Normalized source variant labels. */
  variants: unknown[];
};

/** Normalized grimsmo product payload produced by its source adapter. */
export type GrimsmoProductNormalizedData = {
  /** Stable source product handle. */
  productHandle: string;
  /** Canonical source product URL. */
  productUrl: string;
  /** Normalized source title. */
  title: string;
};

/** Normalized source image metadata for grimsmo variation. */
export type GrimsmoVariationImageRecord = {
  /** Alternative text supplied for the source image. */
  altText: string | null;
  /** Source image height in pixels. */
  height: number | null;
  /** Stable source ordering position. */
  position: number;
  /** Hash used to detect changes to the source image. */
  sourceHash: string;
  /** Source-specific image identifier. */
  sourceImageId: string | null;
  /** Absolute source image URL. */
  sourceUrl: string;
  /** Source image width in pixels. */
  width: number | null;
};

/** Normalized grimsmo pen variation payload produced by its source adapter. */
export type GrimsmoPenVariationNormalizedData = {
  /** Whether the source currently offers the item for sale. */
  availableForSale: boolean;
  /** Normalized colors applied to the pen body. */
  bodyColors: string[];
  /** Normalized finishes applied to the pen body. */
  bodyFinishes: string[];
  /** Normalized materials used for the pen body. */
  bodyMaterials: string[];
  /** Source production-book designation. */
  book: string | null;
  /** Normalized source bullet points in display order. */
  bullets: string[];
  /** Normalized source bullet points grouped by category. */
  bulletsByCategory: Record<string, string[]>;
  /** Normalized case or packaging description. */
  case: string | null;
  /** Normalized long-form source description. */
  description: string | null;
  /** Normalized engraving description. */
  engraving: string | null;
  /** Hash of the normalized image set used for change detection. */
  imageSetHash: string;
  /** Normalized source images in display order. */
  images: GrimsmoVariationImageRecord[];
  /** Maximum source price in minor currency units. */
  priceMaxCents: number | null;
  /** Minimum source price in minor currency units. */
  priceMinCents: number | null;
  /** Canonical source product URL. */
  productUrl: string;
  /** Normalized compatible refill description. */
  refill: string | null;
  /** Source-assigned Saga pen number. */
  sagaNumber: string | null;
  /** Normalized colors applied to the pen slider. */
  sliderColors: string[];
  /** Normalized materials used for the pen slider. */
  sliderMaterials: string[];
  /** Normalized pen-slider style. */
  sliderStyle: string | null;
  /** Normalized pen-tip logo description. */
  tipLogo: string | null;
  /** Normalized source title. */
  title: string;
  /** Unabridged source title. */
  titleFull: string;
  /** Normalized source variant labels. */
  variants: unknown[];
  /** Source bullet points selected for display. */
  visibleBullets: string[];
};

/** Normalized grimsmo knife variation payload produced by its source adapter. */
export type GrimsmoKnifeVariationNormalizedData = {
  /** Whether the source currently offers the item for sale. */
  availableForSale: boolean;
  /** Normalized finishes applied to the knife blade. */
  bladeFinishes: string[];
  /** Normalized steel materials used for the knife blade. */
  bladeSteels: string[];
  /** Source description of the knife body. */
  bodyText: string | null;
  /** Normalized source bullet points in display order. */
  bullets: string[];
  /** Normalized source bullet points grouped by category. */
  bulletsByCategory: Record<string, string[]>;
  /** Normalized case or packaging description. */
  case: string | null;
  /** Normalized long-form source description. */
  description: string | null;
  /** Normalized colors applied to the knife handle. */
  handleColors: string[];
  /** Normalized finishes applied to the knife handle. */
  handleFinishes: string[];
  /** Normalized materials used for the knife handle. */
  handleMaterials: string[];
  /** Normalized colors applied to knife hardware. */
  hardwareColors: string[];
  /** Hash of the normalized image set used for change detection. */
  imageSetHash: string;
  /** Normalized source images in display order. */
  images: GrimsmoVariationImageRecord[];
  /** Source-assigned knife serial or production number. */
  knifeNumber: string | null;
  /** Normalized knife model or type. */
  knifeType: string;
  /** Normalized mechanisms used by the knife. */
  mechanisms: string[];
  /** Normalized decorative patterns applied to the knife. */
  patterns: string[];
  /** Maximum source price in minor currency units. */
  priceMaxCents: number | null;
  /** Minimum source price in minor currency units. */
  priceMinCents: number | null;
  /** Canonical source product URL. */
  productUrl: string;
  /** Normalized source title. */
  title: string;
  /** Unabridged source title. */
  titleFull: string;
  /** Normalized source variant labels. */
  variants: unknown[];
};

/** Aggregate item, image, and dead-letter counts for one scraper run. */
export type ScraperRunStats = {
  /** Number of source records archived during the run. */
  archivedCount?: number;
  /** Failed image jobs found for dead-letter processing. */
  deadLetterFailedImageJobs?: number;
  /** Failed item jobs found for dead-letter processing. */
  deadLetterFailedItemJobs?: number;
  /** Image dead-letter jobs whose requeue attempt failed. */
  deadLetterRequeueFailedImageJobs?: number;
  /** Item dead-letter jobs whose requeue attempt failed. */
  deadLetterRequeueFailedItemJobs?: number;
  /** Image dead-letter jobs successfully requeued. */
  deadLetterRequeuedImageJobs?: number;
  /** Item dead-letter jobs successfully requeued. */
  deadLetterRequeuedItemJobs?: number;
  /** Image jobs enqueued during the run. */
  enqueuedImageJobs?: number;
  /** Item jobs enqueued during the run. */
  enqueuedItemJobs?: number;
  /** Image jobs that failed during the run. */
  failedImageJobs?: number;
  /** Item jobs that failed during the run. */
  failedItemJobs?: number;
  /** Source records fetched during the run. */
  fetchedCount?: number;
  /** Image jobs processed during the run. */
  processedImageJobs?: number;
  /** Item jobs processed during the run. */
  processedItemJobs?: number;
  /** Image jobs skipped because no work was needed. */
  skippedImageJobs?: number;
  /** Source records updated during the run. */
  updatedCount?: number;
};

/** Canonical product makers shared by scraped and user-created products. */
export const maker = pgTable(
  "makers",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity({ startWith: 1000 }),
    name: text("name").notNull(),
    /** Canonical root URL for this scraper source. */
    rootUrl: text("root_url"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    nameCaseInsensitiveUnique: uniqueIndex(
      "makers_name_case_insensitive_unique",
    ).on(sql`lower(${table.name})`),
    rootUrlUnique: uniqueIndex("makers_root_url_unique").on(table.rootUrl),
  }),
);

/** One scraper execution and its processing statistics. */
export const scraperRuns = pgTable(
  "scraper_runs",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity({ startWith: 1000 }),
    /** Scraper source or subsystem that ran. */
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
    activeSourceJobUnique: uniqueIndex("scraper_runs_active_source_job_unique")
      .on(table.source, table.jobType)
      .where(sql`${table.status} = 'running'`),
    startedAtIdx: index("scraper_runs_started_at_idx").on(table.startedAt),
  }),
);

/** Canonical materials shared by scraped and user-created products. */
export const material = pgTable(
  "materials",
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
    nameCaseInsensitiveUnique: uniqueIndex(
      "materials_name_case_insensitive_unique",
    ).on(sql`lower(${table.name})`),
    slugUnique: uniqueIndex("materials_slug_unique").on(table.slug),
  }),
);

/** Canonical pen mechanisms shared by scraped and user-created products. */
export const mechanism = pgTable(
  "mechanisms",
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

/** Canonical types used to classify catalog products. */
export const productType = pgTable(
  "product_types",
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

/** Staged normalized scraped products. */
export const tmpProducts = pgTable(
  "tmp_products",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity({ startWith: 1000 }),
    /** Scraper source key that created this aggregate row. */
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

/** Staged normalized variations for scraped products. */
export const tmpProductVariations = pgTable(
  "tmp_product_variations",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity({ startWith: 1000 }),
    /** Aggregate row and product-level image-folder key. */
    productId: bigint("product_id", { mode: "number" })
      .notNull()
      .references(() => tmpProducts.id, { onDelete: "cascade" }),
    /**
     * Stable variation key supplied by the scraper source.
     *
     * @example "saga-1234-5678"
     */
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

/** Staged source images for scraped products and variations. */
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
    /**
     * Stable source-identity hash used to deduplicate image rows.
     *
     * @example "sha256:db2ef0e97513c1dc9d75f55ee8c014c06fc31a459c1c25b12904696bf2ab1c55"
     */
    sourceHash: text("source_hash").notNull(),
    imageProvider: text("image_provider"),
    /** Provider identifier used to update or delete the uploaded image. */
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
    /** Last time this image appeared in the upstream source. */
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

/** Staged normalized Autmog pen records. */
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
    /** Editable Markdown initially converted from the source HTML. */
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
    /** Full normalized payload consumed by application features. */
    normalizedData: jsonb("normalized_data")
      .$type<AutmogPenNormalizedData>()
      .notNull(),
    /** Hash of normalized non-image product details. */
    detailsHash: text("details_hash").notNull(),
    /** Hash of normalized source-image identities. */
    imageSetHash: text("image_set_hash").notNull(),
    /** Minimum source variant price in cents. */
    priceMinCents: integer("price_min_cents"),
    /** Maximum source variant price in cents. */
    priceMaxCents: integer("price_max_cents"),
    currencyCode: text("currency_code").notNull().default("USD"),
    /** Whether any source variant is currently available. */
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

/** Staged Autmog pen material assignments. */
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

/** Staged normalized Grimsmo pen products. */
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

/** Staged normalized Grimsmo pen variations. */
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

/** Staged normalized Grimsmo knife products. */
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

/** Staged normalized Grimsmo knife variations. */
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

/** Staged product-type assignments for scraped products. */
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

/** Versioned snapshots of staged Autmog pens. */
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

/** Versioned snapshots of staged Grimsmo pens. */
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

/** Versioned snapshots of staged Grimsmo pen variations. */
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

/** Versioned snapshots of staged Grimsmo knives. */
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

/** Versioned snapshots of staged Grimsmo knife variations. */
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

/** Stored maker row. */
export type Maker = typeof maker.$inferSelect;
/** Values accepted when creating a maker row. */
export type NewMaker = typeof maker.$inferInsert;
/** Stored material row. */
export type Material = typeof material.$inferSelect;
/** Values accepted when creating a material row. */
export type NewMaterial = typeof material.$inferInsert;
/** Stored mechanism row. */
export type Mechanism = typeof mechanism.$inferSelect;
/** Values accepted when creating a mechanism row. */
export type NewMechanism = typeof mechanism.$inferInsert;
/** Stored product type row. */
export type ProductType = typeof productType.$inferSelect;
/** Values accepted when creating a product type row. */
export type NewProductType = typeof productType.$inferInsert;
/** Stored scraper run row. */
export type ScraperRun = typeof scraperRuns.$inferSelect;
/** Values accepted when creating a scraper run row. */
export type NewScraperRun = typeof scraperRuns.$inferInsert;
/** Stored tmp image row. */
export type TmpImage = typeof tmpImages.$inferSelect;
/** Values accepted when creating a tmp image row. */
export type NewTmpImage = typeof tmpImages.$inferInsert;
/** Stored tmp autmog pen row. */
export type TmpAutmogPen = typeof tmpAutmogPens.$inferSelect;
/** Values accepted when creating a tmp autmog pen row. */
export type NewTmpAutmogPen = typeof tmpAutmogPens.$inferInsert;
/** Stored tmp autmog pen material row. */
export type TmpAutmogPenMaterial = typeof tmpAutmogPenMaterials.$inferSelect;
/** Values accepted when creating a tmp autmog pen material row. */
export type NewTmpAutmogPenMaterial = typeof tmpAutmogPenMaterials.$inferInsert;
/** Stored tmp autmog pen version row. */
export type TmpAutmogPenVersion = typeof tmpAutmogPenVersions.$inferSelect;
/** Values accepted when creating a tmp autmog pen version row. */
export type NewTmpAutmogPenVersion = typeof tmpAutmogPenVersions.$inferInsert;
/** Stored tmp grimsmo pen row. */
export type TmpGrimsmoPen = typeof tmpGrimsmoPens.$inferSelect;
/** Values accepted when creating a tmp grimsmo pen row. */
export type NewTmpGrimsmoPen = typeof tmpGrimsmoPens.$inferInsert;
/** Stored tmp grimsmo pen variation row. */
export type TmpGrimsmoPenVariation =
  typeof tmpGrimsmoPenVariations.$inferSelect;
/** Values accepted when creating a tmp grimsmo pen variation row. */
export type NewTmpGrimsmoPenVariation =
  typeof tmpGrimsmoPenVariations.$inferInsert;
/** Stored tmp grimsmo pen version row. */
export type TmpGrimsmoPenVersion = typeof tmpGrimsmoPenVersions.$inferSelect;
/** Values accepted when creating a tmp grimsmo pen version row. */
export type NewTmpGrimsmoPenVersion = typeof tmpGrimsmoPenVersions.$inferInsert;
/** Stored tmp grimsmo pen variation version row. */
export type TmpGrimsmoPenVariationVersion =
  typeof tmpGrimsmoPenVariationVersions.$inferSelect;
/** Values accepted when creating a tmp grimsmo pen variation version row. */
export type NewTmpGrimsmoPenVariationVersion =
  typeof tmpGrimsmoPenVariationVersions.$inferInsert;
/** Stored tmp grimsmo knife row. */
export type TmpGrimsmoKnife = typeof tmpGrimsmoKnives.$inferSelect;
/** Values accepted when creating a tmp grimsmo knife row. */
export type NewTmpGrimsmoKnife = typeof tmpGrimsmoKnives.$inferInsert;
/** Stored tmp grimsmo knife variation row. */
export type TmpGrimsmoKnifeVariation =
  typeof tmpGrimsmoKnifeVariations.$inferSelect;
/** Values accepted when creating a tmp grimsmo knife variation row. */
export type NewTmpGrimsmoKnifeVariation =
  typeof tmpGrimsmoKnifeVariations.$inferInsert;
/** Stored tmp grimsmo knife version row. */
export type TmpGrimsmoKnifeVersion =
  typeof tmpGrimsmoKnifeVersions.$inferSelect;
/** Values accepted when creating a tmp grimsmo knife version row. */
export type NewTmpGrimsmoKnifeVersion =
  typeof tmpGrimsmoKnifeVersions.$inferInsert;
/** Stored tmp grimsmo knife variation version row. */
export type TmpGrimsmoKnifeVariationVersion =
  typeof tmpGrimsmoKnifeVariationVersions.$inferSelect;
/** Values accepted when creating a tmp grimsmo knife variation version row. */
export type NewTmpGrimsmoKnifeVariationVersion =
  typeof tmpGrimsmoKnifeVariationVersions.$inferInsert;
/** Stored tmp product row. */
export type TmpProduct = typeof tmpProducts.$inferSelect;
/** Values accepted when creating a tmp product row. */
export type NewTmpProduct = typeof tmpProducts.$inferInsert;
/** Stored tmp product variation row. */
export type TmpProductVariation = typeof tmpProductVariations.$inferSelect;
/** Values accepted when creating a tmp product variation row. */
export type NewTmpProductVariation = typeof tmpProductVariations.$inferInsert;
/** Stored tmp product product type row. */
export type TmpProductProductType = typeof tmpProductProductTypes.$inferSelect;
/** Values accepted when creating a tmp product product type row. */
export type NewTmpProductProductType =
  typeof tmpProductProductTypes.$inferInsert;
