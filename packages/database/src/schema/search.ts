import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  customType,
  index,
  pgTable,
  primaryKey,
  text,
} from "drizzle-orm/pg-core";

/** Public result kinds stored in the shared search projection. */
export const searchKinds = [
  "product",
  "collection",
  "collection_item",
  "maker",
  "person",
  "material",
  "material_detail",
  "resource",
] as const;

/** Public result groups used by scoped search. */
export const searchGroups = [
  "products",
  "collections",
  "makers",
  "people",
  "materials",
  "resources",
] as const;

/** Drizzle representation of a PostgreSQL full-text vector. */
type TsVectorData = {
  /** Serialized vector value. */
  data: string;
};

/** Native PostgreSQL full-text vector column. */
const tsvector = customType<TsVectorData>({
  /**
   * Returns the PostgreSQL storage type.
   *
   * @returns Native column type name.
   */
  dataType: () => "tsvector",
});

/** Denormalized public search documents maintained by database triggers. */
export const searchDocument = pgTable(
  "search_documents",
  {
    kind: text("kind", { enum: searchKinds }).notNull(),
    sourceId: bigint("source_id", { mode: "number" }).notNull(),
    group: text("search_group", { enum: searchGroups }).notNull(),
    parentId: bigint("parent_id", { mode: "number" }),
    title: text("title").notNull(),
    href: text("href").notNull(),
    imageUrl: text("image_url"),
    context: text("context"),
    description: text("description"),
    searchTextA: text("search_text_a").default("").notNull(),
    searchTextB: text("search_text_b").default("").notNull(),
    searchTextC: text("search_text_c").default("").notNull(),
    searchVector: tsvector("search_vector").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.kind, table.sourceId] }),
    index("search_documents_group_idx").on(table.group),
    check(
      "search_documents_kind_valid",
      sql`${table.kind} in ('product', 'collection', 'collection_item', 'maker', 'person', 'material', 'material_detail', 'resource')`,
    ),
    check(
      "search_documents_group_valid",
      sql`${table.group} in ('products', 'collections', 'makers', 'people', 'materials', 'resources')`,
    ),
    check(
      "search_documents_kind_group_valid",
      sql`(${table.kind} = 'product' and ${table.group} = 'products') or (${table.kind} in ('collection', 'collection_item') and ${table.group} = 'collections') or (${table.kind} = 'maker' and ${table.group} = 'makers') or (${table.kind} = 'person' and ${table.group} = 'people') or (${table.kind} in ('material', 'material_detail') and ${table.group} = 'materials') or (${table.kind} = 'resource' and ${table.group} = 'resources')`,
    ),
  ],
);

/** Stored public search projection row. */
export type SearchDocument = typeof searchDocument.$inferSelect;
