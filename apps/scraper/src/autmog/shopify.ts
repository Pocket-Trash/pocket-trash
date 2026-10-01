import {
  fetchShopifyCollectionProducts,
  type ShopifyProduct,
} from "../shopify.js";

/**
 * Shopify JSON endpoint for currently available Autmog products.
 */
export const autmogProductsUrl =
  "https://www.autmog.com/collections/currently-available/products.json";

export type { ShopifyProduct };

/**
 * Options for fetching Autmog products from Shopify.
 */
export type FetchAutmogProductsOptions = {
  /**
   * Optional fetch implementation used for Shopify requests.
   */
  fetch?: typeof fetch;
  /**
   * Maximum number of products requested per Shopify page.
   */
  limit?: number;
  /**
   * Maximum number of Shopify pages fetched per collection.
   */
  pageLimit?: number;
  /**
   * Abort signal forwarded to Shopify requests.
   */
  signal?: AbortSignal;
};

/**
 * Fetches currently available Autmog products from Shopify.
 *
 * @param options - Optional fetch implementation, page size, page limit, and abort signal.
 *
 * @returns Fetched Shopify products in collection order.
 *
 * @rejects When the Shopify request or response validation fails.
 */
export async function fetchAutmogProducts({
  fetch: fetcher,
  limit,
  pageLimit,
  signal,
}: FetchAutmogProductsOptions = {}): Promise<ShopifyProduct[]> {
  return fetchShopifyCollectionProducts({
    collectionUrl: autmogProductsUrl,
    fetch: fetcher,
    limit,
    pageLimit,
    signal,
  });
}
