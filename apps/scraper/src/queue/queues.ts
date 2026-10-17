import {
  createBullMqQueueAdapter,
  type DefinedQueue,
  type QueueAdapter,
  type QueueCounts,
  type QueueEnqueueInput,
} from "@package/queue";
import { z } from "zod";
import {
  type ScraperImageJob,
  type ScraperItemJob,
  scraperQueueNames,
  scraperSources,
} from "../scraper-types.js";

/** Retry and retention policy shared by scraper queues. */
const scraperQueuePolicy = {
  deduplication: { replaceCompleted: true },
  retention: {
    completed: { ageSeconds: 60 * 60 * 24, count: 1_000 },
    failed: { ageSeconds: 60 * 60 * 24 * 7 },
  },
  retry: {
    attempts: 5,
    backoff: { delayMs: 30_000, type: "exponential" as const },
  },
};

/** Runtime shape shared by normalized source images. */
const normalizedImageSchema = z.object({
  altText: z.string().nullable(),
  height: z.number().int().nullable(),
  position: z.number().int(),
  sourceHash: z.string(),
  sourceImageId: z.string().nullable(),
  sourceUrl: z.string(),
  width: z.number().int().nullable(),
});

/** Runtime shape of normalized parent Grimsmo product metadata. */
const normalizedGrimsmoProductSchema = z.object({
  detailsHash: z.string(),
  productHandle: z.string(),
  productUrl: z.string(),
  title: z.string(),
});

/** Runtime shape of a complete normalized Autmog pen. */
const normalizedAutmogPenSchema = z.object({
  availableForSale: z.boolean(),
  bodyDetails: z.array(z.string()),
  clip: z.string().nullable(),
  currencyCode: z.string(),
  description: z.string().nullable(),
  detailsHash: z.string(),
  finish: z.string().nullable(),
  grip: z.string().nullable(),
  imageSetHash: z.string(),
  images: z.array(normalizedImageSchema),
  materials: z.array(z.string()),
  mechanism: z.string().nullable(),
  normalizedData: z.object({
    availableForSale: z.boolean(),
    bodyDetails: z.array(z.string()),
    bodyShape: z.string().nullable(),
    category: z.string().nullable(),
    clip: z.string().nullable(),
    finish: z.string().nullable(),
    grip: z.string().nullable(),
    imageSetHash: z.string(),
    images: z.array(normalizedImageSchema),
    materials: z.array(z.string()),
    mechanism: z.string().nullable(),
    nose: z.string().nullable(),
    priceMaxCents: z.number().int().nullable(),
    priceMinCents: z.number().int().nullable(),
    productUrl: z.string(),
    refill: z.string().nullable(),
    size: z.string().nullable(),
    title: z.string(),
    variants: z.array(z.json()),
  }),
  nose: z.string().nullable(),
  priceMaxCents: z.number().int().nullable(),
  priceMinCents: z.number().int().nullable(),
  productTypes: z.array(z.string()),
  productUrl: z.string(),
  refill: z.string().nullable(),
  size: z.string().nullable(),
  sourceHandle: z.string(),
  sourceProductId: z.string(),
  tags: z.array(z.string()),
  title: z.string(),
  variants: z.array(z.json()),
});

/** Runtime shape shared by complete normalized Grimsmo variations. */
const normalizedGrimsmoVariationShape = {
  availableForSale: z.boolean(),
  bodyText: z.string().nullable(),
  bullets: z.array(z.string()),
  bulletsByCategory: z.record(z.string(), z.array(z.string())),
  case: z.string().nullable(),
  currencyCode: z.string(),
  description: z.string().nullable(),
  detailsHash: z.string(),
  imageSetHash: z.string(),
  images: z.array(normalizedImageSchema),
  priceMaxCents: z.number().int().nullable(),
  priceMinCents: z.number().int().nullable(),
  product: normalizedGrimsmoProductSchema,
  productUrl: z.string(),
  sourceCollection: z.enum(["archive", "inventory"]),
  sourceHandle: z.string(),
  sourceProductId: z.string(),
  tags: z.array(z.string()),
  title: z.string(),
  titleFull: z.string(),
  variants: z.array(z.json()),
};

