/** Canonical product-type keys supported by shared search. */
export type SearchableCatalogProductType =
  | "pen"
  | "pen-actuator"
  | "pen-clip"
  | "pen-mechanism"
  | "pen-tip"
  | "pen-top-cap"
  | "refill"
  | "slider"
  | "slider-insert"
  | "slider-plate"
  | "spinner"
  | "spinner-button";

/** Public terminology-alias fields required by shared search and display. */
export type SearchableCatalogAlias = {
  /** Canonical product-type key named by the alias. */
  canonicalKey: SearchableCatalogProductType;
  /** Registered namespace containing the canonical key. */
  canonicalNamespace: "product-type";
  /** Whether this is the maker's preferred display term. */
  isPreferred: boolean;
  /** Non-localized display label. */
  label: string;
  /** Maker identifier scoping the alias. */
  makerId: number;
  /** Normalized comparison value. */
  normalizedValue: string;
};

/** Minimum catalog and collection fields used by shared client-side search. */
export type SearchableCatalogItem = {
  /** Searchable alternate product names. */
  aliases?: string[];
  /** Localized canonical product-type label. */
  activeTypeLabel: string;
  /** English canonical product-type fallback. */
  englishTypeLabel: string;
  /** Maker identifier. */
  makerId: number;
  /** Maker display name. */
  makerName: string;
  /** Product or collection-item display name. */
  name: string;
  /** Collection owner display name, when searching collection data. */
  ownerDisplayName: string | null;
  /** Canonical product-type key. */
  productTypeSlug: SearchableCatalogProductType;
};

/** Context explaining which non-name field caused a search match. */
export type CatalogSearchMatch = {
  /** Alias whose canonical concept expanded the result set. */
  matchedAlias: string | null;
  /** Collection owner whose name matched. */
  matchedOwner: string | null;
  /** Localized or fallback canonical type label that matched. */
  matchedType: string | null;
};

/**
 * Produces the stable comparison form used by client-side catalog search.
 * A contract test keeps this browser-local implementation aligned with alias persistence.
 *
 * @param value - User-visible catalog text.
 * @returns Lowercase, diacritic-free text with collapsed whitespace.
 */
export function normalizeCatalogSearch(value: string): string {
  return value
    .normalize("NFKD")
    .replaceAll(/\p{Mark}/gu, "")
    .toLocaleLowerCase("en-US")
    .trim()
    .replaceAll(/\s+/gu, " ");
}

/**
 * Matches one catalog or collection item without indexing free-text descriptions.
 * Alias matches expand to all items with the registered canonical product type.
 *
 * @param item - Searchable product or collection item.
 * @param query - User-entered search text.
 * @param aliases - Visible registered terminology aliases.
 * @returns Match context, or `null` when the item does not match.
 */
export function matchCatalogSearch(
  item: SearchableCatalogItem,
  query: string,
  aliases: SearchableCatalogAlias[],
): CatalogSearchMatch | null {
  const normalizedQuery = normalizeCatalogSearch(query);
  if (!normalizedQuery) {
    return { matchedAlias: null, matchedOwner: null, matchedType: null };
  }

  const alias = aliases.find(
    (candidate) =>
      candidate.canonicalNamespace === "product-type" &&
      candidate.normalizedValue.includes(normalizedQuery) &&
      candidate.canonicalKey === item.productTypeSlug,
  );
  if (alias) {
    return {
      matchedAlias: alias.label,
      matchedOwner: null,
      matchedType: null,
    };
  }
  if (normalizeCatalogSearch(item.name).includes(normalizedQuery)) {
    return { matchedAlias: null, matchedOwner: null, matchedType: null };
  }
  const productAlias = item.aliases?.find((candidate) =>
    normalizeCatalogSearch(candidate).includes(normalizedQuery),
  );
  if (productAlias) {
    return {
      matchedAlias: productAlias,
      matchedOwner: null,
      matchedType: null,
    };
  }
  if (normalizeCatalogSearch(item.makerName).includes(normalizedQuery)) {
    return { matchedAlias: null, matchedOwner: null, matchedType: null };
  }
  if (normalizeCatalogSearch(item.activeTypeLabel).includes(normalizedQuery)) {
    return {
      matchedAlias: null,
      matchedOwner: null,
      matchedType: item.activeTypeLabel,
    };
  }
  if (normalizeCatalogSearch(item.englishTypeLabel).includes(normalizedQuery)) {
    return {
      matchedAlias: null,
      matchedOwner: null,
      matchedType: item.englishTypeLabel,
    };
  }
  if (
    item.ownerDisplayName &&
    normalizeCatalogSearch(item.ownerDisplayName).includes(normalizedQuery)
  ) {
    return {
      matchedAlias: null,
      matchedOwner: item.ownerDisplayName,
      matchedType: null,
    };
  }
  return null;
}

/**
 * Returns a maker-preferred alias when registered, otherwise the localized canonical label.
 *
 * @param item - Item whose type label will be displayed.
 * @param aliases - Visible terminology aliases.
 * @returns Preferred maker term or localized canonical label.
 */
export function catalogTypeDisplayLabel(
  item: Pick<
    SearchableCatalogItem,
    "activeTypeLabel" | "makerId" | "productTypeSlug"
  >,
  aliases: SearchableCatalogAlias[],
): string {
  return (
    aliases.find(
      (alias) =>
        alias.canonicalNamespace === "product-type" &&
        alias.canonicalKey === item.productTypeSlug &&
        alias.makerId === item.makerId &&
        alias.isPreferred,
    )?.label ?? item.activeTypeLabel
  );
}
