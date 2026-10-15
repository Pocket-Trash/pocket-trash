import type { Database } from "@package/database";
import { schema } from "@package/database";
import { asc, desc, eq, sql } from "drizzle-orm";
import {
  PUBLIC_TRENDS_CONTRIBUTOR_THRESHOLD,
  PUBLIC_TRENDS_ROUNDING_INCREMENT,
  PUBLIC_TRENDS_STALE_MS,
} from "./constants.js";
import { getPublicPenRefillTrends as loadPublicPenRefillTrends } from "./pens.js";
import { getPublicSliderTrends as loadPublicSliderTrends } from "./slider.js";
import { getPublicSpinnerTrends as loadPublicSpinnerTrends } from "./spinner.js";

export {
  PUBLIC_TRENDS_CONTRIBUTOR_THRESHOLD,
  PUBLIC_TRENDS_ROUNDING_INCREMENT,
  PUBLIC_TRENDS_STALE_MS,
} from "./constants.js";
export type {
  PublicPenRefillTrends,
  PublicPenRefillTrendValue,
} from "./pens.js";
export type {
  PublicSliderTrend,
  PublicSliderTrends,
  PublicSliderTrendValue,
  SliderTrendMetricId,
} from "./slider.js";
export {
  SLIDER_TRENDS_COVERAGE_THRESHOLD,
  sliderTrendMetricIds,
} from "./slider.js";
export type {
  PublicSpinnerTrend,
  PublicSpinnerTrends,
  PublicSpinnerTrendValue,
  SpinnerTrendMetricId,
} from "./spinner.js";
export {
  SPINNER_TRENDS_COVERAGE_THRESHOLD,
  spinnerTrendMetricIds,
} from "./spinner.js";

/** Stable time ranges offered by recorded-activity Trends. */
export const activityTrendRanges = [
  "week",
  "30-days",
  "6-months",
  "year",
  "all",
] as const;

/** Stable time range offered by recorded-activity Trends. */
export type ActivityTrendRange = (typeof activityTrendRanges)[number];

/** One UTC activity bucket. Null collection counts are privacy-suppressed gaps. */
export type ActivityTrendPoint = {
  /** UTC start of this daily, weekly, or monthly bucket. */
  bucketStart: Date;
  /** Exact catalog records created in the bucket. */
  catalogCount: number;
  /** Rounded collection records created in the bucket, or null when suppressed. */
  collectionCount: number | null;
};

/** Recorded app-wide activity for one selected range. */
export type PublicActivityTrends = {
  /** Bucket size selected for the requested range. */
  granularity: "day" | "week" | "month";
  /** Stable selected range. */
  range: ActivityTrendRange;
  /** Chronological UTC activity buckets. */
  values: ActivityTrendPoint[];
};

/** Exact private collection activity for one selected range. */
export type UserActivityTrends = {
  /** Bucket size selected for the requested range. */
  granularity: PublicActivityTrends["granularity"];
  /** Stable selected range. */
  range: ActivityTrendRange;
  /** Chronological UTC collection-item creation buckets. */
  values: UserActivityTrendPoint[];
};

/** One exact private collection-item creation bucket. */
export type UserActivityTrendPoint = {
  /** UTC start of the bucket. */
  bucketStart: Date;
  /** Exact owner-scoped records created in the bucket. */
  count: number;
};

/** Exact private collection lifecycle history for one signed-in owner. */
export type UserCollectionHistoryTrends = {
  /** Acquisition dates entered by the owner. */
  exactDateCount: number;
  /** Acquisition dates imputed from Pocket Trash recording time. */
  imputedDateCount: number;
  /** Bucket size selected for the requested range. */
  granularity: PublicActivityTrends["granularity"];
  /** Stable selected range. */
  range: ActivityTrendRange;
  /** Chronological effective-date lifecycle buckets. */
  values: UserCollectionHistoryTrendPoint[];
};

/** One effective-date lifecycle bucket. */
export type UserCollectionHistoryTrendPoint = {
  /** Acquisitions effective in this bucket. */
  acquisitionCount: number;
  /** UTC start of the bucket. */
  bucketStart: Date;
  /** Collection size at the end of the bucket. */
  collectionCount: number;
  /** Departures effective in this bucket. */
  departureCount: number;
};

/**
 * Selects UTC boundaries and bucket size for one activity range.
 *
 * @param range - Stable range selected in URL state.
 * @param now - Current time used to anchor the range.
 * @returns Inclusive lower boundary and bucket granularity.
 */
export function getActivityTrendRange(
  range: ActivityTrendRange,
  now = new Date(),
): {
  /** Bucket size selected for the requested range. */
  granularity: PublicActivityTrends["granularity"];
  /** Inclusive UTC lower boundary, or null for all time. */
  start: Date | null;
} {
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  if (range === "week") start.setUTCDate(start.getUTCDate() - 6);
  if (range === "30-days") start.setUTCDate(start.getUTCDate() - 29);
  if (range === "6-months") shiftUtcMonths(start, -6);
  if (range === "year") shiftUtcMonths(start, -12);
  return {
    granularity:
      range === "week" || range === "30-days"
        ? "day"
        : range === "6-months"
          ? "week"
          : "month",
    start: range === "all" ? null : start,
  };
}

/**
 * Moves a UTC date by whole calendar months without overflowing short months.
 *
 * @param date - Mutable UTC date at a day boundary.
 * @param months - Signed number of months to move.
 */
function shiftUtcMonths(date: Date, months: number) {
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const daysInMonth = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
  ).getUTCDate();
  date.setUTCDate(Math.min(day, daysInMonth));
}

/** One privacy-safe collection-item count grouped by product type. */
export type PublicCollectionItemProductTypeTrend = {
  /** Distinct collector count rounded to the nearest five. */
  collectorCount: number;
  /** Count rounded to the nearest five. */
  count: number;
  /** Stable product-type identifier. */
  productTypeId: number;
  /** Product-type display name. */
  productTypeName: string;
};

