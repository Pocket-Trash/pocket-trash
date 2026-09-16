import {
  bigint,
  boolean,
  decimal,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { maker, material, productType } from "./scraper.js";
import { user } from "./users.js";

export const collectionItem = pgTable("collection_item", {
  id: bigint("id", { mode: "number" })
    .primaryKey()
    .generatedAlwaysAsIdentity({ startWith: 1000 }),
  ownerId: bigint("owner_id", { mode: "number" })
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  purchasedAt: timestamp("purchased_at", { withTimezone: true }),
  soldAt: timestamp("sold_at", { withTimezone: true }),
  purchasedFromUserId: bigint("purchased_from_user_id", {
    mode: "number",
  }).references(() => user.id, { onDelete: "set null" }),
  purchasedFromUser: text("purchased_from_user"),
  soldToUserId: bigint("sold_to_user_id", { mode: "number" }).references(
    () => user.id,
    { onDelete: "set null" },
  ),
  soldToUser: text("sold_to_user"),
  owned: boolean("owned").notNull().default(true),
});

export const product = pgTable(
  "product",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity({ startWith: 1000 }),
    productTypeId: bigint("product_type_id", { mode: "number" })
      .notNull()
      .references(() => productType.id, { onDelete: "restrict" }),
    makerId: bigint("maker_id", { mode: "number" })
      .notNull()
      .references(() => maker.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
  },
  (table) => ({
    typeSlugUnique: uniqueIndex("product_type_slug_unique").on(
      table.productTypeId,
      table.slug,
    ),
  }),
);

export const productMaterial = pgTable(
  "product_material",
  {
    productId: bigint("product_id", { mode: "number" })
      .notNull()
      .references(() => product.id, { onDelete: "cascade" }),
    materialId: bigint("material_id", { mode: "number" })
      .notNull()
      .references(() => material.id, { onDelete: "restrict" }),
  },
  (table) => [primaryKey({ columns: [table.productId, table.materialId] })],
);

export const productSpinner = pgTable("product_spinner", {
  id: bigint("id", { mode: "number" })
    .primaryKey()
    .references(() => product.id, { onDelete: "cascade" }),
  weightG: decimal("weight_g"),
  lengthMm: decimal("length_mm"),
  widthMm: decimal("width_mm"),
  thicknessMm: decimal("thickness_mm"),
  thicknessWithButtonMm: decimal("thickness_with_button_mm"),
  buttonDiameterMm: decimal("button_diameter_mm"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const productSpinnerButton = pgTable("product_spinner_button", {
  id: bigint("id", { mode: "number" })
    .primaryKey()
    .references(() => product.id, { onDelete: "cascade" }),
  weightG: decimal("weight_g"),
  diameterMm: decimal("diameter_mm"),
  thicknessMm: decimal("thickness_mm"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const collectionSpinnerButton = pgTable("collection_spinner_button", {
  id: bigint("id", { mode: "number" })
    .primaryKey()
    .references(() => collectionItem.id, { onDelete: "cascade" }),
  productSpinnerButtonId: bigint("product_spinner_button_id", {
    mode: "number",
  })
    .notNull()
    .references(() => productSpinnerButton.id, { onDelete: "restrict" }),
});

export const collectionSpinner = pgTable("collection_spinner", {
  id: bigint("id", { mode: "number" })
    .primaryKey()
    .references(() => collectionItem.id, { onDelete: "cascade" }),
  productSpinnerId: bigint("product_spinner_id", { mode: "number" })
    .notNull()
    .references(() => productSpinner.id, { onDelete: "restrict" }),
  installedButtonId: bigint("installed_button_id", {
    mode: "number",
  }).references(() => collectionSpinnerButton.id, { onDelete: "set null" }),
});

export type CollectionItem = typeof collectionItem.$inferSelect;
export type NewCollectionItem = typeof collectionItem.$inferInsert;
export type Product = typeof product.$inferSelect;
export type NewProduct = typeof product.$inferInsert;
export type ProductMaterial = typeof productMaterial.$inferSelect;
export type NewProductMaterial = typeof productMaterial.$inferInsert;
export type ProductSpinner = typeof productSpinner.$inferSelect;
export type NewProductSpinner = typeof productSpinner.$inferInsert;
export type ProductSpinnerButton = typeof productSpinnerButton.$inferSelect;
export type NewProductSpinnerButton = typeof productSpinnerButton.$inferInsert;
export type CollectionSpinner = typeof collectionSpinner.$inferSelect;
export type NewCollectionSpinner = typeof collectionSpinner.$inferInsert;
export type CollectionSpinnerButton =
  typeof collectionSpinnerButton.$inferSelect;
export type NewCollectionSpinnerButton =
  typeof collectionSpinnerButton.$inferInsert;
