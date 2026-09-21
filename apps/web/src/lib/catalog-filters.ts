import type {
  CatalogFinishOption,
  CatalogLookup,
  CatalogProduct,
  CatalogProductType,
  UserCollectionItem,
} from "@package/services";

export type CatalogFilters = {
  colorIds: number[];
  fadeColorSets: number[][];
  finishIds: number[];
  makerIds: number[];
  materialIds: number[];
  productType: CatalogProductType | null;
  strict: boolean;
};

export type CatalogFilterSearch = {
  color?: number[];
  fade?: string[];
  finish?: number[];
  maker?: number[];
  material?: number[];
  strict?: true;
  type?: CatalogProductType;
};

export type FilterableCatalogItem = {
  finishOptions: CatalogFinishOption[];
  makerId: number;
  makerName: string;
  materials: CatalogLookup[];
  productTypeName: string;
  productTypeSlug: string;
};

export type CatalogFacet<T extends CatalogLookup = CatalogLookup> = T & {
  count: number;
};

export type FadeFacet = {
  colors: CatalogFinishOption["colors"];
  count: number;
  key: string;
};

export type CatalogFacets = {
  colors: CatalogFacet<CatalogFinishOption["colors"][number]>[];
  fades: FadeFacet[];
  finishes: CatalogFacet[];
  makers: Array<{ count: number; id: number; name: string }>;
  materials: CatalogFacet[];
  productTypes: Array<{ count: number; name: string; slug: string }>;
};

export const emptyCatalogFilters = (): CatalogFilters => ({
  colorIds: [],
  fadeColorSets: [],
  finishIds: [],
  makerIds: [],
  materialIds: [],
  productType: null,
  strict: false,
});

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
    fade: [...new Set(fade)],
    finish: numbers(search.finish),
    maker: numbers(search.maker),
    material: numbers(search.material),
    strict:
      search.strict === true || search.strict === "true" ? true : undefined,
    type,
  };
}

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

export function pruneCatalogFilters(
  filters: CatalogFilters,
  facets: CatalogFacets,
): CatalogFilters {
  const allowed = (selected: number[], values: Array<{ id: number }>) => {
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

export function productFilterItem(
  product: CatalogProduct,
): FilterableCatalogItem {
  return product;
}

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
  const makers = new Map<number, { count: number; id: number; name: string }>();
  const productTypes = new Map<
    string,
    { count: number; name: string; slug: string }
  >();
  const fades = new Map<
    string,
    {
      count: number;
      orders: Map<
        string,
        { colors: CatalogFinishOption["colors"]; count: number }
      >;
    }
  >();

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
    const type = productTypes.get(item.productTypeSlug);
    productTypes.set(item.productTypeSlug, {
      count: (type?.count ?? 0) + 1,
      name: item.productTypeName,
      slug: item.productTypeSlug,
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

export function fadeKey(colorIds: number[]): string {
  return [...new Set(colorIds)].sort((left, right) => left - right).join(".");
}

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
  const matches = (selected: number[]) =>
    selected.every((id) => candidate.has(id));
  return filters.strict
    ? filters.fadeColorSets.every(matches)
    : filters.fadeColorSets.some(matches);
}

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

function incrementUnique<T extends CatalogLookup>(
  target: Map<number, CatalogFacet<T>>,
  values: T[],
) {
  for (const value of new Map(values.map((item) => [item.id, item])).values()) {
    const existing = target.get(value.id);
    target.set(value.id, { ...value, count: (existing?.count ?? 0) + 1 });
  }
}

function sortFacets<T extends CatalogLookup>(
  values: Iterable<CatalogFacet<T>>,
): CatalogFacet<T>[] {
  return [...values].sort(
    (left, right) =>
      right.count - left.count || left.name.localeCompare(right.name),
  );
}

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

function numbers(value: unknown): number[] | undefined {
  const parsed = values(value)
    .map(Number)
    .filter((id) => Number.isSafeInteger(id) && id > 0);
  const unique = [...new Set(parsed)];
  return unique.length ? unique : undefined;
}