/** Active public collection-item Trends generation. */
export type PublicCollectionItemTrends = {
  /** Time the active generation was completed. */
  generatedAt: Date;
  /** Whether the source contained categories below the privacy threshold. */
  hasSuppressedValues: boolean;
  /** Whether the active generation is older than the freshness target. */
  stale: boolean;
  /** Privacy-safe product-type counts. */
  values: PublicCollectionItemProductTypeTrend[];
};

/** One privacy-safe Parts and Accessories count grouped by product type. */
export type PublicPartAccessoryProductTypeTrend = {
  /** Count rounded to the nearest five. */
  count: number;
  /** Stable product-type identifier. */
  productTypeId: number;
  /** Product-type display name. */
  productTypeName: string;
};

/** Active public Parts and Accessories Trends generation. */
export type PublicPartAccessoryTrends = {
  /** Time the active generation was completed. */
  generatedAt: Date;
  /** Whether an enabled category was removed by the contributor threshold. */
  hasSuppressedValues: boolean;
  /** Whether the active generation is older than the freshness target. */
  stale: boolean;
  /** Privacy-safe enabled Parts and Accessories counts. */
  values: PublicPartAccessoryProductTypeTrend[];
};

/** One material bucket shared by exact catalog and privacy-safe collection Trends. */
export type PublicMaterialTrend = {
  /** Exact catalog-product count, or a rounded collection-derived count. */
  count: number;
  /** Whether this row is part of a selected material's specific breakdown. */
  isSpecificBreakdown: boolean;
  /** Stable general-material identifier, or null for Unspecified. */
  materialId: number | null;
  /** General-material display name, or null for Unspecified. */
  materialName: string | null;
  /** General-material URL slug, or null for Unspecified. */
  materialSlug: string | null;
  /** Stable alloy or grade identifier when this is a specific-material row. */
  materialSpecificId: number | null;
  /** Alloy or grade display name when this is a specific-material row. */
  materialSpecificName: string | null;
  /** Alloy or grade URL slug when this is a specific-material row. */
  materialSpecificSlug: string | null;
  /** Stable product-type filter, or null for the headline aggregate. */
  productTypeId: number | null;
};

/** Active privacy-safe collection material Trends generation. */
export type PublicCollectionMaterialTrends = {
  /** Time the active generation was completed. */
  generatedAt: Date;
  /** Whether at least one material bucket was privacy-suppressed. */
  hasSuppressedValues: boolean;
  /** Whether the active generation is older than the freshness target. */
  stale: boolean;
  /** Rounded distinct-collector counts by material. */
  collectorValues: PublicMaterialTrend[];
  /** Rounded currently-owned-item counts by material. */
  itemValues: PublicMaterialTrend[];
};

/** One privacy-safe maker or product result in a stable filter scope. */
export type PublicMakerProductTrend = {
  /** Distinct collector count rounded to the nearest five. */
  collectorCount: number;
  /** Currently owned item count rounded to the nearest five. */
  itemCount: number;
  /** Stable maker identifier. */
  makerId: number;
  /** Maker display name. */
  makerName: string;
  /** Maker URL slug. */
  makerSlug: string;
  /** Stable general-material filter, or null when unfiltered. */
  materialId: number | null;
  /** Stable specific-material filter, or null when unfiltered. */
  materialSpecificId: number | null;
  /** Stable product identifier, or null for a maker aggregate. */
  productId: number | null;
  /** Product display name, or null for a maker aggregate. */
  productName: string | null;
  /** Product URL slug, or null for a maker aggregate. */
  productSlug: string | null;
  /** Stable product-type filter, or null when unfiltered. */
  productTypeId: number | null;
  /** Product-type URL slug, or null when unfiltered. */
  productTypeSlug: string | null;
};

/** Active privacy-safe maker and product Trends generation. */
export type PublicCollectionMakerProductTrends = {
  /** Time the active generation was completed. */
  generatedAt: Date;
  /** Whether at least one maker or product result was privacy-suppressed. */
  hasSuppressedValues: boolean;
  /** Privacy-safe maker aggregates ordered by collector count. */
  makerValues: PublicMakerProductTrend[];
  /** Privacy-safe product results ordered by collector count. */
  productValues: PublicMakerProductTrend[];
  /** Whether the active generation is older than the freshness target. */
  stale: boolean;
};

/** Test-only lifecycle hook for forcing a refresh failure before activation. */
export type PublicTrendsRefreshHooks = {
  /**
   * Runs after transformed rows are inserted but before the generation swap.
   *
   * @returns Completion before activation continues.
   */
  beforeActivate?(): Promise<void>;
};

/** Public aggregate generation and read operations. */
export type TrendsService = ReturnType<typeof createTrendsService>;

/**
 * Creates privacy-safe public Trends operations.
 *
 * @param db - Application database.
 * @param hooks - Optional test hooks around atomic activation.
 * @returns Public Trends service.
 */
