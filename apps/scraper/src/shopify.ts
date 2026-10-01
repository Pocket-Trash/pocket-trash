import { setTimeout as sleep } from "node:timers/promises";
import { ProxyAgent } from "undici";
import { z } from "zod";

/**
 * Permissive schema for Shopify product variants used by normalization.
 */
export const shopifyVariantSchema = z
  .object({
    available: z.boolean().optional(),
    id: z.union([z.number(), z.string()]),
    price: z.union([z.number(), z.string()]).nullable().optional(),
    title: z.string().nullable().optional(),
  })
  .passthrough();

/**
 * Permissive schema for Shopify product images used by normalization.
 */
export const shopifyImageSchema = z
  .object({
    alt: z.string().nullable().optional(),
    height: z.number().nullable().optional(),
    id: z.union([z.number(), z.string()]).nullable().optional(),
    position: z.number().nullable().optional(),
    src: z.string().url(),
    width: z.number().nullable().optional(),
  })
  .passthrough();

/**
 * Permissive schema for Shopify collection-product payloads.
 */
export const shopifyProductSchema = z
  .object({
    available: z.boolean().optional(),
    body_html: z.string().nullable().optional(),
    created_at: z.string().nullable().optional(),
    handle: z.string(),
    id: z.union([z.number(), z.string()]),
    images: z.array(shopifyImageSchema).default([]),
    product_type: z.string().nullable().optional(),
    published_at: z.string().nullable().optional(),
    tags: z.array(z.string()).default([]),
    title: z.string(),
    updated_at: z.string().nullable().optional(),
    variants: z.array(shopifyVariantSchema).default([]),
    vendor: z.string().nullable().optional(),
  })
  .passthrough();

/**
 * Schema for Shopify's collection products response envelope.
 */
const shopifyProductsResponseSchema = z.object({
  products: z.array(shopifyProductSchema),
});

/**
 * Validated Shopify product with unknown source fields preserved.
 */
export type ShopifyProduct = z.infer<typeof shopifyProductSchema>;

/**
 * Pagination, transport, cancellation, and retry settings for a Shopify collection.
 */
export type FetchShopifyCollectionProductsOptions = {
  /**
   * Collection endpoint URL without pagination parameters.
   */
  collectionUrl: string;
  /**
   * Fetch implementation, primarily for testing.
   */
  fetch?: typeof fetch;
  /**
   * Maximum products requested per page; defaults to 250.
   */
  limit?: number;
  /**
   * Maximum pages requested; defaults to 25.
   */
  pageLimit?: number;
  /**
   * Abortable pause between full pages in milliseconds.
   */
  pagePauseMs?: number;
  /**
   * Optional HTTP proxy URL used by Undici.
   */
  proxyUrl?: string;
  /**
   * Per-attempt timeout in milliseconds; values below one become one.
   */
  requestTimeoutMs?: number;
  /**
   * Maximum total attempts per page; values below one become one.
   */
  retries?: number;
  /**
   * Signal that cancels requests and pagination pauses.
   */
  signal?: AbortSignal;
  /**
   * HTTP user-agent header sent to Shopify.
   */
  userAgent?: string;
};

/**
 * Fetches and validates paginated products from a Shopify collection endpoint.
 *
 * @param options - Collection URL and optional pagination and transport settings.
 * @returns Validated products in source page order.
 * @rejects When requests fail, a final response is unsuccessful, input is aborted, or payload validation fails.
 */
export async function fetchShopifyCollectionProducts({
  collectionUrl,
  fetch: fetcher = fetch,
  limit = 250,
  pageLimit = 25,
  pagePauseMs = 0,
  proxyUrl,
  requestTimeoutMs = 10_000,
  retries = 1,
  signal,
  userAgent = "pocket-trash-scraper/1.0",
}: FetchShopifyCollectionProductsOptions): Promise<ShopifyProduct[]> {
  const products: ShopifyProduct[] = [];

  for (let page = 1; page <= pageLimit; page += 1) {
    const url = new URL(collectionUrl);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("page", String(page));

    const response = await fetchWithRetry({
      fetcher,
      proxyUrl,
      requestTimeoutMs,
      retries,
      signal,
      url,
      userAgent,
    });

    if (!response.ok) {
      throw new Error(
        `Shopify products fetch failed with ${response.status} for ${collectionUrl}.`,
      );
    }

    const payload = shopifyProductsResponseSchema.parse(await response.json());

    if (payload.products.length === 0) {
      break;
    }

    products.push(...payload.products);

    if (payload.products.length < limit) {
      break;
    }

    if (pagePauseMs > 0) {
      await sleep(pagePauseMs, undefined, { signal });
    }
  }

  return products;
}

