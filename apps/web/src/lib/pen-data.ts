import penData from "../../../../packages/json-data/autmog.json";

/**
 * Normalized product record imported from the archive data set.
 */
export interface PenProduct {
  /**
   * Stable numeric identifier.
   */
  id: number;
  /**
   * Product title.
   */
  title: string;
  /**
   * Source product URL.
   */
  url: string;
  /**
   * Source publication date.
   */
  published_at: string;
  /**
   * Source creation timestamp.
   */
  created_at: string;
  /**
   * Source update timestamp.
   */
  updated_at: string;
  /**
   * First archive observation timestamp.
   */
  first_seen: string;
  /**
   * Most recent archive observation timestamp.
   */
  last_seen: string;
  /**
   * Whether the source product is archived.
   */
  archived: boolean;
  /**
   * Minimum source price in the base currency.
   */
  price_min: number;
  /**
   * Maximum source price in the base currency.
   */
  price_max: number;
  /**
   * Number of source variants.
   */
  variant_count: number;
  /**
   * Source variant titles.
   */
  variant_titles: string[];
  /**
   * Primary image path.
   */
  image: string;
  /**
   * Primary CDN image URL.
   */
  image_cdn: string;
  /**
   * Primary downloaded image path.
   */
  image_local: string;
  /**
   * Downloaded image paths.
   */
  images_local: string[];
  /**
   * Number of product images.
   */
  image_count: number;
  /**
   * Plain-text product description.
   */
  body_text: string;
  /**
   * HTML product description.
   */
  body_html: string;
  /**
   * Archive product category.
   */
  category: string;
  /**
   * Product size labels.
   */
  sizes: string[];
  /**
   * Product material labels.
   */
  materials: string[];
  /**
   * Compatible refill labels.
   */
  refills: string[];
  /**
   * Mechanism labels.
   */
  mechanisms: string[];
  /**
   * Clip style labels.
   */
  clips: string[];
  /**
   * Tip or nose style labels.
   */
  noses: string[];
  /**
   * Product finish labels.
   */
  finishes: string[];
  /**
   * Body-detail labels.
   */
  body_details: string[];
  /**
   * Diameter in inches, or `null` when unknown.
   */
  diameter_in: number | null;
  /**
   * Diameter in millimetres, or `null` when unknown.
   */
  diameter_mm: number | null;
  /**
   * Weight in grams, or `null` when unknown.
   */
  weight_g: number | null;
  /**
   * Length in inches, or `null` when unknown.
   */
  length_in: number | null;
}

/**
 * Top-level shape of the imported archive data set.
 */
interface PenProductCollection {
  /**
   * Imported archive products.
   */
  products: PenProduct[];
}

/**
 * Public prefix used for bundled archive product images.
 */
const IMAGE_PREFIX = "/images/tmp/";

/**
 * Rewrites an imported image path to its public bundled-image URL.
 *
 * @param path - Imported image path.
 * @returns The public bundled-image URL, or the original path when it has no final segment.
 */
function localImageUrl(path: string) {
  const filename = path.split("/").pop();
  return filename ? `${IMAGE_PREFIX}${filename}` : path;
}

/**
 * Archive product data with imported image paths rewritten to public local URLs.
 */
export const products: PenProduct[] = (
  penData as PenProductCollection
).products.map((product) => ({
  ...product,
  image: localImageUrl(product.image),
  image_local: localImageUrl(product.image_local),
  images_local: product.images_local.map(localImageUrl),
}));
