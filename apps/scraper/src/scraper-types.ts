import type {
  AutmogPenNormalizedData,
  GrimsmoVariationImageRecord,
} from "@package/database";

/**
 * Stable source identifiers used by commands, queues, and persisted runs.
 */
export const scraperSources = {
  autmog: "autmog",
  grimsmoFjell: "grimsmo-fjell",
  grimsmoNorseman: "grimsmo-norseman",
  grimsmoRask: "grimsmo-rask",
  grimsmoSaga: "grimsmo-saga",
} as const;

/**
 * Any configured scraper source identifier.
 */
export type ScraperSourceName =
  (typeof scraperSources)[keyof typeof scraperSources];
/**
 * Grimsmo pen-feed source identifier.
 */
export type GrimsmoPenSourceName = typeof scraperSources.grimsmoSaga;
/**
 * Grimsmo knife-feed source identifier.
 */
export type GrimsmoKnifeSourceName =
  | typeof scraperSources.grimsmoFjell
  | typeof scraperSources.grimsmoNorseman
  | typeof scraperSources.grimsmoRask;
/**
 * Any configured Grimsmo feed identifier.
 */
export type GrimsmoSourceName = GrimsmoKnifeSourceName | GrimsmoPenSourceName;

/**
 * Stable BullMQ queue names for item normalization and image storage.
 */
export const scraperQueueNames = {
  images: "scraper-images",
  items: "scraper-items",
} as const;

/**
 * Discriminated payload processed by the scraper item queue.
 */
export type ScraperItemJob =
  | {
      /**
       * Normalized Autmog pen to persist.
       */
      item: NormalizedAutmogPen;
      /**
       * Autmog source discriminator.
       */
      source: typeof scraperSources.autmog;
      /**
       * Autmog pen job discriminator.
       */
      type: "autmog.pen";
    }
  | {
      /**
       * Source product IDs observed in the completed Autmog scrape.
       */
      seenSourceProductIds: string[];
      /**
       * Autmog source discriminator.
       */
      source: typeof scraperSources.autmog;
      /**
       * Missing-product archive job discriminator.
       */
      type: "autmog.archiveMissing";
    }
  | {
      /**
       * Normalized Grimsmo pen variation to persist.
       */
      item: NormalizedGrimsmoPenVariation;
      /**
       * Grimsmo Saga source discriminator.
       */
      source: typeof scraperSources.grimsmoSaga;
      /**
       * Single pen-variation job discriminator.
       */
      type: "grimsmo.penVariation";
    }
  | {
      /**
       * Normalized knife variations to persist as one batch.
       */
      items: NormalizedGrimsmoKnifeVariation[];
      /**
       * Grimsmo knife source that produced the batch.
       */
      source:
        | typeof scraperSources.grimsmoFjell
        | typeof scraperSources.grimsmoNorseman
        | typeof scraperSources.grimsmoRask;
      /**
       * Knife-variation batch job discriminator.
       */
      type: "grimsmo.knifeVariationBatch";
    }
  | {
      /**
       * Normalized Saga pen variations to persist as one batch.
       */
      items: NormalizedGrimsmoPenVariation[];
      /**
       * Grimsmo Saga source discriminator.
       */
      source: typeof scraperSources.grimsmoSaga;
      /**
       * Pen-variation batch job discriminator.
       */
      type: "grimsmo.penVariationBatch";
    }
  | {
      /**
       * Normalized Grimsmo knife variation to persist.
       */
      item: NormalizedGrimsmoKnifeVariation;
      /**
       * Grimsmo knife source that produced the item.
       */
      source:
        | typeof scraperSources.grimsmoFjell
        | typeof scraperSources.grimsmoNorseman
        | typeof scraperSources.grimsmoRask;
      /**
       * Single knife-variation job discriminator.
       */
      type: "grimsmo.knifeVariation";
    };

/**
 * Discriminated payload processed by the scraper image queue.
 */
export type ScraperImageJob =
  | {
      /**
       * Database identifier of the staged image to upload.
       */
      imageId: number;
      /**
       * Scraper source that owns the image.
       */
      source: ScraperSourceName;
      /**
       * Expected source hash used to reject stale upload jobs.
       */
      sourceHash: string;
      /**
       * Staged-image upload job discriminator.
       */
      type: "tmp.image.upload";
    }
  | {
      /**
       * Database identifier of the staged image to delete.
       */
      imageId: number;
      /**
       * Scraper source that owns the image.
       */
      source: ScraperSourceName;
      /**
       * Staged-image deletion job discriminator.
       */
      type: "tmp.image.delete";
    };

/**
 * Complete normalized Autmog pen ready for persistence and image queuing.
 */