/**
 * Fetches one Shopify page with bounded attempts and linear backoff.
 *
 * @param options - Request URL, transport settings, attempt limit, and cancellation signal.
 * @returns The first successful response, or the final unsuccessful response.
 * @rejects When the final request attempt throws or cancellation interrupts backoff.
 */
async function fetchWithRetry({
  fetcher,
  proxyUrl,
  requestTimeoutMs,
  retries,
  signal,
  url,
  userAgent,
}: {
  /**
   * Fetch implementation.
   */
  fetcher: typeof fetch;
  /**
   * Optional HTTP proxy URL.
   */
  proxyUrl?: string;
  /**
   * Per-attempt timeout in milliseconds.
   */
  requestTimeoutMs: number;
  /**
   * Maximum total request attempts.
   */
  retries: number;
  /**
   * Caller cancellation signal.
   */
  signal?: AbortSignal;
  /**
   * Paginated Shopify endpoint URL.
   */
  url: URL;
  /**
   * HTTP user-agent header value.
   */
  userAgent: string;
}) {
  let lastError: unknown;
  const attempts = Math.max(1, retries);

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const requestSignal = createRequestSignal({
      requestTimeoutMs,
      signal,
      url,
    });

    try {
      const response = await fetcher(
        url,
        await getFetchInit({
          proxyUrl,
          signal: requestSignal.signal,
          userAgent,
        }),
      );

      if (response.ok || attempt === attempts) {
        return response;
      }

      lastError = new Error(
        `Shopify products fetch failed with ${response.status}.`,
      );
    } catch (error) {
      lastError = error;

      if (attempt === attempts) {
        throw error;
      }
    } finally {
      requestSignal.cleanup();
    }

    await sleep(1_000 * attempt, undefined, { signal });
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Shopify products fetch failed.");
}

/**
 * Builds request headers, cancellation, and optional Undici proxy dispatch.
 *
 * @param options - Proxy, cancellation, and user-agent settings.
 * @returns Request initialization for the Shopify page fetch.
 */
async function getFetchInit({
  proxyUrl,
  signal,
  userAgent,
}: {
  /**
   * Optional HTTP proxy URL.
   */
  proxyUrl?: string;
  /**
   * Per-attempt cancellation signal.
   */
  signal?: AbortSignal;
  /**
   * HTTP user-agent header value.
   */
  userAgent: string;
}): Promise<RequestInit> {
  const headers = {
    accept: "application/json,image/*",
    "user-agent": userAgent,
  };

  if (!proxyUrl) {
    return { headers, signal };
  }

  return {
    dispatcher: new ProxyAgent(proxyUrl),
    headers,
    signal,
  } as RequestInit;
}

/**
 * Combines caller cancellation with a per-attempt timeout.
 *
 * @param options - Timeout, caller signal, and URL used in timeout errors.
 * @returns The combined signal and a cleanup callback for timers and listeners.
 */
function createRequestSignal({
  requestTimeoutMs,
  signal,
  url,
}: {
  /**
   * Per-attempt timeout in milliseconds.
   */
  requestTimeoutMs: number;
  /**
   * Optional caller cancellation signal.
   */
  signal?: AbortSignal;
  /**
   * Request URL included in timeout errors.
   */
  url: URL;
}) {
  const timeoutMs = Math.max(1, requestTimeoutMs);
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort(
      new Error(
        `Shopify products fetch timed out after ${timeoutMs}ms for ${url.href}.`,
      ),
    );
  }, timeoutMs);
  /**
   * Propagates caller cancellation and its reason to the request signal.
   */
  const abortRequest = () => {
    controller.abort(signal?.reason);
  };

  if (signal?.aborted) {
    abortRequest();
  } else {
    signal?.addEventListener("abort", abortRequest, { once: true });
  }

  return {
    /**
     * Clears timeout and caller-signal listener resources.
     */
    cleanup() {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abortRequest);
    },
    signal: controller.signal,
  };
}
