import type { Database } from "@package/database";
import { schema } from "@package/database";
import { and, asc, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import type { CollectionItemStatusSearch } from "../../catalog-terminology.js";
import {
  PUBLIC_TRENDS_CONTRIBUTOR_THRESHOLD,
  PUBLIC_TRENDS_ROUNDING_INCREMENT,
  PUBLIC_TRENDS_STALE_MS,
} from "./constants.js";

/** One thresholded anonymous status total. */
export type PublicStatusTrendValue = {
  /** Stable URL status bucket. */
  status: CollectionItemStatusSearch;
  /** Physical item count rounded to the nearest five. */
  approximateItemCount: number;
  /** Lower bound of the contributor band, such as five for five through nine collectors. */
  contributorCountBand: number;
};

/** One independently thresholded product group, with current public catalog presentation. */
export type PublicStatusProductTrendValue = PublicStatusTrendValue & {
  /** Catalog identifier; never a source collection-item or owner identifier. */
  productId: string;
  /** Current approved public product name. */
  productName: string;
  /** Current canonical product slug. */
  productSlug: string;
  /** Canonical catalog product-type slug. */
  productTypeSlug: string;
};

/** Active anonymous status generation; live public counts are queried separately. */
export type PublicCollectionStatusTrends = {
  /** Completion time shared with the other public Trends aggregates. */
  generatedAt: Date;
  /** Whether this generation is older than the existing freshness target. */
  stale: boolean;
  /** Eligible groups only; missing groups never disclose whether private sources exist. */
  values: PublicStatusTrendValue[];
  /** Independently eligible public catalog groups; no user or collection-item destinations. */
  productValues: PublicStatusProductTrendValue[];
};

/** Existing caller-owned Trends refresh transaction. */
type TrendsTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

/**
 * Writes independently thresholded totals and product groups inside the existing generation transaction.
 * @param tx - Transaction that owns the advisory lock and atomic generation activation.
 * @param generationId - Inactive generation being completed.
 * @returns Completion after all eligible status groups are written.
 * @rejects When aggregation or transformed-row persistence fails.
 */
export async function writePublicCollectionStatusTrends(
  tx: TrendsTransaction,
  generationId: number,
) {
  const result = await tx.execute<{
    /** Null for a status total, otherwise a catalog product group. */ productId:
      | number
      | string
      | null;
    /** Stable public status key. */ status: CollectionItemStatusSearch;
    /** Exact source item count, confined to this refresh transaction. */ itemCount:
      | number
      | string;
    /** Exact source contributor count, confined to this refresh transaction. */ contributorCount:
      | number
      | string;
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
    ), latest_state as (
      select item.id, item.owner_id,
        item.owned and item.sold_at is null as current,
        (select period.exit_reason from collection_item_ownership_period period
         where period.collection_item_id = item.id
         order by period.effective_start_date desc, period.id desc limit 1) as exit_reason
      from collection_item item
    ), assignments as (
      select distinct state.id, state.owner_id, replace(status.status, '_', '-') as status
      from latest_state state
      inner join collection_item_status status on status.collection_item_id = state.id
      where state.current or (status.status = 'sold' and state.exit_reason = 'sale')
      union all
      select state.id, state.owner_id, 'unstatused'
      from latest_state state
      where state.current and not exists (
        select 1 from collection_item_status status where status.collection_item_id = state.id
      )
    )
    select assignments.status, item_products.product_id as "productId",
      count(distinct assignments.id)::integer as "itemCount",
      count(distinct assignments.owner_id)::integer as "contributorCount"
    from assignments
    left join item_products on item_products.collection_item_id = assignments.id
    group by grouping sets ((assignments.status), (assignments.status, item_products.product_id))
    having count(distinct assignments.owner_id) >= ${PUBLIC_TRENDS_CONTRIBUTOR_THRESHOLD}
      and (grouping(item_products.product_id) = 1 or item_products.product_id is not null)
  `);
  if (!result.rows.length) return;
  await tx.insert(schema.publicCollectionItemStatusTrend).values(
    result.rows.map((row) => ({
      generationId,
      status: row.status,
      productId: row.productId === null ? null : Number(row.productId),
      approximateItemCount:
        Math.round(Number(row.itemCount) / PUBLIC_TRENDS_ROUNDING_INCREMENT) *
        PUBLIC_TRENDS_ROUNDING_INCREMENT,
      contributorCountBand:
        Math.floor(
          Number(row.contributorCount) / PUBLIC_TRENDS_ROUNDING_INCREMENT,
        ) * PUBLIC_TRENDS_ROUNDING_INCREMENT,
    })),
  );
}

/**
 * Reads eligible anonymous totals and current public catalog groups from the active generation.
 * @param db - Application database.
 * @param now - Current time used by the shared freshness policy.
 * @returns Active transformed values, or null before the first successful refresh.
 * @rejects When the generation or aggregate query fails.
 */
export async function getPublicCollectionStatusTrends(
  db: Database,
  now = new Date(),
): Promise<PublicCollectionStatusTrends | null> {
  const [generation] = await db
    .select({
      id: schema.publicTrendsGeneration.id,
      generatedAt: schema.publicTrendsGeneration.generatedAt,
    })
    .from(schema.publicTrendsGeneration)
    .where(eq(schema.publicTrendsGeneration.active, true))
    .limit(1);
  if (!generation) return null;
  const values = await db
    .select({
      status: schema.publicCollectionItemStatusTrend.status,
      approximateItemCount:
        schema.publicCollectionItemStatusTrend.approximateItemCount,
      contributorCountBand:
        schema.publicCollectionItemStatusTrend.contributorCountBand,
    })
    .from(schema.publicCollectionItemStatusTrend)
    .where(
      and(
        eq(schema.publicCollectionItemStatusTrend.generationId, generation.id),
        isNull(schema.publicCollectionItemStatusTrend.productId),
      ),
    )
    .orderBy(asc(schema.publicCollectionItemStatusTrend.status));
  const productValues = await db
    .select({
      status: schema.publicCollectionItemStatusTrend.status,
      productId: sql<string>`${schema.publicCollectionItemStatusTrend.productId}::text`,
      approximateItemCount:
        schema.publicCollectionItemStatusTrend.approximateItemCount,
      contributorCountBand:
        schema.publicCollectionItemStatusTrend.contributorCountBand,
      productName: schema.product.name,
      productSlug: schema.product.slug,
      productTypeSlug: schema.productType.slug,
    })
    .from(schema.publicCollectionItemStatusTrend)
    .innerJoin(
      schema.product,
      eq(schema.product.id, schema.publicCollectionItemStatusTrend.productId),
    )
    .innerJoin(
      schema.productType,
      eq(schema.productType.id, schema.product.productTypeId),
    )
    .where(
      and(
        eq(schema.publicCollectionItemStatusTrend.generationId, generation.id),
        isNotNull(schema.publicCollectionItemStatusTrend.productId),
        eq(schema.product.approvalStatus, "approved"),
        eq(schema.product.isPrivate, false),
      ),
    )
    .orderBy(
      asc(schema.publicCollectionItemStatusTrend.status),
      desc(schema.publicCollectionItemStatusTrend.approximateItemCount),
      asc(schema.product.name),
      asc(schema.product.id),
    );
  return {
    generatedAt: generation.generatedAt,
    stale:
      now.getTime() - generation.generatedAt.getTime() > PUBLIC_TRENDS_STALE_MS,
    values,
    productValues,
  };
}
