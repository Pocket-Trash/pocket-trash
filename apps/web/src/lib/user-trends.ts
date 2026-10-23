import type {
  PublicCollectionItemTrends,
  PublicCollectionMakerProductTrends,
  PublicCollectionMaterialTrends,
  PublicUserCollectionItem,
} from "@package/services";
import type { CatalogTrendsSearch } from "@/lib/catalog-filters";

/** One exact personal collection-composition bucket. */
export type UserTrendValue = {
  /** Exact currently owned item count. */
  count: number;
  /** Stable bucket identifier. */
  id: number;
  /** Catalog destination for the bucket when the public aggregate exposes one. */
  productsHref?: string;
  /** User-visible catalog label. */
  label: string;
};

/** One privacy-safe community composition series. */
export type CommunityTrendSet = {
  /** Time the active aggregate generation completed. */
  generatedAt: Date;
  /** Whether at least one community bucket was privacy-suppressed. */
  hasSuppressedValues: boolean;
  /** Whether the active aggregate generation is older than its freshness target. */
  stale: boolean;
  /** Rounded community buckets safe to compare as percentages. */
  values: UserTrendValue[];
};

/** Public aggregate generations used for private composition comparisons. */
export type CommunityTrendsSource = {
  /** Active product-type generation. */
  collectionItems: PublicCollectionItemTrends | null;
  /** Active maker and product generation. */
  makerProducts: PublicCollectionMakerProductTrends | null;
  /** Active material generation. */
  materials: PublicCollectionMaterialTrends | null;
};

/** Localized fallback labels for community material buckets. */
export type CommunityMaterialLabels = {
  /** Label for items without a specific alloy or grade. */
  generalMaterial: string;
  /** Label for items without a general material. */
  unspecifiedMaterial: string;
};

/** Community series aligned to the active personal Trends filters. */
export type CommunityUserTrends = {
  /** Maker comparison, omitted when the active product filter is unsupported. */
  makers?: CommunityTrendSet | null;
  /** Material comparison. */
  materials: CommunityTrendSet | null;
  /** Product comparison. */
  products: CommunityTrendSet | null;
  /** Product-type comparison, omitted when narrower filters are unsupported. */
  productTypes?: CommunityTrendSet | null;
};

