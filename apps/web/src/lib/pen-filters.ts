import {
  formatTranslation,
  type TranslationKey,
} from "@pocket-trash/localizations";
import type { PenProduct } from "./pen-data";

/**
 * Ordered archive filter definitions and their any/all matching capabilities.
 */
export const filterGroups = [
  {
    key: "category",
    labelKey: "web.archive.filter.category",
    andable: false,
  },
  { key: "sizes", labelKey: "web.archive.filter.size", andable: false },
  { key: "materials", labelKey: "web.archive.filter.material", andable: true },
  { key: "refills", labelKey: "web.archive.filter.refill", andable: true },
  {
    key: "mechanisms",
    labelKey: "web.archive.filter.mechanism",
    andable: true,
  },
  { key: "clips", labelKey: "web.archive.filter.clip", andable: false },
  {
    key: "body_details",
    labelKey: "web.archive.filter.bodyDetails",
    andable: true,
  },
  { key: "noses", labelKey: "web.archive.filter.tipNose", andable: true },
  { key: "finishes", labelKey: "web.archive.filter.finish", andable: false },
] as const satisfies readonly {
  /**
   * Whether the group supports matching all selected values.
   */
  andable: boolean;
  /**
   * Product field used by the filter group.
   */
  key: keyof PenProduct;
  /**
   * Localization key for the filter-group label.
   */
  labelKey: TranslationKey;
}[];

/**
 * Archive product fields exposed as filters.
 */
export type FilterKey = (typeof filterGroups)[number]["key"];
/**
 * Whether an andable filter group matches any or all selections.
 */
export type MatchMode = "any" | "all";
/**
 * Supported archive product ordering modes.
 */
export type SortKey =
  | "date_desc"
  | "date_asc"
  | "price_asc"
  | "price_desc"
  | "weight_asc"
  | "weight_desc"
  | "diameter_asc"
  | "diameter_desc"
  | "title_asc";

/**
 * Selected archive filter values keyed by filter group.
 */
export type ActiveFilters = Record<FilterKey, Set<string>>;
/**
 * Per-group any/all matching modes.
 */
export type MatchModes = Record<FilterKey, MatchMode>;

/**
 * Creates empty selection sets for every archive filter group.
 *
 * @returns Fresh empty filter sets for every group.
 */
export function createEmptyFilters(): ActiveFilters {
  return Object.fromEntries(
    filterGroups.map((group) => [group.key, new Set<string>()]),
  ) as ActiveFilters;
}

/**
 * Creates `any` matching mode for every archive filter group.
 *
 * @returns Fresh default match modes for every group.
 */
export function createDefaultMatchModes(): MatchModes {
  return Object.fromEntries(
    filterGroups.map((group) => [group.key, "any"]),
  ) as MatchModes;
}

/**
 * Counts distinct non-empty values for one archive filter and sorts them for display.
 *
 * @param products - Archive products to inspect.
 * @param key - Archive field whose values should be counted.
 * @returns Value/count pairs sorted numerically for sizes or by count and label otherwise.
 */
export function valuesFor(products: PenProduct[], key: FilterKey) {
  const counts = new Map<string, number>();

  for (const product of products) {
    const value = product[key];
    const values = Array.isArray(value) ? value : [value];

    for (const item of values) {
      if (typeof item === "string" && item.length > 0) {
        counts.set(item, (counts.get(item) ?? 0) + 1);
      }
    }
  }

  return [...counts.entries()].sort((a, b) => {
    if (key === "sizes") return Number(a[0]) - Number(b[0]);
    return b[1] - a[1] || a[0].localeCompare(b[0]);
  });
}

/**
 * Per-product cache of normalized archive search text.
 */
const haystackCache = new WeakMap<PenProduct, string>();

/**
 * Builds and caches lowercase searchable text for an archive product.
 *
 * @param product - Archive product whose searchable text is needed.
 * @returns Cached lowercase text used for token matching.
 */
function searchableHaystack(product: PenProduct) {
  const cached = haystackCache.get(product);
  if (cached) return cached;

  const tagBits = [
    ...product.sizes,
    ...product.materials,
    ...product.refills,
    ...product.mechanisms,
    ...product.clips,
    ...product.body_details,
    ...product.noses,
    ...product.finishes,
  ];
  const priceBits = [
    product.price_min == null ? "" : String(Math.round(product.price_min)),
    product.price_max == null || product.price_max === product.price_min
      ? ""
      : String(Math.round(product.price_max)),
  ];
  const haystack =
    `${product.title} ${tagBits.join(" ")} ${priceBits.join(" ")} ${product.body_text}`.toLowerCase();

  haystackCache.set(product, haystack);
  return haystack;
}

/**
 * Checks search tokens and active any/all filters against an archive product.
 *
 * @param product - Archive product to test.
 * @param query - Whitespace-separated search query.
 * @param active - Active archive filter selections.
 * @param matchModes - Per-group any/all matching modes.
 * @returns Whether the product satisfies the search query and active filters.
 */
