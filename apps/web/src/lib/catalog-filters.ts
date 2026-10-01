import type {
  CatalogFinishOption,
  CatalogLookup,
  CatalogProduct,
  CatalogProductType,
  UserCollectionItem,
} from "@package/services";

/**
 * Normalized catalog filter selections used by in-memory matching.
 */
export type CatalogFilters = {
  /**
   * Selected color identifiers.
   */
  colorIds: number[];
  /**
   * Selected fade color sets as canonical identifier arrays.
   */
  fadeColorSets: number[][];
  /**
   * Selected finish identifiers.
   */
  finishIds: number[];
  /**
   * Selected maker identifiers.
   */
  makerIds: number[];
  /**
   * Selected material identifiers.
   */
  materialIds: number[];
  /**
   * Selected product type, or `null` for all types.
   */
  productType: CatalogProductType | null;
  /**
   * Whether each filter group must contain every selected value.
   */
  strict: boolean;
};

/**
 * Optional URL-search representation of catalog filter selections.
 */
export type CatalogFilterSearch = {
  /**
   * Color identifiers encoded in URL search.
   */
  color?: number[];
  /**
   * Canonical fade keys encoded in URL search.
   */
  fade?: string[];
  /**
   * Finish identifiers encoded in URL search.
   */
  finish?: number[];
  /**
   * Maker identifiers encoded in URL search.
   */
  maker?: number[];
  /**
   * Material identifiers encoded in URL search.
   */
  material?: number[];
  /**
   * Whether each filter group must contain every selected value.
   */
  strict?: true;
  /**
   * Product type encoded in URL search.
   */
  type?: CatalogProductType;
};

/**
 * Product fields required for catalog facet construction and matching.
 */
export type FilterableCatalogItem = {
  /**
   * Finish configurations available for the item.
   */
  finishOptions: CatalogFinishOption[];
  /**
   * Maker identifier.
   */
  makerId: number;
  /**
   * Maker display name.
   */
  makerName: string;
  /**
   * Available materials.
   */
  materials: CatalogLookup[];
  /**
   * Product-type display name.
   */
  productTypeName: string;
  /**
   * Product-type route slug.
   */
  productTypeSlug: string;
};

/**
 * Catalog lookup augmented with its scoped item count.
 *
 * @template T - Catalog lookup shape augmented with a count.
 */
export type CatalogFacet<T extends CatalogLookup = CatalogLookup> = T & {
  /**
   * Number of scoped items represented by this value.
   */
  count: number;
};

/**
 * Canonical fade color set and its scoped item count.
 */
export type FadeFacet = {
  /**
   * Representative observed color order for the fade.
   */
  colors: CatalogFinishOption["colors"];
  /**
   * Number of scoped items represented by this value.
   */
  count: number;
  /**
   * Canonical key for the fade's color set.
   */
  key: string;
};

/**
 * Available filter facets derived from catalog items.
 */
export type CatalogFacets = {
  /**
   * Available individual colors.
   */
  colors: CatalogFacet<CatalogFinishOption["colors"][number]>[];
  /**
   * Available canonical fade color sets.
   */
  fades: FadeFacet[];
  /**
   * Available finishes.
   */
  finishes: CatalogFacet[];
  /**
   * Available makers.
   */
  makers: Array<{
    /**
     * Number of scoped items represented by this value.
     */
    count: number;
    /** Stable numeric identifier. */
    id: number;
    /** Human-readable display name. */
    name: string;
  }>;
  /**
   * Available materials.
   */
  materials: CatalogFacet[];
  /**
   * Available product types.
   */
  productTypes: Array<{
    /**
     * Number of scoped items represented by this value.
     */
    count: number;
    /** Human-readable display name. */
    name: string;
    /** Stable URL slug. */
    slug: string;
  }>;
};

/**
 * Creates catalog filters with no selections, no product type, and non-strict matching.
 *
 * @returns A fresh empty catalog-filter object.
 */
export const emptyCatalogFilters = (): CatalogFilters => ({
  colorIds: [],
  fadeColorSets: [],
  finishIds: [],
  makerIds: [],
  materialIds: [],
  productType: null,
  strict: false,
});

/**
 * Normalizes unknown URL-search values into supported, unique catalog filter fields.
 *
 * @param search - Current URL-search values.
 * @returns Sanitized URL-search filters with invalid and empty values omitted.
 */
