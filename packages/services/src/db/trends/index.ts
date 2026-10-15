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
            product_material.material_id,
            product_material.material_specific_id
          from product
          inner join product_types on product_types.id = product.product_type_id
          left join product_material on product_material.product_id = product.id
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
              product_material.material_id,
              product_material.material_specific_id
            from item_products
            inner join collection_item on collection_item.id = item_products.collection_item_id
            inner join product on product.id = item_products.product_id
            inner join product_types on product_types.id = product.product_type_id
            left join product_material on product_material.product_id = product.id
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
              product_material.material_id,
              product_material.material_specific_id
            from item_products
            inner join collection_item on collection_item.id = item_products.collection_item_id
            inner join product on product.id = item_products.product_id
            inner join product_types on product_types.id = product.product_type_id
            left join product_material on product_material.product_id = product.id
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