export function productMatches(
  product: PenProduct,
  query: string,
  active: ActiveFilters,
  matchModes: MatchModes,
) {
  const tokens = query.toLowerCase().trim().split(/\s+/).filter(Boolean);

  if (tokens.length > 0) {
    const haystack = searchableHaystack(product);
    if (!tokens.every((token) => haystack.includes(token))) return false;
  }

  for (const group of filterGroups) {
    const activeValues = active[group.key];
    if (activeValues.size === 0) continue;

    const value = product[group.key];
    const productValues = (Array.isArray(value) ? value : [value]).filter(
      (item): item is string => typeof item === "string",
    );

    if (
      group.andable &&
      matchModes[group.key] === "all" &&
      activeValues.size > 1
    ) {
      for (const selected of activeValues) {
        if (!productValues.includes(selected)) return false;
      }
    } else if (!productValues.some((item) => activeValues.has(item))) {
      return false;
    }
  }

  return true;
}

/**
 * Returns a copy of archive products ordered by the requested mode.
 *
 * @param products - Archive products to sort.
 * @param sort - Requested archive ordering.
 * @returns A newly sorted product array.
 */
export function sortProducts(products: PenProduct[], sort: SortKey) {
  const rows = [...products];
  /**
   * Builds an ascending numeric comparator that places missing values last.
   *
   * @param key - Numeric product field to compare.
   * @returns An ascending comparator for the selected numeric field.
   */
  const numberAscending =
    (key: "price_min" | "weight_g" | "diameter_in") =>
    (a: PenProduct, b: PenProduct) =>
      (a[key] ?? Number.POSITIVE_INFINITY) -
      (b[key] ?? Number.POSITIVE_INFINITY);
  /**
   * Builds a descending numeric comparator that places missing values last.
   *
   * @param key - Numeric product field to compare.
   * @returns A descending comparator for the selected numeric field.
   */
  const numberDescending =
    (key: "price_min" | "weight_g" | "diameter_in") =>
    (a: PenProduct, b: PenProduct) =>
      (b[key] ?? Number.NEGATIVE_INFINITY) -
      (a[key] ?? Number.NEGATIVE_INFINITY);

  switch (sort) {
    case "date_asc":
      rows.sort((a, b) => a.published_at.localeCompare(b.published_at));
      break;
    case "price_asc":
      rows.sort(numberAscending("price_min"));
      break;
    case "price_desc":
      rows.sort(numberDescending("price_min"));
      break;
    case "weight_asc":
      rows.sort(numberAscending("weight_g"));
      break;
    case "weight_desc":
      rows.sort(numberDescending("weight_g"));
      break;
    case "diameter_asc":
      rows.sort(numberAscending("diameter_in"));
      break;
    case "diameter_desc":
      rows.sort(numberDescending("diameter_in"));
      break;
    case "title_asc":
      rows.sort((a, b) => a.title.localeCompare(b.title));
      break;
    case "date_desc":
      rows.sort((a, b) => b.published_at.localeCompare(a.published_at));
      break;
  }

  return rows;
}

/**
 * Builds the archive headline from product size, clip, mechanism, and category data.
 *
 * @param product - Archive product to summarize.
 * @param t - Translation formatter; defaults to the shared formatter.
 * @returns The normalized archive headline.
 */
export function normalizedHeadline(
  product: PenProduct,
  t: (
    key: TranslationKey,
    values?: Readonly<Record<string, unknown>>,
  ) => string = formatTranslation,
) {
  if (product.category === "Accessory") return product.title;

  const clip = product.clips[0];
  const mechanism = product.mechanisms.join("/");
  let size = "";

  if (product.sizes.length === 2) {
    const grip = product.sizes[0];
    const mechanismSize = product.sizes[1];
    size = [
      t("web.archive.headline.grip", { size: grip }),
      t("web.archive.headline.mechanism", { size: mechanismSize }),
    ].join(" - ");
  } else if (product.sizes.length === 1) {
    size = product.sizes[0] ?? "";
  }

  return [size, clip, mechanism, t("web.archive.headline.pen")]
    .filter(Boolean)
    .join(" ");
}

/**
 * Splits an archive title into headline and detail segments.
 *
 * @param title - Archive product title.
 * @returns Headline and detail text; detail is empty when no separator exists.
 */
export function splitTitle(title: string) {
  const dual = title.match(/^(\d{2}\s+\w+\s+-\s+\d{2}\s+\w+)\s*(.*)$/);

  if (dual) {
    const head = dual[1]?.trim() ?? "";
    const detail = dual[2]?.trim() ?? "";
    return { head, detail };
  }

  const index = title.indexOf(" - ");
  if (index < 0) return { head: title, detail: "" };

  return {
    head: title.slice(0, index).trim(),
    detail: title.slice(index + 3).trim(),
  };
}