export function createTrendsService(
  db: Database,
  hooks: PublicTrendsRefreshHooks = {},
) {
  return {
    /**
     * Reads coverage-qualified Slider characteristics with privacy-safe item counts.
     *
     * @returns Public Slider Trends, or null when the Slider type is absent.
     * @rejects When a database query fails.
     */
    async getPublicSliderTrends() {
      return await loadPublicSliderTrends(db);
    },

    /**
     * Reads exact compatible Pen and standalone Refill counts by refill format.
     *
     * @returns Public Pens and Refills Trends, or null when either type is absent.
     * @rejects When a database query fails.
     */
    async getPublicPenRefillTrends() {
      return await loadPublicPenRefillTrends(db);
    },

    /**
     * Reads coverage-qualified Spinner characteristics with privacy-safe item counts.
     *
     * @returns Public Spinner Trends, or null when the Spinner type is absent.
     * @rejects When a database query fails.
     */
    async getPublicSpinnerTrends() {
      return await loadPublicSpinnerTrends(db);
    },

    /**
     * Reads exact catalog and privacy-safe collection record creation activity.
     *
     * @param range - Stable selected time range.
     * @param now - Current time used to anchor the UTC boundary.
     * @returns App-wide activity with suppressed collection points represented as gaps.
     */
    async getPublicActivityTrends(
      range: ActivityTrendRange,
      now = new Date(),
    ): Promise<PublicActivityTrends> {
      const { granularity, start } = getActivityTrendRange(range, now);
      const result = await db.execute<{
        /** UTC start of the activity bucket. */
        bucketStart: Date | string;
        /** Exact catalog record count. */
        catalogCount: number | string;
        /** Rounded public collection count, or null when suppressed. */
        collectionCount: number | string | null;
      }>(sql`
        with catalog_activity as (
          select
            date_trunc(${granularity}, product.created_at at time zone 'UTC') at time zone 'UTC' as bucket_start,
            count(*)::integer as catalog_count
          from product
          inner join product_types on product_types.id = product.product_type_id
          where product.approval_status = 'approved'
            and not product.is_private
            and (not product_types.is_part_or_accessory or product_types.include_in_trends)
            ${start ? sql`and product.created_at >= ${start}` : sql``}
            and product.created_at <= ${now}
          group by bucket_start
        ), collection_activity as (
          select
            date_trunc(${granularity}, collection_item.created_at at time zone 'UTC') at time zone 'UTC' as bucket_start,
            count(distinct collection_item.owner_id)::integer as contributor_count,
            count(*)::integer as item_count
          from collection_item
          where ${start ? sql`collection_item.created_at >= ${start} and` : sql``}
            collection_item.created_at <= ${now}
          group by bucket_start
        )
        select
          coalesce(catalog_activity.bucket_start, collection_activity.bucket_start) as "bucketStart",
          coalesce(catalog_activity.catalog_count, 0)::integer as "catalogCount",
          case
            when collection_activity.contributor_count >= ${PUBLIC_TRENDS_CONTRIBUTOR_THRESHOLD}
              then round(collection_activity.item_count::numeric / ${PUBLIC_TRENDS_ROUNDING_INCREMENT})::integer * ${PUBLIC_TRENDS_ROUNDING_INCREMENT}
            else null
          end as "collectionCount"
        from catalog_activity
        full outer join collection_activity using (bucket_start)
        order by "bucketStart"
      `);
      return {
        granularity,
        range,
        values: result.rows.map((row) => ({
          bucketStart:
            row.bucketStart instanceof Date
              ? row.bucketStart
              : new Date(row.bucketStart),
          catalogCount: Number(row.catalogCount),
          collectionCount:
            row.collectionCount === null ? null : Number(row.collectionCount),
        })),
      };
    },

    /**
     * Reads exact collection-item creation activity for one signed-in owner.
     *
     * @param actorClerkId - Authenticated owner Clerk identifier.
     * @param range - Stable selected time range.
     * @param now - Current time used to anchor the UTC boundary.
     * @returns Exact private activity without public suppression.
     */
    async getUserActivityTrends(
      actorClerkId: string,
      range: ActivityTrendRange,
      now = new Date(),
    ): Promise<UserActivityTrends> {
      const { granularity, start } = getActivityTrendRange(range, now);
      const result = await db.execute<{
        /** UTC start of the activity bucket. */
        bucketStart: Date | string;
        /** Exact owner-scoped collection record count. */
        count: number | string;
      }>(sql`
        select
          date_trunc(${granularity}, collection_item.created_at at time zone 'UTC') at time zone 'UTC' as "bucketStart",
          count(*)::integer as count
        from collection_item
        inner join users on users.id = collection_item.owner_id
        where users.clerk_id = ${actorClerkId}
          ${start ? sql`and collection_item.created_at >= ${start}` : sql``}
          and collection_item.created_at <= ${now}
        group by "bucketStart"
        order by "bucketStart"
      `);
      return {
        granularity,
        range,
        values: result.rows.map((row) => ({
          bucketStart:
            row.bucketStart instanceof Date
              ? row.bucketStart
              : new Date(row.bucketStart),
          count: Number(row.count),
        })),
      };
    },

    /**
     * Reads exact effective-date collection history for one signed-in owner.
     *
     * @param actorClerkId - Authenticated owner Clerk identifier.
     * @param range - Stable selected time range.
     * @param now - Current time used to anchor the UTC boundary.
     * @returns Exact collection size, acquisitions, departures, and date completeness.
     */
    async getUserCollectionHistoryTrends(
      actorClerkId: string,
      range: ActivityTrendRange,
      now = new Date(),
    ): Promise<UserCollectionHistoryTrends> {
      const { granularity, start } = getActivityTrendRange(range, now);
      const interval =
        granularity === "day"
          ? sql`interval '1 day'`
          : granularity === "week"
            ? sql`interval '1 week'`
            : sql`interval '1 month'`;
      const [result, [completeness]] = await Promise.all([
        db.execute<{
          /** Acquisitions effective in the bucket. */
          acquisitionCount: number | string;
          /** UTC start of the bucket. */
          bucketStart: Date | string;
          /** Collection size at the bucket cutoff. */
          collectionCount: number | string;
          /** Departures effective in the bucket. */
          departureCount: number | string;
        }>(sql`
          with periods as (
            select
              collection_item_ownership_period.effective_start_date,
              collection_item_ownership_period.effective_end_date
            from collection_item_ownership_period
            inner join collection_item on collection_item.id = collection_item_ownership_period.collection_item_id
            inner join users on users.id = collection_item.owner_id
            where users.clerk_id = ${actorClerkId}
          ), bounds as (
            select coalesce(
              ${start ? sql`${start}::timestamp` : sql`null::timestamp`},
              min(effective_start_date)::timestamp
            ) as lower_bound
            from periods
          ), buckets as (
            select generate_series(
              date_trunc(${granularity}, lower_bound),
              date_trunc(${granularity}, ${now}::timestamp),
              ${interval}
            ) as bucket_start
            from bounds
            where lower_bound is not null
          )
          select
            buckets.bucket_start at time zone 'UTC' as "bucketStart",
            count(*) filter (
              where periods.effective_start_date >= greatest(
                  buckets.bucket_start::date,
                  ${start ? sql`${start}::date` : sql`buckets.bucket_start::date`}
                )
                and periods.effective_start_date < least(
                  (buckets.bucket_start + ${interval})::date,
                  ${now}::date + 1
                )
            )::integer as "acquisitionCount",
            count(*) filter (
              where periods.effective_end_date >= greatest(
                  buckets.bucket_start::date,
                  ${start ? sql`${start}::date` : sql`buckets.bucket_start::date`}
                )
                and periods.effective_end_date < least(
                  (buckets.bucket_start + ${interval})::date,
                  ${now}::date + 1
                )
            )::integer as "departureCount",
            count(*) filter (
              where periods.effective_start_date < least(
                  (buckets.bucket_start + ${interval})::date,
                  ${now}::date + 1
                )
                and (
                  periods.effective_end_date is null
                  or periods.effective_end_date >= least(
                    (buckets.bucket_start + ${interval})::date,
                    ${now}::date + 1
                  )
                )
            )::integer as "collectionCount"
          from buckets
          left join periods on true
          group by buckets.bucket_start
          order by buckets.bucket_start
        `),
        db
          .select({
            exactDateCount: sql<number>`count(*) filter (where not ${schema.collectionItemOwnershipPeriod.startDateImputed})::integer`,
            imputedDateCount: sql<number>`count(*) filter (where ${schema.collectionItemOwnershipPeriod.startDateImputed})::integer`,
          })
          .from(schema.collectionItemOwnershipPeriod)
          .innerJoin(
            schema.collectionItem,
            eq(
              schema.collectionItem.id,
              schema.collectionItemOwnershipPeriod.collectionItemId,
            ),
          )
          .innerJoin(
            schema.user,
            eq(schema.user.id, schema.collectionItem.ownerId),
          )
          .where(eq(schema.user.clerkId, actorClerkId)),
      ]);
      return {
        exactDateCount: Number(completeness?.exactDateCount ?? 0),
        granularity,
        imputedDateCount: Number(completeness?.imputedDateCount ?? 0),
        range,
        values: result.rows.map((row) => ({
          acquisitionCount: Number(row.acquisitionCount),
          bucketStart:
            row.bucketStart instanceof Date
              ? row.bucketStart
              : new Date(row.bucketStart),
          collectionCount: Number(row.collectionCount),
          departureCount: Number(row.departureCount),
        })),
      };
    },

    /**
     * Reads privacy-safe maker and product popularity from the active generation.
     *
     * @param now - Current time used to calculate freshness.
     * @returns Active maker and product generation, or null before the first refresh.
     * @rejects When the database query fails.
     */
    async getPublicCollectionMakerProductTrends(
      now = new Date(),
    ): Promise<PublicCollectionMakerProductTrends | null> {
      const [generation] = await db
        .select()
        .from(schema.publicTrendsGeneration)
        .where(eq(schema.publicTrendsGeneration.active, true))
        .limit(1);
      if (!generation) return null;

      const values = await db
        .select({
          collectorCount:
            schema.publicCollectionMakerProductTrend.roundedCollectorCount,
          itemCount: schema.publicCollectionMakerProductTrend.roundedItemCount,
          makerId: schema.publicCollectionMakerProductTrend.makerId,
          makerName: schema.maker.name,
          makerSlug: schema.maker.slug,
          materialId: schema.publicCollectionMakerProductTrend.materialId,
          materialSpecificId:
            schema.publicCollectionMakerProductTrend.materialSpecificId,
          productId: schema.publicCollectionMakerProductTrend.productId,
          productName: schema.product.name,
          productSlug: schema.product.slug,
          productTypeId: schema.publicCollectionMakerProductTrend.productTypeId,
          productTypeSlug: sql<string | null>`coalesce(
            (select product_types.slug from product_types where product_types.id = ${schema.product.productTypeId}),
            (select product_types.slug from product_types where product_types.id = ${schema.publicCollectionMakerProductTrend.productTypeId})
          )`,
        })
        .from(schema.publicCollectionMakerProductTrend)
        .innerJoin(
          schema.maker,
          eq(schema.publicCollectionMakerProductTrend.makerId, schema.maker.id),
        )
        .leftJoin(
          schema.product,
          eq(
            schema.publicCollectionMakerProductTrend.productId,
            schema.product.id,
          ),
        )
        .where(
          eq(
            schema.publicCollectionMakerProductTrend.generationId,
            generation.id,
          ),
        )
        .orderBy(
          desc(schema.publicCollectionMakerProductTrend.roundedCollectorCount),
          desc(schema.publicCollectionMakerProductTrend.roundedItemCount),
          asc(schema.maker.name),
          asc(schema.product.name),
        );
      return {
        generatedAt: generation.generatedAt,
        hasSuppressedValues: generation.hasSuppressedMakerProductValues,
        makerValues: values.filter(({ productId }) => productId === null),
        productValues: values.filter(({ productId }) => productId !== null),
        stale:
          now.getTime() - generation.generatedAt.getTime() >
          PUBLIC_TRENDS_STALE_MS,
      };
    },

    /**
     * Lists exact approved public catalog-product material counts.
     *
     * Headline rows have no product type; filtered rows retain its stable ID.
     * Products with several materials contribute once to every applicable bar.
     *
     * @returns Exact catalog-product material counts.
     * @rejects When the database query fails.
     */
    async getPublicCatalogMaterialTrends(): Promise<PublicMaterialTrend[]> {
      const result = await db.execute<{
        /** Exact product count. */
        count: number | string;
        /** Whether this is a specific-material breakdown row. */
        isSpecificBreakdown: boolean;
        /** General-material identifier. */
        materialId: number | string | null;
        /** General-material display name. */
        materialName: string | null;
        /** General-material URL slug. */
        materialSlug: string | null;
        /** Specific-material identifier. */
        materialSpecificId: number | string | null;
        /** Specific-material display name. */
        materialSpecificName: string | null;
        /** Specific-material URL slug. */
        materialSpecificSlug: string | null;
        /** Product-type identifier, null for headline rows. */
        productTypeId: number | string | null;
      }>(sql`
        with eligible_products as (
          select
            product.id,
            product.product_type_id,
            product_types.is_part_or_accessory,
            product_material_component.material_id,
            product_material_component.material_specific_id
          from product
          inner join product_types on product_types.id = product.product_type_id
          left join product_material on product_material.product_id = product.id
          left join product_material_component
            on product_material_component.product_material_id = product_material.id
          where product.approval_status = 'approved'
            and not product.is_private
            and (
              not product_types.is_part_or_accessory
              or product_types.include_in_trends
            )
        ), scoped_products as (
          select id, null::bigint as product_type_id, material_id, material_specific_id
          from eligible_products
          where not is_part_or_accessory
          union all
          select id, product_type_id, material_id, material_specific_id
          from eligible_products
        )
        select
          count(distinct scoped_products.id)::integer as count,
          grouping(scoped_products.material_specific_id) = 0 as "isSpecificBreakdown",
          scoped_products.material_id as "materialId",
          materials.name as "materialName",
          materials.slug as "materialSlug",
          scoped_products.material_specific_id as "materialSpecificId",
          material_specific.name as "materialSpecificName",
          material_specific.slug as "materialSpecificSlug",
          scoped_products.product_type_id as "productTypeId"
        from scoped_products
        left join materials on materials.id = scoped_products.material_id
        left join material_specific on material_specific.id = scoped_products.material_specific_id
        group by grouping sets (
          (scoped_products.product_type_id, scoped_products.material_id, materials.name, materials.slug),
          (scoped_products.product_type_id, scoped_products.material_id, materials.name, materials.slug, scoped_products.material_specific_id, material_specific.name, material_specific.slug)
        )
        order by count desc, materials.name asc nulls last, material_specific.name asc nulls first
      `);
      return result.rows.map((row) => ({
        count: Number(row.count),
        isSpecificBreakdown: row.isSpecificBreakdown,
        materialId: row.materialId === null ? null : Number(row.materialId),
        materialName: row.materialName,
        materialSlug: row.materialSlug,
        materialSpecificId:
          row.materialSpecificId === null
            ? null
            : Number(row.materialSpecificId),
        materialSpecificName: row.materialSpecificName,
        materialSpecificSlug: row.materialSpecificSlug,
        productTypeId:
          row.productTypeId === null ? null : Number(row.productTypeId),
      }));
    },

    /**
     * Reads privacy-safe item and collector material counts from the active generation.
     *
     * @param now - Current time used to calculate freshness.
     * @returns Active material generation, or null before the first refresh.
     * @rejects When the database query fails.
     */
    async getPublicCollectionMaterialTrends(
      now = new Date(),
    ): Promise<PublicCollectionMaterialTrends | null> {
      const [generation] = await db
        .select()
        .from(schema.publicTrendsGeneration)
        .where(eq(schema.publicTrendsGeneration.active, true))
        .limit(1);
      if (!generation) return null;

      const rows = await db
        .select({
          collectorCount:
            schema.publicCollectionItemMaterialTrend.roundedCollectorCount,
          itemCount: schema.publicCollectionItemMaterialTrend.roundedItemCount,
          isSpecificBreakdown:
            schema.publicCollectionItemMaterialTrend.isSpecificBreakdown,
          materialId: schema.publicCollectionItemMaterialTrend.materialId,
          materialName: schema.material.name,
          materialSlug: schema.material.slug,
          materialSpecificId:
            schema.publicCollectionItemMaterialTrend.materialSpecificId,
          materialSpecificName: schema.materialSpecific.name,
          materialSpecificSlug: schema.materialSpecific.slug,
          productTypeId: schema.publicCollectionItemMaterialTrend.productTypeId,
        })
        .from(schema.publicCollectionItemMaterialTrend)
        .leftJoin(
          schema.material,
          eq(
            schema.publicCollectionItemMaterialTrend.materialId,
            schema.material.id,
          ),
        )
        .leftJoin(
          schema.materialSpecific,
          eq(
            schema.publicCollectionItemMaterialTrend.materialSpecificId,
            schema.materialSpecific.id,
          ),
        )
        .where(
          eq(
            schema.publicCollectionItemMaterialTrend.generationId,
            generation.id,
          ),
        );
      return {
        collectorValues: rows.map((row) => ({
          count: row.collectorCount,
          isSpecificBreakdown: row.isSpecificBreakdown,
          materialId: row.materialId,
          materialName: row.materialName,
          materialSlug: row.materialSlug,
          materialSpecificId: row.materialSpecificId,
          materialSpecificName: row.materialSpecificName,
          materialSpecificSlug: row.materialSpecificSlug,
          productTypeId: row.productTypeId,
        })),
        generatedAt: generation.generatedAt,
        hasSuppressedValues: generation.hasSuppressedMaterialValues,
        itemValues: rows.map((row) => ({
          count: row.itemCount,
          isSpecificBreakdown: row.isSpecificBreakdown,
          materialId: row.materialId,
          materialName: row.materialName,
          materialSlug: row.materialSlug,
          materialSpecificId: row.materialSpecificId,
          materialSpecificName: row.materialSpecificName,
          materialSpecificSlug: row.materialSpecificSlug,
          productTypeId: row.productTypeId,
        })),
        stale:
          now.getTime() - generation.generatedAt.getTime() >
          PUBLIC_TRENDS_STALE_MS,
      };
    },

    /**
     * Reads enabled Parts and Accessories from the active public generation.
     *
     * @param now - Current time used to calculate freshness.
     * @returns Active generation, or `null` before the first successful refresh.
     * @rejects When the database query fails.
     */
    async getPublicPartAccessoryTrends(
      now = new Date(),
    ): Promise<PublicPartAccessoryTrends | null> {
      const [generation] = await db
        .select()
        .from(schema.publicTrendsGeneration)
        .where(eq(schema.publicTrendsGeneration.active, true))
        .limit(1);
      if (!generation) return null;

      const values = await db
        .select({
          count: schema.publicPartAccessoryProductTypeTrend.roundedItemCount,
          productTypeId:
            schema.publicPartAccessoryProductTypeTrend.productTypeId,
          productTypeName: schema.productType.name,
        })
        .from(schema.publicPartAccessoryProductTypeTrend)
        .innerJoin(
          schema.productType,
          eq(
            schema.publicPartAccessoryProductTypeTrend.productTypeId,
            schema.productType.id,
          ),
        )
        .where(
          eq(
            schema.publicPartAccessoryProductTypeTrend.generationId,
            generation.id,
          ),
        )
        .orderBy(
          desc(schema.publicPartAccessoryProductTypeTrend.roundedItemCount),
          asc(schema.productType.name),
        );

      return {
        generatedAt: generation.generatedAt,
        hasSuppressedValues: generation.hasSuppressedPartAccessoryValues,
        stale:
          now.getTime() - generation.generatedAt.getTime() >
          PUBLIC_TRENDS_STALE_MS,
        values,
      };
    },

    /**
     * Reads the active privacy-safe collection-item generation.
     *
     * @param now - Current time used to calculate freshness.
     * @returns Active generation, or `null` before the first successful refresh.
     * @rejects When the database query fails.
     */
    async getPublicCollectionItemTrends(
      now = new Date(),
    ): Promise<PublicCollectionItemTrends | null> {
      const [generation] = await db
        .select()
        .from(schema.publicTrendsGeneration)
        .where(eq(schema.publicTrendsGeneration.active, true))
        .limit(1);
      if (!generation) return null;

      const values = await db
        .select({
          collectorCount:
            schema.publicCollectionItemProductTypeTrend.roundedCollectorCount,
          count: schema.publicCollectionItemProductTypeTrend.roundedItemCount,
          productTypeId:
            schema.publicCollectionItemProductTypeTrend.productTypeId,
          productTypeName: schema.productType.name,
        })
        .from(schema.publicCollectionItemProductTypeTrend)
        .innerJoin(
          schema.productType,
          eq(
            schema.publicCollectionItemProductTypeTrend.productTypeId,
            schema.productType.id,
          ),
        )
        .where(
          eq(
            schema.publicCollectionItemProductTypeTrend.generationId,
            generation.id,
          ),
        )
        .orderBy(
          desc(schema.publicCollectionItemProductTypeTrend.roundedItemCount),
          asc(schema.productType.name),
        );

      return {
        generatedAt: generation.generatedAt,
        hasSuppressedValues: generation.hasSuppressedValues,
        stale:
          now.getTime() - generation.generatedAt.getTime() >
          PUBLIC_TRENDS_STALE_MS,
        values,
      };
    },

    /**
     * Rebuilds and atomically activates the public collection-item generation.
     * Exact and suppressed collection values exist only inside this transaction.
     *
     * @param generatedAt - Completion timestamp stored with the generation.
     * @returns Newly active privacy-safe generation.
     * @rejects When aggregation or the atomic generation swap fails.
     */
    async refreshPublicCollectionItemTrends(
      generatedAt = new Date(),
    ): Promise<PublicCollectionItemTrends> {
      await db.transaction(async (tx) => {
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtextextended('public-collection-item-trends', 0))`,
        );
        const sourceResult = await tx.execute<{
          /** Exact contributor count used only inside the refresh transaction. */
          contributorCount: number | string;
          /** Exact item count used only inside the refresh transaction. */
          itemCount: number | string;
          /** Whether the product type belongs in Parts and Accessories. */
          isPartOrAccessory: boolean;
          /** Stable product-type identifier. */
          productTypeId: number | string;
        }>(sql`
          with item_products as (
            select id as collection_item_id, product_pen_id as product_id from collection_detail_pen
            union all select id, product_pen_clip_id from collection_detail_pen_clip
            union all select id, product_pen_tip_id from collection_detail_pen_tip
            union all select id, product_pen_top_cap_id from collection_detail_pen_top_cap
            union all select id, product_pen_mechanism_id from collection_detail_pen_mechanism
            union all select id, product_pen_actuator_id from collection_detail_pen_actuator
            union all select id, product_spinner_id from collection_detail_spinner
            union all select id, product_spinner_button_id from collection_detail_spinner_button
            union all select id, product_slider_id from collection_detail_slider
            union all select id, product_slider_plate_id from collection_detail_slider_plate
            union all select id, product_slider_insert_id from collection_detail_slider_insert
          )
          select
            count(distinct collection_item.owner_id)::integer as "contributorCount",
            count(distinct collection_item.id)::integer as "itemCount",
            product_types.is_part_or_accessory as "isPartOrAccessory",
            product_types.id as "productTypeId"
          from item_products
          inner join collection_item on collection_item.id = item_products.collection_item_id
          inner join product on product.id = item_products.product_id
          inner join product_types on product_types.id = product.product_type_id
          where collection_item.owned
            and collection_item.sold_at is null
            and (
              not product_types.is_part_or_accessory
              or product_types.include_in_trends
            )
          group by product_types.id, product_types.is_part_or_accessory
        `);
        const source = sourceResult.rows.map((row) => ({
          contributorCount: Number(row.contributorCount),
          itemCount: Number(row.itemCount),
          isPartOrAccessory: row.isPartOrAccessory,
          productTypeId: Number(row.productTypeId),
        }));
        const primarySource = source.filter(
          ({ isPartOrAccessory }) => !isPartOrAccessory,
        );
        const partAccessorySource = source.filter(
          ({ isPartOrAccessory }) => isPartOrAccessory,
        );
        const publishable = primarySource.filter(
          ({ contributorCount }) =>
            contributorCount >= PUBLIC_TRENDS_CONTRIBUTOR_THRESHOLD,
        );
        const publishablePartAccessories = partAccessorySource.filter(
          ({ contributorCount }) =>
            contributorCount >= PUBLIC_TRENDS_CONTRIBUTOR_THRESHOLD,
        );
        const materialResult = await tx.execute<{
          /** Exact contributor count used only inside the refresh transaction. */
          contributorCount: number | string;
          /** Exact item count used only inside the refresh transaction. */
          itemCount: number | string;
          /** Whether this is a specific-material breakdown row. */
          isSpecificBreakdown: boolean;
          /** General-material identifier, null for Unspecified. */
          materialId: number | string | null;
          /** Specific-material identifier when assigned. */
          materialSpecificId: number | string | null;
          /** Product-type identifier, null for headline rows. */
          productTypeId: number | string | null;
        }>(sql`
          with item_products as (
            select id as collection_item_id, product_pen_id as product_id from collection_detail_pen
            union all select id, product_pen_clip_id from collection_detail_pen_clip
            union all select id, product_pen_tip_id from collection_detail_pen_tip
            union all select id, product_pen_top_cap_id from collection_detail_pen_top_cap
            union all select id, product_pen_mechanism_id from collection_detail_pen_mechanism
            union all select id, product_pen_actuator_id from collection_detail_pen_actuator
            union all select id, product_spinner_id from collection_detail_spinner
            union all select id, product_spinner_button_id from collection_detail_spinner_button
            union all select id, product_slider_id from collection_detail_slider
            union all select id, product_slider_plate_id from collection_detail_slider_plate
            union all select id, product_slider_insert_id from collection_detail_slider_insert
          ), eligible_items as (
            select
              collection_item.id,
              collection_item.owner_id,
              product.product_type_id,
              product_types.is_part_or_accessory,
              collection_item_material.material_id,
              collection_item_material.material_specific_id
            from item_products
            inner join collection_item on collection_item.id = item_products.collection_item_id
            inner join product on product.id = item_products.product_id
            inner join product_types on product_types.id = product.product_type_id
            left join collection_item_material
              on collection_item_material.collection_item_id = collection_item.id
            where collection_item.owned
              and collection_item.sold_at is null
              and (
                not product_types.is_part_or_accessory
                or product_types.include_in_trends
              )
          ), scoped_items as (
            select id, owner_id, null::bigint as product_type_id, material_id, material_specific_id
            from eligible_items
            where not is_part_or_accessory
            union all
            select id, owner_id, product_type_id, material_id, material_specific_id
            from eligible_items
          )
          select
            count(distinct scoped_items.owner_id)::integer as "contributorCount",
            count(distinct scoped_items.id)::integer as "itemCount",
            grouping(scoped_items.material_specific_id) = 0 as "isSpecificBreakdown",
            scoped_items.material_id as "materialId",
            scoped_items.material_specific_id as "materialSpecificId",
            scoped_items.product_type_id as "productTypeId"
          from scoped_items
          group by grouping sets (
            (scoped_items.product_type_id, scoped_items.material_id),
            (scoped_items.product_type_id, scoped_items.material_id, scoped_items.material_specific_id)
          )
        `);
        const materialSource = materialResult.rows.map((row) => ({
          contributorCount: Number(row.contributorCount),
          isSpecificBreakdown: row.isSpecificBreakdown,
          itemCount: Number(row.itemCount),
          materialId: row.materialId === null ? null : Number(row.materialId),
          materialSpecificId:
            row.materialSpecificId === null
              ? null
              : Number(row.materialSpecificId),
          productTypeId:
            row.productTypeId === null ? null : Number(row.productTypeId),
        }));
        const publishableMaterials = materialSource.filter(
          ({ contributorCount }) =>
            contributorCount >= PUBLIC_TRENDS_CONTRIBUTOR_THRESHOLD,
        );
        const makerProductResult = await tx.execute<{
          /** Exact contributor count used only inside the refresh transaction. */
          contributorCount: number | string;
          /** Exact item count used only inside the refresh transaction. */
          itemCount: number | string;
          /** Stable maker identifier. */
          makerId: number | string;
          /** Stable general-material filter. */
          materialId: number | string | null;
          /** Stable specific-material filter. */
          materialSpecificId: number | string | null;
          /** Stable product identifier, null for maker aggregates. */
          productId: number | string | null;
          /** Stable product-type filter. */
          productTypeId: number | string | null;
        }>(sql`
          with item_products as (
            select id as collection_item_id, product_pen_id as product_id from collection_detail_pen
            union all select id, product_pen_clip_id from collection_detail_pen_clip
            union all select id, product_pen_tip_id from collection_detail_pen_tip
            union all select id, product_pen_top_cap_id from collection_detail_pen_top_cap
            union all select id, product_pen_mechanism_id from collection_detail_pen_mechanism
            union all select id, product_pen_actuator_id from collection_detail_pen_actuator
            union all select id, product_spinner_id from collection_detail_spinner
            union all select id, product_spinner_button_id from collection_detail_spinner_button
            union all select id, product_slider_id from collection_detail_slider
            union all select id, product_slider_plate_id from collection_detail_slider_plate
            union all select id, product_slider_insert_id from collection_detail_slider_insert
          ), eligible_items as (
            select distinct
              collection_item.id,
              collection_item.owner_id,
              product.id as product_id,
              product.maker_id,
              product.product_type_id,
              collection_item_material.material_id,
              collection_item_material.material_specific_id
            from item_products
            inner join collection_item on collection_item.id = item_products.collection_item_id
            inner join product on product.id = item_products.product_id
            inner join product_types on product_types.id = product.product_type_id
            left join collection_item_material
              on collection_item_material.collection_item_id = collection_item.id
            where collection_item.owned
              and collection_item.sold_at is null
              and (
                not product_types.is_part_or_accessory
                or product_types.include_in_trends
              )
          ), scoped_items as (
            select id, owner_id, product_id, maker_id, null::bigint as product_type_id, null::bigint as material_id, null::bigint as material_specific_id from eligible_items
            union select id, owner_id, product_id, maker_id, product_type_id, null, null from eligible_items
            union select id, owner_id, product_id, maker_id, null, material_id, null from eligible_items where material_id is not null
            union select id, owner_id, product_id, maker_id, product_type_id, material_id, null from eligible_items where material_id is not null
            union select id, owner_id, product_id, maker_id, null, material_id, material_specific_id from eligible_items where material_specific_id is not null
            union select id, owner_id, product_id, maker_id, product_type_id, material_id, material_specific_id from eligible_items where material_specific_id is not null
          ), entity_items as (
            select id, owner_id, product_type_id, material_id, material_specific_id, maker_id, null::bigint as product_id from scoped_items
            union all
            select id, owner_id, product_type_id, material_id, material_specific_id, maker_id, product_id from scoped_items
          )
          select
            count(distinct owner_id)::integer as "contributorCount",
            count(distinct id)::integer as "itemCount",
            maker_id as "makerId",
            material_id as "materialId",
            material_specific_id as "materialSpecificId",
            product_id as "productId",
            product_type_id as "productTypeId"
          from entity_items
          group by product_type_id, material_id, material_specific_id, maker_id, product_id
        `);
        const makerProductSource = makerProductResult.rows.map((row) => ({
          contributorCount: Number(row.contributorCount),
          itemCount: Number(row.itemCount),
          makerId: Number(row.makerId),
          materialId: row.materialId === null ? null : Number(row.materialId),
          materialSpecificId:
            row.materialSpecificId === null
              ? null
              : Number(row.materialSpecificId),
          productId: row.productId === null ? null : Number(row.productId),
          productTypeId:
            row.productTypeId === null ? null : Number(row.productTypeId),
        }));
        const publishableMakerProducts = makerProductSource.filter(
          ({ contributorCount }) =>
            contributorCount >= PUBLIC_TRENDS_CONTRIBUTOR_THRESHOLD,
        );
        const [generation] = await tx
          .insert(schema.publicTrendsGeneration)
          .values({
            generatedAt,
            hasSuppressedPartAccessoryValues:
              publishablePartAccessories.length < partAccessorySource.length,
            hasSuppressedMaterialValues:
              publishableMaterials.length < materialSource.length,
            hasSuppressedMakerProductValues:
              publishableMakerProducts.length < makerProductSource.length,
            hasSuppressedValues: publishable.length < primarySource.length,
          })
          .returning({ id: schema.publicTrendsGeneration.id });
        if (!generation) throw new Error("Failed to create Trends generation.");
        if (publishable.length > 0) {
          await tx.insert(schema.publicCollectionItemProductTypeTrend).values(
            publishable.map((row) => ({
              generationId: generation.id,
              productTypeId: row.productTypeId,
              roundedItemCount:
                Math.round(row.itemCount / PUBLIC_TRENDS_ROUNDING_INCREMENT) *
                PUBLIC_TRENDS_ROUNDING_INCREMENT,
              roundedCollectorCount:
                Math.round(
                  row.contributorCount / PUBLIC_TRENDS_ROUNDING_INCREMENT,
                ) * PUBLIC_TRENDS_ROUNDING_INCREMENT,
            })),
          );
        }
        if (publishablePartAccessories.length > 0) {
          await tx.insert(schema.publicPartAccessoryProductTypeTrend).values(
            publishablePartAccessories.map((row) => ({
              generationId: generation.id,
              productTypeId: row.productTypeId,
              roundedItemCount:
                Math.round(row.itemCount / PUBLIC_TRENDS_ROUNDING_INCREMENT) *
                PUBLIC_TRENDS_ROUNDING_INCREMENT,
            })),
          );
        }
        if (publishableMaterials.length > 0) {
          await tx.insert(schema.publicCollectionItemMaterialTrend).values(
            publishableMaterials.map((row) => ({
              generationId: generation.id,
              isSpecificBreakdown: row.isSpecificBreakdown,
              materialId: row.materialId,
              materialSpecificId: row.materialSpecificId,
              productTypeId: row.productTypeId,
              roundedCollectorCount:
                Math.round(
                  row.contributorCount / PUBLIC_TRENDS_ROUNDING_INCREMENT,
                ) * PUBLIC_TRENDS_ROUNDING_INCREMENT,
              roundedItemCount:
                Math.round(row.itemCount / PUBLIC_TRENDS_ROUNDING_INCREMENT) *
                PUBLIC_TRENDS_ROUNDING_INCREMENT,
            })),
          );
        }
        if (publishableMakerProducts.length > 0) {
          await tx.insert(schema.publicCollectionMakerProductTrend).values(
            publishableMakerProducts.map((row) => ({
              generationId: generation.id,
              makerId: row.makerId,
              materialId: row.materialId,
              materialSpecificId: row.materialSpecificId,
              productId: row.productId,
              productTypeId: row.productTypeId,
              roundedCollectorCount:
                Math.round(
                  row.contributorCount / PUBLIC_TRENDS_ROUNDING_INCREMENT,
                ) * PUBLIC_TRENDS_ROUNDING_INCREMENT,
              roundedItemCount:
                Math.round(row.itemCount / PUBLIC_TRENDS_ROUNDING_INCREMENT) *
                PUBLIC_TRENDS_ROUNDING_INCREMENT,
            })),
          );
        }
        await hooks.beforeActivate?.();
        await tx
          .update(schema.publicTrendsGeneration)
          .set({ active: false })
          .where(eq(schema.publicTrendsGeneration.active, true));
        await tx
          .update(schema.publicTrendsGeneration)
          .set({ active: true })
          .where(eq(schema.publicTrendsGeneration.id, generation.id));
      });
      const active = await this.getPublicCollectionItemTrends(generatedAt);
      if (!active) throw new Error("Failed to activate Trends generation.");
      return active;
    },
  };
}
