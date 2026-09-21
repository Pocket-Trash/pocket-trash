import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  bigint,
  boolean,
  check,
  decimal,
  integer,
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
  materialId: bigint("material_id", { mode: "number" }).references(
    () => material.id,
    { onDelete: "restrict" },
  ),
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

const lookupColumns = () => ({
  id: bigint("id", { mode: "number" })
    .primaryKey()
    .generatedAlwaysAsIdentity({ startWith: 1000 }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const finish = pgTable("finish", lookupColumns(), (table) => [
  uniqueIndex("finish_slug_unique").on(table.slug),
]);

export const color = pgTable(
  "color",
  {
    ...lookupColumns(),
    hex: text("hex").notNull(),
  },
  (table) => [
    uniqueIndex("color_slug_unique").on(table.slug),
    check("color_hex_check", sql`${table.hex} ~ '^#[0-9A-Fa-f]{6}$'`),
  ],
);

export const colorEffect = pgTable("color_effect", lookupColumns(), (table) => [
  uniqueIndex("color_effect_slug_unique").on(table.slug),
]);

export const finishOption = pgTable(
  "finish_option",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity({ startWith: 1000 }),
    productId: bigint("product_id", { mode: "number" }).references(
      () => product.id,
      { onDelete: "cascade" },
    ),
    collectionItemId: bigint("collection_item_id", {
      mode: "number",
    }).references(() => collectionItem.id, { onDelete: "cascade" }),
    sourceProductFinishOptionId: bigint("source_product_finish_option_id", {
      mode: "number",
    }).references((): AnyPgColumn => finishOption.id, { onDelete: "set null" }),
    colorEffectId: bigint("color_effect_id", { mode: "number" }).references(
      () => colorEffect.id,
      { onDelete: "restrict" },
    ),
    position: integer("position").notNull(),
  },
  (table) => [
    check(
      "finish_option_owner_check",
      sql`(${table.productId} is not null) <> (${table.collectionItemId} is not null)`,
    ),
    check("finish_option_position_check", sql`${table.position} >= 0`),
    uniqueIndex("finish_option_collection_item_unique").on(
      table.collectionItemId,
    ),
    uniqueIndex("finish_option_product_position_unique").on(
      table.productId,
      table.position,
    ),
  ],
);

export const finishOptionFinish = pgTable(
  "finish_option_finish",
  {
    finishOptionId: bigint("finish_option_id", { mode: "number" })
      .notNull()
      .references(() => finishOption.id, { onDelete: "cascade" }),
    finishId: bigint("finish_id", { mode: "number" })
      .notNull()
      .references(() => finish.id, { onDelete: "restrict" }),
    position: integer("position").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.finishOptionId, table.finishId] }),
    uniqueIndex("finish_option_finish_position_unique").on(
      table.finishOptionId,
      table.position,
    ),
    check("finish_option_finish_position_check", sql`${table.position} >= 0`),
  ],
);

export const finishOptionColor = pgTable(
  "finish_option_color",
  {
    finishOptionId: bigint("finish_option_id", { mode: "number" })
      .notNull()
      .references(() => finishOption.id, { onDelete: "cascade" }),
    colorId: bigint("color_id", { mode: "number" })
      .notNull()
      .references(() => color.id, { onDelete: "restrict" }),
    position: integer("position").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.finishOptionId, table.colorId] }),
    uniqueIndex("finish_option_color_position_unique").on(
      table.finishOptionId,
      table.position,
    ),
    check("finish_option_color_position_check", sql`${table.position} >= 0`),
  ],
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
  compatibleButtonId: bigint("compatible_button_id", {
    mode: "number",
  }).references((): AnyPgColumn => productSpinnerButton.id, {
    onDelete: "set null",
  }),
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
export type Finish = typeof finish.$inferSelect;
export type NewFinish = typeof finish.$inferInsert;
export type Color = typeof color.$inferSelect;
export type NewColor = typeof color.$inferInsert;
export type ColorEffect = typeof colorEffect.$inferSelect;
export type NewColorEffect = typeof colorEffect.$inferInsert;
export type FinishOption = typeof finishOption.$inferSelect;
export type NewFinishOption = typeof finishOption.$inferInsert;
export type FinishOptionFinish = typeof finishOptionFinish.$inferSelect;
export type NewFinishOptionFinish = typeof finishOptionFinish.$inferInsert;
export type FinishOptionColor = typeof finishOptionColor.$inferSelect;
export type NewFinishOptionColor = typeof finishOptionColor.$inferInsert;
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