/** Runtime shape of a complete normalized Grimsmo pen variation. */
const normalizedGrimsmoPenSchema = z.object({
  ...normalizedGrimsmoVariationShape,
  bodyColors: z.array(z.string()),
  bodyFinishes: z.array(z.string()),
  bodyMaterials: z.array(z.string()),
  book: z.string().nullable(),
  engraving: z.string().nullable(),
  refill: z.string().nullable(),
  sagaNumber: z.string().nullable(),
  sliderColors: z.array(z.string()),
  sliderMaterials: z.array(z.string()),
  sliderStyle: z.string().nullable(),
  tipLogo: z.string().nullable(),
  visibleBullets: z.array(z.string()),
});

/** Runtime shape of a complete normalized Grimsmo knife variation. */
const normalizedGrimsmoKnifeSchema = z.object({
  ...normalizedGrimsmoVariationShape,
  bladeFinishes: z.array(z.string()),
  bladeSteels: z.array(z.string()),
  handleColors: z.array(z.string()),
  handleFinishes: z.array(z.string()),
  handleMaterials: z.array(z.string()),
  hardwareColors: z.array(z.string()),
  knifeNumber: z.string().nullable(),
  knifeType: z.enum(["fjell", "norseman", "rask"]),
  mechanisms: z.array(z.string()),
  patterns: z.array(z.string()),
});

/** Runtime shape of the bounded Saga catalog snapshot. */
const sagaCatalogSnapshotSchema = z.object({
  appearances: z.array(
    z.object({
      colorNames: z.array(z.string()),
      finishNames: z.array(z.string()),
      sliderOption: z.string().nullable(),
    }),
  ),
  colorNames: z.array(z.string()),
  finishNames: z.array(z.string()),
  images: z.array(
    z.object({
      listingUrl: z.string(),
      sourceHandle: z.string(),
      sourceImageId: z.string(),
      sourceProductId: z.string(),
      sourceUrl: z.string(),
    }),
  ),
  materialNames: z.array(z.string()),
  sliderOptions: z.array(z.string()),
});

/** Runtime validator for each scraper item payload variant. */
const scraperItemPayloadSchema = z.discriminatedUnion("type", [
  z.object({
    item: normalizedAutmogPenSchema,
    source: z.literal(scraperSources.autmog),
    type: z.literal("autmog.pen"),
  }),
  z.object({
    snapshot: sagaCatalogSnapshotSchema,
    source: z.literal(scraperSources.grimsmoSaga),
    type: z.literal("grimsmo.sagaCatalog"),
  }),
  z.object({
    materialNames: z.array(z.string()),
    source: z.literal(scraperSources.grimsmoSaga),
    type: z.literal("grimsmo.sagaMaterials"),
  }),
  z.object({
    item: normalizedGrimsmoPenSchema,
    source: z.literal(scraperSources.grimsmoSaga),
    type: z.literal("grimsmo.penVariation"),
  }),
  z.object({
    items: z.array(normalizedGrimsmoPenSchema),
    source: z.literal(scraperSources.grimsmoSaga),
    type: z.literal("grimsmo.penVariationBatch"),
  }),
  z.object({
    item: normalizedGrimsmoKnifeSchema,
    source: z.enum([
      scraperSources.grimsmoFjell,
      scraperSources.grimsmoNorseman,
      scraperSources.grimsmoRask,
    ]),
    type: z.literal("grimsmo.knifeVariation"),
  }),
  z.object({
    items: z.array(normalizedGrimsmoKnifeSchema),
    source: z.enum([
      scraperSources.grimsmoFjell,
      scraperSources.grimsmoNorseman,
      scraperSources.grimsmoRask,
    ]),
    type: z.literal("grimsmo.knifeVariationBatch"),
  }),
]);

/** Runtime validator for scraper item payloads persisted in Redis. */
const scraperItemJobSchema = z.custom<ScraperItemJob>(
  (value) => scraperItemPayloadSchema.safeParse(value).success,
  { error: "Invalid scraper item queue payload." },
);

/** Runtime validator for each scraper image payload variant. */
const scraperImagePayloadSchema = z.discriminatedUnion("type", [
  z.object({
    listingId: z.number().int(),
    position: z.number().int(),
    productId: z.number().int(),
    source: z.literal(scraperSources.autmog),
    sourceImageId: z.string(),
    sourceUrl: z.string(),
    type: z.literal("autmog.image.upload"),
  }),
  z.object({
    listingId: z.number().int(),
    position: z.number().int(),
    productId: z.number().int(),
    source: z.literal(scraperSources.grimsmoSaga),
    sourceImageId: z.string(),
    sourceUrl: z.string(),
    type: z.literal("grimsmo.sagaImage.upload"),
  }),
  z.object({
    imageId: z.number().int(),
    source: z.enum(Object.values(scraperSources)),
    sourceHash: z.string(),
    type: z.literal("tmp.image.upload"),
  }),
  z.object({
    imageId: z.number().int(),
    source: z.enum(Object.values(scraperSources)),
    type: z.literal("tmp.image.delete"),
  }),
]);