export function parseCatalogFilterSearch(
  search: Record<string, unknown>,
): CatalogFilterSearch {
  const type =
    search.type === "spinner" || search.type === "spinner-button"
      ? search.type
      : undefined;
  const fade = values(search.fade)
    .map((value) =>
      fadeKey(
        value
          .split(".")
          .map(Number)
          .filter((id) => Number.isSafeInteger(id) && id > 0),
      ),
    )
    .filter((value) => value.split(".").length >= 2);
  return {
    color: numbers(search.color),
    fade: fade.length ? [...new Set(fade)] : undefined,
    finish: numbers(search.finish),
    maker: numbers(search.maker),
    material: numbers(search.material),
    strict:
      search.strict === true || search.strict === "true" ? true : undefined,
    type,
  };
}

/**
 * Decodes URL-search filters into normalized in-memory selections.
 *
 * @param search - Current URL-search values.
 * @returns Normalized in-memory catalog filters.
 */
export function filtersFromSearch(search: CatalogFilterSearch): CatalogFilters {
  return {
    colorIds: search.color ?? [],
    fadeColorSets: (search.fade ?? []).map((value) =>
      value.split(".").map(Number),
    ),
    finishIds: search.finish ?? [],
    makerIds: search.maker ?? [],
    materialIds: search.material ?? [],
    productType: search.type ?? null,
    strict: search.strict ?? false,
  };
}

/**
 * Encodes normalized filters for URL search, omitting empty and false values.
 *
 * @param filters - Normalized catalog filters.
 * @returns URL-search filters with empty selections omitted.
 */
export function filtersToSearch(filters: CatalogFilters): CatalogFilterSearch {
  return {
    color: filters.colorIds.length ? filters.colorIds : undefined,
    fade: filters.fadeColorSets.length
      ? filters.fadeColorSets.map(fadeKey)
      : undefined,
    finish: filters.finishIds.length ? filters.finishIds : undefined,
    maker: filters.makerIds.length ? filters.makerIds : undefined,
    material: filters.materialIds.length ? filters.materialIds : undefined,
    strict: filters.strict ? true : undefined,
    type: filters.productType ?? undefined,
  };
}

/**
 * Reports whether any catalog filter or strict mode is active.
 *
 * @param filters - Normalized catalog filters.
 * @returns Whether at least one filter or strict mode is active.
 */
export function hasCatalogFilters(filters: CatalogFilters): boolean {
  return (
    filters.productType !== null ||
    filters.materialIds.length > 0 ||
    filters.finishIds.length > 0 ||
    filters.colorIds.length > 0 ||
    filters.fadeColorSets.length > 0 ||
    filters.makerIds.length > 0 ||
    filters.strict
  );
}

/**
 * Removes unavailable color, fade, finish, maker, and material selections.
 * Product type and strict mode are preserved unchanged.
 *
 * @param filters - Normalized catalog filters.
 * @param facets - Available catalog facets.
 * @returns A filter copy with unavailable item-dependent facet selections removed.
 */
export function pruneCatalogFilters(
  filters: CatalogFilters,
  facets: CatalogFacets,
): CatalogFilters {
  /**
   * Keeps selected identifiers present in the supplied facet values.
   *
   * @param selected - Selected identifiers or values.
   * @param values - Facet values whose identifiers are available.
   * @returns Selected identifiers present in the facet values.
   */
  const allowed = (
    selected: number[],
    values: Array<{
      /**
       * Stable numeric identifier.
       */
      id: number;
    }>,
  ) => {
    const ids = new Set(values.map(({ id }) => id));
    return selected.filter((id) => ids.has(id));
  };
  const fadeKeys = new Set(facets.fades.map(({ key }) => key));
  return {
    ...filters,
    colorIds: allowed(filters.colorIds, facets.colors),
    fadeColorSets: filters.fadeColorSets.filter((colors) =>
      fadeKeys.has(fadeKey(colors)),
    ),
    finishIds: allowed(filters.finishIds, facets.finishes),
    makerIds: allowed(filters.makerIds, facets.makers),
    materialIds: allowed(filters.materialIds, facets.materials),
  };
}

/**
 * Returns a catalog product as a filterable item.
 *
 * @param product - Catalog product to expose to the filter engine.
 * @returns The same product as a filterable item.
 */
export function productFilterItem(
  product: CatalogProduct,
): FilterableCatalogItem {
  return product;
}

/**
 * Adapts a collection item to the fields required for catalog filtering.
 *
 * @param item - Collection item to adapt.
 * @returns The adapted filterable collection item.
 */
export function collectionFilterItem(
  item: UserCollectionItem,
): FilterableCatalogItem {
  return {
    finishOptions: item.finishOption ? [item.finishOption] : [],
    makerId: item.makerId,
    makerName: item.makerName,
    materials: item.material ? [item.material] : [],
    productTypeName: item.productTypeName,
    productTypeSlug: item.productTypeSlug,
  };
}

