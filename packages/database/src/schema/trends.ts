import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  foreignKey,
  integer,
  pgTable,
  primaryKey,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { material, materialSpecific, productType } from "./scraper.js";

/** Completed public Trends generations, with at most one active generation. */
export const publicTrendsGeneration = pgTable(
  "public_trends_generation",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity({ startWith: 1000 }),
    active: boolean("active").default(false).notNull(),
    generatedAt: timestamp("generated_at", {
      mode: "date",
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
    /** Whether at least one category was removed by the contributor threshold. */
    hasSuppressedValues: boolean("has_suppressed_values")
      .default(false)
      .notNull(),
    /** Whether an enabled Parts and Accessories type was privacy-suppressed. */
    hasSuppressedPartAccessoryValues: boolean(
      "has_suppressed_part_accessory_values",
    )
      .default(false)
      .notNull(),
    /** Whether at least one material value was privacy-suppressed. */
    hasSuppressedMaterialValues: boolean("has_suppressed_material_values")
      .default(false)
      .notNull(),
  },
  (table) => [
    uniqueIndex("public_trends_generation_active_unique")
      .on(table.active)
      .where(sql`${table.active}`),
  ],
);

/** Privacy-transformed material counts for one generation and product type. */
export const publicCollectionItemMaterialTrend = pgTable(
  "public_collection_item_material_trend",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity({ startWith: 1000 }),
    generationId: bigint("generation_id", { mode: "number" })
      .notNull()
      .references(() => publicTrendsGeneration.id, { onDelete: "cascade" }),
    /** Null for the all-product-types headline aggregate. */
    productTypeId: bigint("product_type_id", { mode: "number" }).references(
      () => productType.id,
      { onDelete: "restrict" },
    ),
    /** Null for the Unspecified bucket. */
    materialId: bigint("material_id", { mode: "number" }).references(
      () => material.id,
      { onDelete: "restrict" },
    ),
    /** Null for general-material and Unspecified buckets. */
    materialSpecificId: bigint("material_specific_id", { mode: "number" }),
    /** Whether this row belongs to a selected material's specific breakdown. */
    isSpecificBreakdown: boolean("is_specific_breakdown")
      .default(false)
      .notNull(),
    /** Item count rounded to the nearest five before persistence. */
    roundedItemCount: integer("rounded_item_count").notNull(),
    /** Distinct collector count rounded to the nearest five before persistence. */
    roundedCollectorCount: integer("rounded_collector_count").notNull(),
  },
  (table) => [
    uniqueIndex("public_collection_item_material_trend_scope_unique").on(
      table.generationId,
      sql`coalesce(${table.productTypeId}, 0)`,
      sql`coalesce(${table.materialId}, 0)`,
      sql`coalesce(${table.materialSpecificId}, 0)`,
      table.isSpecificBreakdown,
    ),
    check(
      "public_collection_item_material_trend_count_valid",
      sql`${table.roundedItemCount} > 0 and ${table.roundedItemCount} % 5 = 0 and ${table.roundedCollectorCount} > 0 and ${table.roundedCollectorCount} % 5 = 0`,
    ),
    check(
      "public_collection_item_material_trend_scope_valid",
      sql`${table.materialSpecificId} is null or ${table.materialId} is not null`,
    ),
    foreignKey({
      columns: [table.materialId, table.materialSpecificId],
      foreignColumns: [materialSpecific.materialId, materialSpecific.id],
      name: "public_collection_item_material_trend_specific_parent_fk",
    }).onDelete("restrict"),
  ],
);

/** Privacy-transformed Parts and Accessories counts for one generation. */
export const publicPartAccessoryProductTypeTrend = pgTable(
  "public_part_accessory_product_type_trend",
  {
    generationId: bigint("generation_id", { mode: "number" })
      .notNull()
      .references(() => publicTrendsGeneration.id, { onDelete: "cascade" }),
    productTypeId: bigint("product_type_id", { mode: "number" })
      .notNull()
      .references(() => productType.id, { onDelete: "restrict" }),
    /** Item count rounded to the nearest five before persistence. */
    roundedItemCount: integer("rounded_item_count").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.generationId, table.productTypeId] }),
    check(
      "public_part_accessory_product_type_trend_count_valid",
      sql`${table.roundedItemCount} > 0 and ${table.roundedItemCount} % 5 = 0`,
    ),
  ],
);

/** Privacy-transformed currently owned item counts for one generation. */
export const publicCollectionItemProductTypeTrend = pgTable(
  "public_collection_item_product_type_trend",
  {
    generationId: bigint("generation_id", { mode: "number" })
      .notNull()
      .references(() => publicTrendsGeneration.id, { onDelete: "cascade" }),
    productTypeId: bigint("product_type_id", { mode: "number" })
      .notNull()
      .references(() => productType.id, { onDelete: "restrict" }),
    /** Item count rounded to the nearest five before persistence. */
    roundedItemCount: integer("rounded_item_count").notNull(),
    /** Distinct collector count rounded to the nearest five before persistence. */
    roundedCollectorCount: integer("rounded_collector_count").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.generationId, table.productTypeId] }),
    check(
      "public_collection_item_product_type_trend_count_valid",
      sql`${table.roundedItemCount} > 0 and ${table.roundedItemCount} % 5 = 0 and ${table.roundedCollectorCount} > 0 and ${table.roundedCollectorCount} % 5 = 0`,
    ),
  ],
);

/** Stored public Trends generation row. */
export type PublicTrendsGeneration = typeof publicTrendsGeneration.$inferSelect;
/** Stored privacy-safe collection-item Trend row. */
export type PublicCollectionItemProductTypeTrend =
  typeof publicCollectionItemProductTypeTrend.$inferSelect;
/** Stored privacy-safe Parts and Accessories Trend row. */
export type PublicPartAccessoryProductTypeTrend =
  typeof publicPartAccessoryProductTypeTrend.$inferSelect;
/** Stored privacy-safe material Trend row. */
export type PublicCollectionItemMaterialTrend =
  typeof publicCollectionItemMaterialTrend.$inferSelect;
