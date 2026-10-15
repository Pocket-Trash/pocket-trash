import type { UserCollectionItem } from "@package/services";
import type { CatalogTrendsSearch } from "@/lib/catalog-filters";

/** One exact personal collection-composition bucket. */
export type UserTrendValue = {
  /** Exact currently owned item count. */
  count: number;
  /** Stable bucket identifier. */
  id: number;
  /** Catalog destination for the bucket. */
  productsHref: string;
  /** User-visible catalog label. */
  label: string;
};

/** Exact current-state composition of one user's collection. */
export type UserTrends = {
  /** Number of collections owned by the user, including empty collections. */
  collectionCount: number;
  /** Maker composition in the active filter scope. */
  makers: UserTrendValue[];
  /** Material composition in the active filter scope. */
  materials: UserTrendValue[];
  /** Exact number of currently owned physical items. */
  itemCount: number;
  /** Product composition in the active filter scope. */
  products: UserTrendValue[];
  /** Product-type composition in the active filter scope. */
  productTypes: UserTrendValue[];
};

/**
 * Resolves one personal Trends bucket.
 *
 * @param item - One scoped collection item.
 * @returns Stable bucket identity and presentation.
 */
type UserTrendIdentifier = (
  item: UserCollectionItem,
) => Omit<UserTrendValue, "count">;

/**
 * Builds exact personal Trends from the same owned-item result used by My Collections.
 *
 * @param items - Current owner-scoped physical items.
 * @param collectionCount - Number of collections owned by the user.
 * @param search - Stable URL filters applied to composition charts.
 * @returns Exact totals and filtered composition buckets.
 */
export function summarizeUserTrends(
  items: UserCollectionItem[],
  collectionCount: number,
  search: CatalogTrendsSearch,
): UserTrends {
  const scopedItems = items.filter(
    (item) =>
      (!search.productTypeId || item.productTypeId === search.productTypeId) &&
      (!search.materialId || item.material?.id === search.materialId) &&
      (!search.materialSpecificId ||
        item.material?.specific?.id === search.materialSpecificId) &&
      (!search.makerId || item.makerId === search.makerId) &&
      (!search.productId || item.productId === search.productId),
  );

  return {
    collectionCount,
    itemCount: items.length,
    makers: groupTrends(scopedItems, (item) => ({
      id: item.makerId,
      label: item.makerName,
      productsHref: `/products?maker=${item.makerId}&view=all`,
    })),
    materials: groupTrends(
      scopedItems.filter((item) => item.material !== null),
      (item) => {
        const material = item.material;
        if (!material) throw new Error("Material Trends require a material.");
        return {
          id: material.specific?.id ?? material.id,
          label: material.specific?.name ?? material.name,
          productsHref: material.specific
            ? `/materials/${material.slug}/${material.specific.slug}`
            : `/materials/${material.slug}`,
        };
      },
    ),
    products: groupTrends(scopedItems, (item) => ({
      id: item.productId,
      label: item.name,
      productsHref: `/products/${item.productTypeSlug}/${item.productSlug}`,
    })),
    productTypes: groupTrends(scopedItems, (item) => ({
      id: item.productTypeId,
      label: item.productTypeName,
      productsHref: `/products?type=${item.productTypeSlug}&view=all`,
    })),
  };
}

/**
 * Counts physical items without deduplicating repeated catalog products.
 *
 * @param items - Items in the active filter scope.
 * @param identify - Stable bucket identity and presentation.
 * @returns Count-descending buckets with stable label ordering for ties.
 */
function groupTrends(
  items: UserCollectionItem[],
  identify: UserTrendIdentifier,
) {
  const grouped = new Map<number, UserTrendValue>();
  for (const item of items) {
    const value = identify(item);
    const existing = grouped.get(value.id);
    grouped.set(value.id, { ...value, count: (existing?.count ?? 0) + 1 });
  }
  return [...grouped.values()].sort(
    (left, right) =>
      right.count - left.count || left.label.localeCompare(right.label),
  );
}