export type NormalizedAutmogPen = {
  /**
   * Whether the source currently offers the item for sale.
   */
  availableForSale: boolean;
  /**
   * Normalized construction details for the pen body.
   */
  bodyDetails: string[];
  /**
   * Normalized pen-clip description, or `null` when absent.
   */
  clip: string | null;
  /**
   * ISO currency code for normalized prices.
   */
  currencyCode: string;
  /**
   * Normalized plain-text source description, or `null` when absent.
   */
  description: string | null;
  /**
   * SHA-256 hash of normalized non-image details used for change detection.
   */
  detailsHash: string;
  /**
   * Normalized overall finish description, or `null` when absent.
   */
  finish: string | null;
  /**
   * Normalized pen-grip description, or `null` when absent.
   */
  grip: string | null;
  /**
   * SHA-256 hash of normalized image metadata used for change detection.
   */
  imageSetHash: string;
  /**
   * Normalized source images in display order.
   */
  images: NormalizedAutmogPenImage[];
  /**
   * Normalized material names detected in source text.
   */
  materials: string[];
  /**
   * Normalized mechanism description, or `null` when absent.
   */
  mechanism: string | null;
  /**
   * Versionable normalized payload persisted with the staged pen.
   */
  normalizedData: AutmogPenNormalizedData;
  /**
   * Normalized pen-nose description, or `null` when absent.
   */
  nose: string | null;
  /**
   * Maximum source price in minor currency units, or `null` without prices.
   */
  priceMaxCents: number | null;
  /**
   * Minimum source price in minor currency units, or `null` without prices.
   */
  priceMinCents: number | null;
  /**
   * Canonical product-type names inferred from source metadata.
   */
  productTypes: string[];
  /**
   * Canonical source product URL.
   */
  productUrl: string;
  /**
   * Normalized compatible refill description, or `null` when absent.
   */
  refill: string | null;
  /**
   * Normalized product size description, or `null` when absent.
   */
  size: string | null;
  /**
   * Stable Shopify product handle.
   */
  sourceHandle: string;
  /**
   * Stable source product identifier.
   */
  sourceProductId: string;
  /**
   * Normalized source product tags.
   */
  tags: string[];
  /**
   * Normalized source title.
   */
  title: string;
  /**
   * Normalized source variant records.
   */
  variants: unknown[];
};

/**
 * Normalized Autmog image metadata in source display order.
 */
export type NormalizedAutmogPenImage = {
  /**
   * Alternative text supplied for the source image, or `null`.
   */
  altText: string | null;
  /**
   * Source image height in pixels, or `null` when unknown.
   */
  height: number | null;
  /**
   * Source-provided display position, defaulting to a one-based array position.
   */
  position: number;
  /**
   * Hash used to detect changes to source image metadata.
   */
  sourceHash: string;
  /**
   * Source-specific image identifier, or `null` when absent.
   */
  sourceImageId: string | null;
  /**
   * Absolute source image URL.
   */
  sourceUrl: string;
  /**
   * Source image width in pixels, or `null` when unknown.
   */
  width: number | null;
};

/**
 * Shared normalized product metadata for a Grimsmo variation.
 */
export type NormalizedGrimsmoProduct = {
  /**
   * SHA-256 hash of normalized non-image details used for change detection.
   */
  detailsHash: string;
  /**
   * Stable Shopify handle for the parent product.
   */
  productHandle: string;
  /**
   * Canonical source product URL.
   */
  productUrl: string;
  /**
   * Normalized source title.
   */
  title: string;
};

/**
 * Complete normalized Grimsmo pen variation ready for persistence.
 */