/**
 * Checks a filterable item against product-type, maker, material, finish, color, and fade selections.
 *
 * @param item - Collection or catalog item to process.
 * @param filters - Normalized catalog filters.
 * @returns Whether the item satisfies every active filter group.
 */
export function matchesCatalogFilters(
  item: FilterableCatalogItem,
  filters: CatalogFilters,
): boolean {
  if (
    filters.productType !== null &&
    item.productTypeSlug !== filters.productType
  ) {
    return false;
  }
  if (!matchesIds([item.makerId], filters.makerIds, filters.strict)) {
    return false;
  }
  if (
    !matchesIds(
      item.materials.map(({ id }) => id),
      filters.materialIds,
      filters.strict,
    )
  ) {
    return false;
  }

  const hasFinishFilters =
    filters.finishIds.length > 0 ||
    filters.colorIds.length > 0 ||
    filters.fadeColorSets.length > 0;
  return (
    !hasFinishFilters ||
    item.finishOptions.some((option) => matchesFinishOption(option, filters))
  );
}

/**
 * Builds counted, sorted facets, scoped by product type where applicable.
 * Reverse-order fades share a canonical key; the most frequent observed order wins, with lexical ties, and fades sort by count then key.
 *
 * @param items - Filterable items used to count available facets.
 * @param productType - Product type used to scope item-dependent facets, or `null` for all types.
 * @returns Counted and sorted catalog facets.
 */
export function buildCatalogFacets(
  items: FilterableCatalogItem[],
  productType: CatalogProductType | null,
): CatalogFacets {
  const scoped = productType
    ? items.filter((item) => item.productTypeSlug === productType)
    : items;
  const materials = new Map<number, CatalogFacet>();
  const finishes = new Map<number, CatalogFacet>();
  const colors = new Map<
    number,
    CatalogFacet<CatalogFinishOption["colors"][number]>
  >();
  const makers = new Map<
    number,
    {
      /**
       * Number of scoped items represented by this value.
       */
      count: number;
      /** Stable numeric identifier. */
      id: number;
      /** Human-readable display name. */
      name: string;
    }
  >();
  const productTypes = new Map<
    string,
    {
      /**
       * Number of scoped items represented by this value.
       */
      count: number;
      /** Human-readable display name. */
      name: string;
      /** Stable URL slug. */
      slug: string;
    }
  >();
  const fades = new Map<
    string,
    {
      /**
       * Number of scoped items represented by this value.
       */
      count: number;
      /**
       * Observed color orders for a canonical fade set.
       */
      orders: Map<
        string,
        {
          /**
           * Colors in this observed fade order.
           */
          colors: CatalogFinishOption["colors"];
          /** Number of scoped items represented by this color order. */
          count: number;
        }
      >;
    }
  >();

  for (const item of items) {
    const type = productTypes.get(item.productTypeSlug);
    productTypes.set(item.productTypeSlug, {
      count: (type?.count ?? 0) + 1,
      name: item.productTypeName,
      slug: item.productTypeSlug,
    });
  }

  for (const item of scoped) {
    incrementUnique(materials, item.materials);
    incrementUnique(
      finishes,
      item.finishOptions.flatMap(({ finishes: values }) => values),
    );
    incrementUnique(
      colors,
      item.finishOptions.flatMap(({ colors: values }) => values),
    );
    const maker = makers.get(item.makerId);
    makers.set(item.makerId, {
      count: (maker?.count ?? 0) + 1,
      id: item.makerId,
      name: item.makerName,
    });
    const seenFades = new Set<string>();
    for (const option of item.finishOptions) {
      if (option.colorEffect?.slug !== "fade" || option.colors.length < 2) {
        continue;
      }
      const key = fadeKey(option.colors.map(({ id }) => id));
      if (seenFades.has(key)) continue;
      seenFades.add(key);
      const existing = fades.get(key) ?? { count: 0, orders: new Map() };
      existing.count += 1;
      const orderKey = option.colors.map(({ id }) => id).join(".");
      const order = existing.orders.get(orderKey);
      existing.orders.set(orderKey, {
        colors: option.colors,
        count: (order?.count ?? 0) + 1,
      });
      fades.set(key, existing);
    }
  }

  return {
    colors: sortFacets(colors.values()),
    fades: [...fades.entries()]
      .map(([key, value]) => ({
        colors:
          [...value.orders.entries()].sort(
            ([leftKey, left], [rightKey, right]) =>
              right.count - left.count || leftKey.localeCompare(rightKey),
          )[0]?.[1].colors ?? [],
        count: value.count,
        key,
      }))
      .sort(
        (left, right) =>
          right.count - left.count || left.key.localeCompare(right.key),
      ),
    finishes: sortFacets(finishes.values()),
    makers: [...makers.values()].sort(
      (left, right) =>
        right.count - left.count || left.name.localeCompare(right.name),
    ),
    materials: sortFacets(materials.values()),
    productTypes: [...productTypes.values()].sort((left, right) =>
      left.name.localeCompare(right.name),
    ),
  };
}