/** Runtime validator for scraper image payloads persisted in Redis. */
const scraperImageJobSchema = z.custom<ScraperImageJob>(
  (value) => scraperImagePayloadSchema.safeParse(value).success,
  { error: "Invalid scraper image queue payload." },
);

/** Item and image queues plus their shared close operation. */
export type ScraperQueues = {
  /**
   * Closes both queues and their adapter connections.
   *
   * @returns Queue cleanup completion.
   */
  close: () => Promise<void>;
  /** Queue containing scraper image upload and deletion jobs. */
  images: DefinedQueue<ScraperImageJob>;
  /** Queue containing normalized item and reconciliation jobs. */
  items: DefinedQueue<ScraperItemJob>;
};

/** Actionable counts for one scraper queue. */
export type ScraperQueueJobCounts = Pick<
  QueueCounts,
  "active" | "delayed" | "waiting"
>;

/**
 * Creates scraper queues over an owned production adapter.
 *
 * @param redisUrl - Redis URL used by the default production adapter.
 * @param adapter - Optional transport adapter supplied by tests.
 * @returns Configured item and image queues.
 */
export function createScraperQueues(
  redisUrl: string,
  adapter: QueueAdapter = createBullMqQueueAdapter({ redisUrl }),
): ScraperQueues {
  const items = adapter.define({
    ...scraperQueuePolicy,
    mode: "bounded",
    name: scraperQueueNames.items,
    schema: scraperItemJobSchema,
  });
  const images = adapter.define({
    ...scraperQueuePolicy,
    mode: "bounded",
    name: scraperQueueNames.images,
    schema: scraperImageJobSchema,
  });

  return {
    /**
     * Closes queue and connection resources.
     *
     * @returns Queue cleanup completion.
     */
    close: () => adapter.close(),
    images,
    items,
  };
}

/**
 * Enqueues a batch and returns the number of replaced completed jobs.
 *
 * @param queue - Typed scraper queue receiving jobs.
 * @param jobs - Jobs with deterministic identifiers.
 * @returns Number of retained completed jobs replaced by the batch.
 * @template TPayload - Scraper queue payload type.
 */
export async function enqueueScraperJobs<TPayload>(
  queue: DefinedQueue<TPayload>,
  jobs: readonly QueueEnqueueInput<TPayload>[],
) {
  const results = await queue.enqueueMany(jobs);
  return results.filter((result) => result.replacedCompleted).length;
}

/**
 * Loads actionable job counts for both scraper queues.
 *
 * @param queues - Scraper queues to inspect.
 * @returns Actionable counts keyed by queue purpose.
 */
export async function getScraperQueueJobCounts(queues: ScraperQueues) {
  const [items, images] = await Promise.all([
    queues.items.counts(),
    queues.images.counts(),
  ]);
  return {
    images: actionableCounts(images),
    items: actionableCounts(items),
  };
}

/**
 * Checks whether either scraper queue has actionable work.
 *
 * @param counts - Actionable counts for both scraper queues.
 * @returns Whether any queue contains active, delayed, or waiting work.
 */
export function hasActionableQueueJobs(counts: {
  /** Actionable image-queue job counts. */
  images: ScraperQueueJobCounts;
  /** Actionable item-queue job counts. */
  items: ScraperQueueJobCounts;
}) {
  return (
    counts.images.active +
      counts.images.delayed +
      counts.images.waiting +
      counts.items.active +
      counts.items.delayed +
      counts.items.waiting >
    0
  );
}

/**
 * Selects counts used to decide whether a scraper drain is needed.
 *
 * @param counts - Complete portable queue counts.
 * @returns Counts relevant to scraper processing.
 */
function actionableCounts(counts: QueueCounts): ScraperQueueJobCounts {
  return {
    active: counts.active,
    delayed: counts.delayed,
    waiting: counts.waiting,
  };
}

/**
 * Checks the common envelope and job-specific data of one item payload.
 *
 * @param value - Unknown persisted payload.
 * @returns Whether the payload is a supported scraper item job.
 */