export type NormalizedGrimsmoPenVariation = {
  /**
   * Whether the source currently offers the item for sale.
   */
  availableForSale: boolean;
  /**
   * Normalized colors applied to the pen body.
   */
  bodyColors: string[];
  /**
   * Normalized finishes applied to the pen body.
   */
  bodyFinishes: string[];
  /**
   * Normalized materials used for the pen body.
   */
  bodyMaterials: string[];
  /**
   * Plain text extracted from the source product body, or `null`.
   */
  bodyText: string | null;
  /**
   * Source production-book designation, or `null` when absent.
   */
  book: string | null;
  /**
   * Normalized source bullet points in display order.
   */
  bullets: string[];
  /**
   * Normalized source bullet points grouped by heading category.
   */
  bulletsByCategory: Record<string, string[]>;
  /**
   * Normalized case or packaging description, or `null` when absent.
   */
  case: string | null;
  /**
   * ISO currency code for normalized prices.
   */
  currencyCode: string;
  /**
   * Normalized plain-text source description, or `null` when absent.
   */
  description: string | null;
  /**
   * SHA-256 hash of normalized non-image details used for change detection.
   */
  detailsHash: string;
  /**
   * Normalized engraving description, or `null` when absent.
   */
  engraving: string | null;
  /**
   * SHA-256 hash of normalized image metadata used for change detection.
   */
  imageSetHash: string;
  /**
   * Normalized source images in display order.
   */
  images: GrimsmoVariationImageRecord[];
  /**
   * Maximum source price in minor currency units, or `null` without prices.
   */
  priceMaxCents: number | null;
  /**
   * Minimum source price in minor currency units, or `null` without prices.
   */
  priceMinCents: number | null;
  /**
   * Normalized metadata for the parent Grimsmo product.
   */
  product: NormalizedGrimsmoProduct;
  /**
   * Canonical source product URL.
   */
  productUrl: string;
  /**
   * Normalized compatible refill description, or `null` when absent.
   */
  refill: string | null;
  /**
   * Source-assigned Saga pen number, or `null` when absent.
   */
  sagaNumber: string | null;
  /**
   * Normalized colors applied to the pen slider.
   */
  sliderColors: string[];
  /**
   * Normalized materials used for the pen slider.
   */
  sliderMaterials: string[];
  /**
   * Normalized pen-slider style, or `null` when absent.
   */
  sliderStyle: string | null;
  /**
   * Whether the item came from current inventory or the archive.
   */
  sourceCollection: GrimsmoCollectionKind;
  /**
   * Stable Shopify product handle.
   */
  sourceHandle: string;
  /**
   * Stable source product identifier.
   */
  sourceProductId: string;
  /**
   * Normalized source product tags.
   */
  tags: string[];
  /**
   * Normalized pen-tip logo description, or `null` when absent.
   */
  tipLogo: string | null;
  /**
   * Normalized source title.
   */
  title: string;
  /**
   * Unabridged source product title.
   */
  titleFull: string;
  /**
   * Normalized source variant records.
   */
  variants: unknown[];
  /**
   * Source bullet points selected for display.
   */
  visibleBullets: string[];
};

/**
 * Supported Grimsmo knife model identifier.
 */
export type GrimsmoKnifeType = "fjell" | "norseman" | "rask";

/**
 * Complete normalized Grimsmo knife variation ready for persistence.
 */
export type NormalizedGrimsmoKnifeVariation = {
  /**
   * Whether the source currently offers the item for sale.
   */
  availableForSale: boolean;
  /**
   * Normalized finishes applied to the knife blade.
   */
  bladeFinishes: string[];
  /**
   * Normalized steel materials used for the knife blade.
   */
  bladeSteels: string[];
  /**
   * Plain text extracted from the source product body, or `null`.
   */
  bodyText: string | null;
  /**
   * Normalized source bullet points in display order.
   */
  bullets: string[];
  /**
   * Normalized source bullet points grouped by heading category.
   */
  bulletsByCategory: Record<string, string[]>;
  /**
   * Normalized case or packaging description, or `null` when absent.
   */
  case: string | null;
  /**
   * ISO currency code for normalized prices.
   */
  currencyCode: string;
  /**
   * Normalized plain-text source description, or `null` when absent.
   */
  description: string | null;
  /**
   * SHA-256 hash of normalized non-image details used for change detection.
   */
  detailsHash: string;
  /**
   * Normalized colors applied to the knife handle.
   */
  handleColors: string[];
  /**
   * Normalized finishes applied to the knife handle.
   */
  handleFinishes: string[];
  /**
   * Normalized materials used for the knife handle.
   */
  handleMaterials: string[];
  /**
   * Normalized colors applied to knife hardware.
   */
  hardwareColors: string[];
  /**
   * SHA-256 hash of normalized image metadata used for change detection.
   */
  imageSetHash: string;
  /**
   * Normalized source images in display order.
   */
  images: GrimsmoVariationImageRecord[];
  /**
   * Source-assigned knife serial or production number, or `null`.
   */
  knifeNumber: string | null;
  /**
   * Normalized Grimsmo knife model.
   */
  knifeType: GrimsmoKnifeType;
  /**
   * Normalized mechanisms used by the knife.
   */
  mechanisms: string[];
  /**
   * Normalized decorative patterns applied to the knife.
   */
  patterns: string[];
  /**
   * Maximum source price in minor currency units, or `null` without prices.
   */
  priceMaxCents: number | null;
  /**
   * Minimum source price in minor currency units, or `null` without prices.
   */
  priceMinCents: number | null;
  /**
   * Normalized metadata for the parent Grimsmo product.
   */
  product: NormalizedGrimsmoProduct;
  /**
   * Canonical source product URL.
   */
  productUrl: string;
  /**
   * Whether the item came from current inventory or the archive.
   */
  sourceCollection: GrimsmoCollectionKind;
  /**
   * Stable Shopify product handle.
   */
  sourceHandle: string;
  /**
   * Stable source product identifier.
   */
  sourceProductId: string;
  /**
   * Normalized source product tags.
   */
  tags: string[];
  /**
   * Normalized source title.
   */
  title: string;
  /**
   * Unabridged source product title.
   */
  titleFull: string;
  /**
   * Normalized source variant records.
   */
  variants: unknown[];
};

/**
 * Grimsmo collection section from which a product was fetched.
 */
export type GrimsmoCollectionKind = "archive" | "inventory";
