/** Normalized independent maker-detail page parameters. */
export interface MakerDetailSearch {
  /** One-based collection-items page, omitted for the first page. */
  collectionItemsPage?: number;
  /** One-based products page, omitted for the first page. */
  productsPage?: number;
}

/**
 * Parses one untrusted page query value.
 *
 * @param value - Raw query value.
 * @returns A positive page number, defaulting to one.
 */
export function parseMakerPage(value: unknown) {
  const page = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

/**
 * Normalizes independent maker-detail page query values.
 *
 * @param search - Raw route query values.
 * @returns Normalized query state with first pages omitted.
 */
export function parseMakerDetailSearch(
  search: Record<string, unknown>,
): MakerDetailSearch {
  const collectionItemsPage = parseMakerPage(search.collectionItemsPage);
  const productsPage = parseMakerPage(search.productsPage);
  return {
    ...(collectionItemsPage === 1 ? {} : { collectionItemsPage }),
    ...(productsPage === 1 ? {} : { productsPage }),
  };
}

/**
 * Updates one zero-based controlled page while preserving its sibling page.
 *
 * @param search - Current normalized search state.
 * @param key - Page parameter to update.
 * @param page - Zero-based destination page.
 * @returns Updated one-based URL search state.
 */
export function withMakerPage(
  search: MakerDetailSearch,
  key: keyof MakerDetailSearch,
  page: number,
): MakerDetailSearch {
  return {
    ...search,
    [key]: page === 0 ? undefined : page + 1,
  };
}