/** One personal/community percentage row. */
export type CompositionComparisonValue = UserTrendValue & {
  /** Percentage derived only from rounded public community values, or null when suppressed. */
  communityPercentage: number | null;
  /** Percentage within the user's matching personal items. */
  personalPercentage: number;
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
 * @template Item - Source value being grouped.
 */
interface UserTrendIdentifier<Item> {
  /**
   * Identifies one source item.
   *
   * @param item - Source item being grouped.
   * @returns Stable bucket identity and presentation.
   */
  (item: Item): Omit<UserTrendValue, "count">;
}

/**
 * Builds exact personal Trends from the same owned-item result used by My Collections.
 *
 * @param items - Current owner-scoped physical items.
 * @param collectionCount - Number of collections owned by the user.
 * @param search - Stable URL filters applied to composition charts.
 * @returns Exact totals and filtered composition buckets.
 */
export function summarizeUserTrends(
  items: PublicUserCollectionItem[],
  collectionCount: number,
  search: CatalogTrendsSearch,
): UserTrends {
  const scopedItems = items.filter(
    (item) =>
      (!search.productTypeId || item.productTypeId === search.productTypeId) &&
      ((!search.materialId && !search.materialSpecificId) ||
        item.materials.some(
          (material) =>
            (!search.materialId || material.id === search.materialId) &&
            (!search.materialSpecificId ||
              material.specific?.id === search.materialSpecificId),
        )) &&
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
      scopedItems.flatMap((item) =>
        item.materials.filter(
          (material) => !search.materialId || material.id === search.materialId,
        ),
      ),
      (material) => {
        const specific = search.materialId ? material.specific : null;
        return {
          id: specific?.id ?? material.id,
          label: specific?.name ?? material.name,
          productsHref: specific
            ? `/materials/${material.slug}/${specific.slug}`
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
 * Aligns public aggregate buckets to the personal Trends filter scope.
 *
 * @param source - Active thresholded and rounded public generations.
 * @param search - Stable personal Trends filters.
 * @param labels - Localized fallback material labels.
 * @returns Supported community comparison series.
 */
export function summarizeCommunityTrends(
  source: CommunityTrendsSource,
  search: CatalogTrendsSearch,
  labels: CommunityMaterialLabels,
): CommunityUserTrends {
  const { makerId, materialId, materialSpecificId, productId, productTypeId } =
    search;
  const productTypes =
    materialId || materialSpecificId || makerId || productId
      ? undefined
      : generation(
          source.collectionItems,
          source.collectionItems?.values
            .filter(
              (value) =>
                !productTypeId || value.productTypeId === productTypeId,
            )
            .map((value) => ({
              count: value.count,
              id: value.productTypeId,
              label: value.productTypeName,
            })) ?? [],
        );
  const materialValues =
    source.materials?.itemValues
      .filter(
        (value) =>
          value.productTypeId === (productTypeId ?? null) &&
          value.isSpecificBreakdown === Boolean(materialId) &&
          (materialSpecificId
            ? value.materialSpecificId === materialSpecificId
            : materialId
              ? value.materialId === materialId
              : value.materialSpecificId === null),
      )
      .map((value) => ({
        count: value.count,
        id: value.materialSpecificId ?? value.materialId ?? 0,
        label: materialId
          ? (value.materialSpecificName ?? labels.generalMaterial)
          : (value.materialName ?? labels.unspecifiedMaterial),
        productsHref: value.materialSlug
          ? value.materialSpecificSlug
            ? `/materials/${value.materialSlug}/${value.materialSpecificSlug}`
            : `/materials/${value.materialSlug}`
          : undefined,
      })) ?? [];
  /**
   * Tests whether a public maker or product bucket matches the aggregate scope.
   *
   * @param value - Thresholded maker or product bucket.
   * @returns Whether its supported filters match the current search.
   */
  const matchesMakerProductScope = (
    value: PublicCollectionMakerProductTrends["makerValues"][number],
  ) =>
    value.productTypeId === (productTypeId ?? null) &&
    value.materialId === (materialId ?? null) &&
    value.materialSpecificId === (materialSpecificId ?? null);
  const makerValues =
    source.makerProducts?.makerValues
      .filter(
        (value) =>
          matchesMakerProductScope(value) &&
          (!makerId || value.makerId === makerId),
      )
      .map((value) => ({
        count: value.itemCount,
        id: value.makerId,
        label: value.makerName,
        productsHref: `/products?maker=${value.makerId}&view=all`,
      })) ?? [];
  const productValues =
    source.makerProducts?.productValues
      .filter(
        (value) =>
          matchesMakerProductScope(value) &&
          (!makerId || value.makerId === makerId) &&
          (!productId || value.productId === productId),
      )
      .flatMap((value) =>
        value.productId === null || value.productName === null
          ? []
          : [
              {
                count: value.itemCount,
                id: value.productId,
                label: value.productName,
                productsHref:
                  value.productSlug && value.productTypeSlug
                    ? `/products/${value.productTypeSlug}/${value.productSlug}`
                    : undefined,
              },
            ],
      ) ?? [];

  return {
    makers: productId
      ? undefined
      : generation(source.makerProducts, makerValues),
    materials: generation(source.materials, materialValues),
    products: generation(source.makerProducts, productValues),
    productTypes,
  };
}

/**
 * Converts personal exact counts and rounded community counts into composition percentages.
 *
 * @param personal - Exact personal buckets in display order.
 * @param community - Rounded public buckets in display order.
 * @param hasSuppressedValues - Whether missing public buckets may be privacy-suppressed.
 * @returns Union of safe percentage rows without raw total comparison.
 */
export function compareComposition(
  personal: UserTrendValue[],
  community: UserTrendValue[],
  hasSuppressedValues: boolean,
): CompositionComparisonValue[] {
  const personalTotal = personal.reduce((sum, value) => sum + value.count, 0);
  const communityTotal = community.reduce((sum, value) => sum + value.count, 0);
  const personalById = new Map(personal.map((value) => [value.id, value]));
  const communityById = new Map(community.map((value) => [value.id, value]));
  const ids = [
    ...personal.map(({ id }) => id),
    ...community.filter(({ id }) => !personalById.has(id)).map(({ id }) => id),
  ];

  return ids.map((id) => {
    const personalValue = personalById.get(id);
    const communityValue = communityById.get(id);
    const value = personalValue ?? communityValue;
    if (!value) throw new Error("Composition comparison requires a bucket.");
    return {
      ...value,
      communityPercentage: communityValue
        ? percentage(communityValue.count, communityTotal)
        : hasSuppressedValues
          ? null
          : 0,
      personalPercentage: percentage(personalValue?.count ?? 0, personalTotal),
    };
  });
}

/**
 * Wraps mapped values with the source generation's privacy metadata.
 *
 * @param source - Active public aggregate generation.
 * @param values - Filtered safe values from that generation.
 * @returns Community series, or null when no generation is active.
 */
function generation(
  source:
    | PublicCollectionItemTrends
    | PublicCollectionMakerProductTrends
    | PublicCollectionMaterialTrends
    | null,
  values: UserTrendValue[],
): CommunityTrendSet | null {
  return source
    ? {
        generatedAt: source.generatedAt,
        hasSuppressedValues: source.hasSuppressedValues,
        stale: source.stale,
        values,
      }
    : null;
}

/**
 * Returns one finite percentage, including zero-total series.
 *
 * @param count - Bucket count.
 * @param total - Sum of counts in the same composition.
 * @returns Percentage from zero through 100.
 */
function percentage(count: number, total: number) {
  return total === 0 ? 0 : (count / total) * 100;
}

/**
 * Counts physical items without deduplicating repeated catalog products.
 *
 * @template Item - Source value being grouped.
 * @param items - Items in the active filter scope.
 * @param identify - Stable bucket identity and presentation.
 * @returns Count-descending buckets with stable label ordering for ties.
 */
function groupTrends<Item>(items: Item[], identify: UserTrendIdentifier<Item>) {
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
