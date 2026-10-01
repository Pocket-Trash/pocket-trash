import { hashObject } from "../lib/hash.js";
import type {
  GrimsmoKnifeSourceName,
  GrimsmoPenSourceName,
  GrimsmoSourceName,
  NormalizedAutmogPen,
  NormalizedGrimsmoKnifeVariation,
  NormalizedGrimsmoPenVariation,
  ScraperSourceName,
} from "../scraper-types.js";

/**
 * Builds the deterministic item job ID for an Autmog pen state.
 *
 * @param item - Normalized source item to persist or identify.
 *
 * @returns Deterministic Autmog pen job ID.
 */
export function getAutmogPenJobId(item: NormalizedAutmogPen): string {
  return createJobId("autmog", "pen", item.sourceProductId, item.detailsHash);
}

/**
 * Builds the archive reconciliation job ID for an Autmog snapshot.
 * Sorts source product IDs before hashing, so input ordering does not affect the ID.
 *
 * @param sourceProductIds - Product IDs observed in the complete source snapshot.
 *
 * @returns Deterministic archive reconciliation job ID.
 */
export function getAutmogArchiveJobId(sourceProductIds: readonly string[]) {
  return createJobId(
    "autmog",
    "archive",
    hashObject([...sourceProductIds].sort()),
  );
}

/**
 * Builds the deterministic upload job ID for a temporary image version.
 *
 * @param input - Operation-specific normalized values and controls.
 *
 * @returns Deterministic image upload job ID.
 */
export function getTmpImageUploadJobId(input: {
  /**
   * Database identifier for the temporary image.
   */
  imageId: number;
  /**
   * Scraper source identifier for the record or job.
   */
  source: ScraperSourceName;
  /**
   * Stable hash of source image identity metadata.
   */
  sourceHash: string;
}): string {
  return createJobId(
    input.source,
    "image",
    "upload",
    String(input.imageId),
    input.sourceHash,
  );
}

/**
 * Builds the deterministic deletion job ID for a temporary image.
 *
 * @param input - Operation-specific normalized values and controls.
 *
 * @returns Deterministic image deletion job ID.
 */
export function getTmpImageDeleteJobId(input: {
  /**
   * Database identifier for the temporary image.
   */
  imageId: number;
  /**
   * Scraper source identifier for the record or job.
   */
  source: ScraperSourceName;
}): string {
  return createJobId(input.source, "image", "delete", String(input.imageId));
}

/**
 * Builds the deterministic item job ID for a Saga variation.
 *
 * @param source - Scraper source identifier.
 *
 * @param item - Normalized source item to persist or identify.
 *
 * @returns Deterministic pen variation job ID.
 */
export function getGrimsmoPenVariationJobId(
  source: GrimsmoPenSourceName,
  item: NormalizedGrimsmoPenVariation,
): string {
  return createJobId(
    source,
    "pen-variation",
    item.sourceHandle,
    item.detailsHash,
  );
}

/**
 * Builds the deterministic item job ID for a Grimsmo knife variation.
 *
 * @param source - Scraper source identifier.
 *
 * @param item - Normalized source item to persist or identify.
 *
 * @returns Deterministic knife variation job ID.
 */
export function getGrimsmoKnifeVariationJobId(
  source: GrimsmoKnifeSourceName,
  item: NormalizedGrimsmoKnifeVariation,
): string {
  return createJobId(
    source,
    "knife-variation",
    item.sourceHandle,
    item.detailsHash,
  );
}

/**
 * Builds the reconciliation job ID for a Grimsmo source snapshot.
 * Sorts both handle sets before hashing, so input ordering does not affect the ID.
 *
 * @param input - Source and complete inventory and archive handle sets.
 *
 * @returns Deterministic Grimsmo reconciliation job ID.
 */
export function getGrimsmoVariationBatchJobId(input: {
  /**
   * Source handles currently present in inventory.
   */
  inventorySourceHandles: readonly string[];
  /**
   * Scraper source identifier for the record or job.
   */
  source: GrimsmoSourceName;
  /**
   * All source handles observed in the snapshot.
   */
  sourceHandles: readonly string[];
}): string {
  return createJobId(
    input.source,
    "variation-batch",
    hashObject({
      inventorySourceHandles: [...input.inventorySourceHandles].sort(),
      sourceHandles: [...input.sourceHandles].sort(),
    }),
  );
}

/**
 * Encodes stable job identity parts into a BullMQ-safe identifier.
 *
 * @param parts - Stable job identity segments in hierarchy order.
 *
 * @returns Percent-encoded identity parts joined with stable separators.
 */
function createJobId(...parts: readonly string[]): string {
  return parts.map((part) => encodeURIComponent(part)).join("--");
}
