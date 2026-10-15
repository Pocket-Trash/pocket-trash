import type { Database } from "@package/database";
import { schema } from "@package/database";
import { asc, desc, eq, sql } from "drizzle-orm";

/** Minimum distinct owners required before a collection-derived value is public. */
export const PUBLIC_TRENDS_CONTRIBUTOR_THRESHOLD = 5;
/** Collection-derived public counts are rounded to this increment. */
export const PUBLIC_TRENDS_ROUNDING_INCREMENT = 5;
/** Age after which the active public generation is marked stale. */
export const PUBLIC_TRENDS_STALE_MS = 36 * 60 * 60 * 1000;

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
            count(collection_item.id)::integer as "itemCount",
            product_types.id as "productTypeId"
          from item_products
          inner join collection_item on collection_item.id = item_products.collection_item_id
          inner join product on product.id = item_products.product_id
          inner join product_types on product_types.id = product.product_type_id
          where collection_item.owned
            and collection_item.sold_at is null
            and not product_types.is_part_or_accessory
          group by product_types.id
        `);
        const source = sourceResult.rows.map((row) => ({
          contributorCount: Number(row.contributorCount),
          itemCount: Number(row.itemCount),
          productTypeId: Number(row.productTypeId),
        }));
        const publishable = source.filter(
          ({ contributorCount }) =>
            contributorCount >= PUBLIC_TRENDS_CONTRIBUTOR_THRESHOLD,
        );
        const [generation] = await tx
          .insert(schema.publicTrendsGeneration)
          .values({
            generatedAt,
            hasSuppressedValues: publishable.length < source.length,
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
