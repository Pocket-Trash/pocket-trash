import {
  type GrimsmoCollectionKind,
  type GrimsmoKnifeSourceName,
  type GrimsmoKnifeType,
  type GrimsmoSourceName,
  scraperSources,
} from "../scraper-types.js";
import {
  fetchShopifyCollectionProducts,
  type ShopifyProduct,
} from "../shopify.js";

/**
 * Canonical Grimsmo storefront origin.
 */
const grimsmoRootUrl = "https://grimsmoknives.com";

/**
 * Metadata that maps a scraper source to a Grimsmo product family.
 */
export type GrimsmoSourceDefinition =
  | {
      /**
       * Product family kind represented by the source.
       */
      kind: "pen";
      /**
       * Stable storefront handle for the product family.
       */
      productHandle: "saga";
      /**
       * Grimsmo scraper source identifier.
       */
      source: typeof scraperSources.grimsmoSaga;
      /**
       * Display title for the stable product family.
       */
      title: "Saga";
    }
  | {
      /**
       * Product family kind represented by the source.
       */
      kind: "knife";
      /**
       * Normalized knife family identifier.
       */
      knifeType: GrimsmoKnifeType;
      /**
       * Stable storefront handle for the product family.
       */
      productHandle: GrimsmoKnifeType;
      /**
       * Grimsmo scraper source identifier.
       */
      source: GrimsmoKnifeSourceName;
      /**
       * Display title for the stable product family.
       */
      title: "Fjell" | "Norseman" | "Rask";
    };

/**
 * A Shopify product annotated with its Grimsmo collection origin.
 */
export type GrimsmoFetchedProduct = {
  /**
   * Collection that supplied the product.
   */
  collectionKind: GrimsmoCollectionKind;
  /**
   * Shopify product payload supplied by the source.
   */
  product: ShopifyProduct;
};

/**
 * Options for fetching one Grimsmo product source.
 */
export type FetchGrimsmoProductsOptions = {
  /**
   * Optional fetch implementation used for Shopify requests.
   */
  fetch?: typeof fetch;
  /**
   * Maximum number of products requested per Shopify page.
   */
  limit?: number;
  /**
   * Maximum products returned across inventory and archive collections.
   */
  maxProducts?: number;
  /**
   * Maximum number of Shopify pages fetched per collection.
   */
  pageLimit?: number;
  /**
   * Delay in milliseconds between Shopify page requests.
   */
  pagePauseMs?: number;
  /**
   * Optional proxy URL used for Shopify requests.
   */
  proxyUrl?: string;
  /**
   * Timeout in milliseconds for each Shopify request.
   */
  requestTimeoutMs?: number;
  /**
   * Total attempts allowed for a Shopify request.
   */
  retries?: number;
  /**
   * Abort signal forwarded to Shopify requests.
   */
  signal?: AbortSignal;
  /**
   * Grimsmo scraper source identifier.
   */
  source: GrimsmoSourceName;
};

/**
 * Product metadata keyed by supported Grimsmo scraper source.
 */
export const grimsmoSourceDefinitions = {
  [scraperSources.grimsmoSaga]: {
    kind: "pen",
    productHandle: "saga",
    source: scraperSources.grimsmoSaga,
    title: "Saga",
  },
  [scraperSources.grimsmoFjell]: {
    kind: "knife",
    knifeType: "fjell",
    productHandle: "fjell",
    source: scraperSources.grimsmoFjell,
    title: "Fjell",
  },
  [scraperSources.grimsmoNorseman]: {
    kind: "knife",
    knifeType: "norseman",
    productHandle: "norseman",
    source: scraperSources.grimsmoNorseman,
    title: "Norseman",
  },
  [scraperSources.grimsmoRask]: {
    kind: "knife",
    knifeType: "rask",
    productHandle: "rask",
    source: scraperSources.grimsmoRask,
    title: "Rask",
  },
} as const satisfies Record<GrimsmoSourceName, GrimsmoSourceDefinition>;

/**
 * Inventory and archive Shopify collection handles by Grimsmo source.
 */
const collectionHandles = {
  [scraperSources.grimsmoSaga]: {
    archive: "saga",
    inventory: "saga-inventory",
  },
  [scraperSources.grimsmoFjell]: {
    archive: "fjell-archive",
    inventory: "fjell-inventory",
  },
  [scraperSources.grimsmoNorseman]: {
    archive: "norseman-archive",
    inventory: "norseman-inventory",
  },
  [scraperSources.grimsmoRask]: {
    archive: "rask-archive",
    inventory: "rask-inventory",
  },
} as const;

/**
 * Returns the product-family metadata for a Grimsmo source.
 *
 * @param source - Supported Grimsmo source identifier.
 *
 * @returns Metadata for the requested source.
 */