/**
 * Builds a canonical key from unique sorted color identifiers.
 *
 * @param colorIds - Color identifiers to canonicalize.
 * @returns Dot-separated unique sorted color identifiers.
 */
export function fadeKey(colorIds: number[]): string {
  return [...new Set(colorIds)].sort((left, right) => left - right).join(".");
}

/**
 * Checks one finish option against finish, color, fade, and strict-mode selections.
 *
 * @param option - Finish option to test.
 * @param filters - Normalized catalog filters.
 * @returns Whether the finish option satisfies the active finish-related filters.
 */
function matchesFinishOption(
  option: CatalogFinishOption,
  filters: CatalogFilters,
): boolean {
  if (
    !matchesIds(
      option.finishes.map(({ id }) => id),
      filters.finishIds,
      filters.strict,
    ) ||
    !matchesIds(
      option.colors.map(({ id }) => id),
      filters.colorIds,
      filters.strict,
    )
  ) {
    return false;
  }
  if (!filters.fadeColorSets.length) return true;
  if (option.colorEffect?.slug !== "fade") return false;
  const candidate = new Set(option.colors.map(({ id }) => id));
  /**
   * Checks whether a candidate fade contains every selected color.
   *
   * @param selected - Selected identifiers or values.
   * @returns Whether the candidate fade contains every selected color.
   */
  const matches = (selected: number[]) =>
    selected.every((id) => candidate.has(id));
  return filters.strict
    ? filters.fadeColorSets.every(matches)
    : filters.fadeColorSets.some(matches);
}

/**
 * Matches available identifiers against selected identifiers using any or all semantics.
 *
 * @param available - Identifiers available on the candidate item.
 * @param selected - Selected identifiers or values.
 * @param strict - Whether every selected identifier must be available.
 * @returns Whether the candidate identifiers satisfy the selection mode.
 */
function matchesIds(
  available: number[],
  selected: number[],
  strict: boolean,
): boolean {
  if (!selected.length) return true;
  const values = new Set(available);
  return strict
    ? selected.every((id) => values.has(id))
    : selected.some((id) => values.has(id));
}

/**
 * Increments each distinct lookup value once for the current item.
 *
 * @param target - Facet map to update.
 * @param values - Lookup values observed for the current item.
 * @template T - Catalog lookup shape counted by the facet map.
 */
function incrementUnique<T extends CatalogLookup>(
  target: Map<number, CatalogFacet<T>>,
  values: T[],
) {
  for (const value of new Map(values.map((item) => [item.id, item])).values()) {
    const existing = target.get(value.id);
    target.set(value.id, { ...value, count: (existing?.count ?? 0) + 1 });
  }
}

/**
 * Sorts facets by descending count and then display name.
 *
 * @param values - Facets to order.
 * @returns A new count-descending, name-ascending facet array.
 * @template T - Catalog lookup shape carried by each facet.
 */
function sortFacets<T extends CatalogLookup>(
  values: Iterable<CatalogFacet<T>>,
): CatalogFacet<T>[] {
  return [...values].sort(
    (left, right) =>
      right.count - left.count || left.name.localeCompare(right.name),
  );
}

/**
 * Flattens comma-separated numeric or string search input into trimmed strings.
 *
 * @param value - Unknown URL-search input to flatten.
 * @returns Flattened trimmed search values.
 */
function values(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(values);
  if (typeof value === "number" || typeof value === "string") {
    return String(value)
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
  }
  return [];
}

/**
 * Parses unique positive safe-integer identifiers from unknown search input.
 *
 * @param value - Unknown URL-search input to parse.
 * @returns Unique positive safe integers, or `undefined` when none are valid.
 */
function numbers(value: unknown): number[] | undefined {
  const parsed = values(value)
    .map(Number)
    .filter((id) => Number.isSafeInteger(id) && id > 0);
  const unique = [...new Set(parsed)];
  return unique.length ? unique : undefined;
}
