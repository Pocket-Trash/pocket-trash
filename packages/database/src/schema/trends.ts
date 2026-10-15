import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  integer,
  pgTable,
  primaryKey,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { productType } from "./scraper.js";

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
  },
  (table) => [
    uniqueIndex("public_trends_generation_active_unique")
      .on(table.active)
      .where(sql`${table.active}`),
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