export function getGrimsmoSourceDefinition(
  source: GrimsmoSourceName,
): GrimsmoSourceDefinition {
  return grimsmoSourceDefinitions[source];
}

/**
 * Fetches and merges inventory and archive products for one Grimsmo source.
 *
 * @param options - Source selection, collection limits, transport controls, and abort signal.
 *
 * @returns Inventory-first products with archive duplicates removed.
 *
 * @rejects When the Shopify request fails or the source is unsupported.
 */
export async function fetchGrimsmoProducts({
  fetch: fetcher,
  limit,
  maxProducts,
  pageLimit = 30,
  pagePauseMs = 500,
  proxyUrl,
  requestTimeoutMs,
  retries = 3,
  signal,
  source,
}: FetchGrimsmoProductsOptions): Promise<GrimsmoFetchedProduct[]> {
  const handles = collectionHandles[source];

  if (!handles) {
    throw new Error(`Unsupported Grimsmo source "${source}".`);
  }

  if (maxProducts !== undefined) {
    const fetchLimit = Math.min(limit ?? maxProducts, maxProducts);
    const inventoryProducts = await fetchShopifyCollectionProducts({
      collectionUrl: buildCollectionProductsUrl(handles.inventory),
      fetch: fetcher,
      limit: fetchLimit,
      pageLimit: 1,
      pagePauseMs,
      proxyUrl,
      requestTimeoutMs,
      retries,
      signal,
      userAgent: "python-requests/2.33.1",
    });
    const archiveProductLimit = maxProducts - inventoryProducts.length;
    const archiveProducts =
      archiveProductLimit > 0
        ? await fetchShopifyCollectionProducts({
            collectionUrl: buildCollectionProductsUrl(handles.archive),
            fetch: fetcher,
            limit: Math.min(limit ?? archiveProductLimit, archiveProductLimit),
            pageLimit: 1,
            pagePauseMs,
            proxyUrl,
            requestTimeoutMs,
            retries,
            signal,
            userAgent: "python-requests/2.33.1",
          })
        : [];

    return mergeGrimsmoCollections({ archiveProducts, inventoryProducts });
  }

  const [inventoryProducts, archiveProducts] = await Promise.all([
    fetchShopifyCollectionProducts({
      collectionUrl: buildCollectionProductsUrl(handles.inventory),
      fetch: fetcher,
      limit,
      pageLimit,
      pagePauseMs,
      proxyUrl,
      requestTimeoutMs,
      retries,
      signal,
      userAgent: "python-requests/2.33.1",
    }),
    fetchShopifyCollectionProducts({
      collectionUrl: buildCollectionProductsUrl(handles.archive),
      fetch: fetcher,
      limit,
      pageLimit,
      pagePauseMs,
      proxyUrl,
      requestTimeoutMs,
      retries,
      signal,
      userAgent: "python-requests/2.33.1",
    }),
  ]);

  return mergeGrimsmoCollections({ archiveProducts, inventoryProducts });
}

/**
 * Merges inventory before archive products and removes duplicate handles.
 *
 * @param options - Inventory and archive products to merge.
 *
 * @returns Inventory-first products annotated with collection origin.
 */
function mergeGrimsmoCollections({
  archiveProducts,
  inventoryProducts,
}: {
  /**
   * Products fetched from the archive collection.
   */
  archiveProducts: ShopifyProduct[];
  /**
   * Products fetched from the inventory collection.
   */
  inventoryProducts: ShopifyProduct[];
}) {
  const seenHandles = new Set<string>();
  const fetched: GrimsmoFetchedProduct[] = [];

  for (const product of inventoryProducts) {
    seenHandles.add(product.handle);
    fetched.push({ collectionKind: "inventory", product });
  }

  for (const product of archiveProducts) {
    if (seenHandles.has(product.handle)) {
      continue;
    }

    fetched.push({ collectionKind: "archive", product });
  }

  return fetched;
}

/**
 * Builds the storefront URL for a Grimsmo listing.
 *
 * @param handle - Storefront product or collection handle.
 *
 * @returns The individual product URL.
 */
export function buildGrimsmoProductUrl(handle: string) {
  return `${grimsmoRootUrl}/products/${handle}`;
}

/**
 * Builds the storefront URL for a Grimsmo product family.
 *
 * @param handle - Storefront product or collection handle.
 *
 * @returns The product-family collection URL.
 */
export function buildGrimsmoProductFamilyUrl(handle: string) {
  return `${grimsmoRootUrl}/collections/${handle}`;
}

/**
 * Builds the Shopify JSON endpoint for a Grimsmo collection.
 *
 * @param handle - Storefront product or collection handle.
 *
 * @returns The collection products JSON URL.
 */
function buildCollectionProductsUrl(handle: string) {
  return `${grimsmoRootUrl}/collections/${handle}/products.json`;
}
