import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { collectionItem, product } from "./collection.js";
import { catalogTerminologyConcept } from "./pens.js";
import { maker } from "./scraper.js";

/** Creation and update timestamps for mutable fountain-pen records. */
const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
};
/**
 * Builds a generated reference identity.
 * @returns Generated bigint primary key.
 */
const identity = () =>
  bigint("id", { mode: "number" })
    .primaryKey()
    .generatedAlwaysAsIdentity({ startWith: 1000 });
/**
 * Builds a catalog subtype identity.
 * @returns Product-owned primary key.
 */
const productId = () =>
  bigint("id", { mode: "number" })
    .primaryKey()
    .references(() => product.id, { onDelete: "cascade" });
/**
 * Builds an owned subtype identity.
 * @returns Collection-item-owned primary key.
 */
const itemId = () =>
  bigint("id", { mode: "number" })
    .primaryKey()
    .references(() => collectionItem.id, { onDelete: "cascade" });

/** Ink filling mechanism taxonomy, separate from mechanical Pen actuation. */
export const fountainPenFillingMechanism = pgTable(
  "fountain_pen_filling_mechanism",
  {
    id: identity(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("fountain_pen_filling_mechanism_name_unique").on(
      sql`lower(trim(${t.name}))`,
    ),
  ],
);
/** Connector families used to infer cartridge/converter fit. */
export const fountainPenConnectorFamily = pgTable(
  "fountain_pen_connector_family",
  {
    id: identity(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("fountain_pen_connector_family_name_unique").on(
      sql`lower(trim(${t.name}))`,
    ),
  ],
);
/** Non-collectible converter reference with classified connector and length. */
export const fountainPenConverter = pgTable(
  "fountain_pen_converter",
  {
    id: identity(),
    makerId: bigint("maker_id", { mode: "number" })
      .notNull()
      .references(() => maker.id, { onDelete: "restrict" }),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    connectorFamilyId: bigint("connector_family_id", {
      mode: "number",
    }).references(() => fountainPenConnectorFamily.id, {
      onDelete: "restrict",
    }),
    lengthClass: text("length_class", { enum: ["short", "long"] }),
    closedLengthMm: numeric("closed_length_mm"),
    extendedLengthMm: numeric("extended_length_mm"),
    ...timestamps,
  },
  (t) => [
    index("fountain_pen_converter_maker_idx").on(t.makerId),
    index("fountain_pen_converter_connector_idx").on(t.connectorFamilyId),
    uniqueIndex("fountain_pen_converter_maker_name_unique").on(
      t.makerId,
      sql`lower(trim(${t.name}))`,
    ),
    check(
      "fountain_pen_converter_length_valid",
      sql`${t.lengthClass} is null or ${t.lengthClass} in ('short', 'long')`,
    ),
    check(
      "fountain_pen_converter_measurements_valid",
      sql`(${t.closedLengthMm} is null or ${t.closedLengthMm} > 0) and (${t.extendedLengthMm} is null or ${t.extendedLengthMm} > 0) and (${t.closedLengthMm} is null or ${t.extendedLengthMm} is null or ${t.extendedLengthMm} >= ${t.closedLengthMm})`,
    ),
  ],
);
/** Explicit mounting interfaces; a shared nominal size does not imply fit. */
export const nibMount = pgTable(
  "nib_mount",
  {
    id: identity(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    ...timestamps,
  },
  (t) => [uniqueIndex("nib_mount_name_unique").on(sql`lower(trim(${t.name}))`)],
);
/** Canonical manufacturer writing-width labels without numeric equivalence. */
export const nibWidth = pgTable(
  "nib_width",
  {
    id: identity(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    ...timestamps,
  },
  (t) => [uniqueIndex("nib_width_name_unique").on(sql`lower(trim(${t.name}))`)],
);
/** Coating-metal references, distinct from nib base material. */
export const nibPlatingMetal = pgTable(
  "nib_plating_metal",
  {
    id: identity(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("nib_plating_metal_name_unique").on(
      sql`lower(trim(${t.name}))`,
    ),
  ],
);
/** Controlled nib plating styles used by offered and actual appearances. */
export const nibPlatingStyle = pgTable(
  "nib_plating_style",
  {
    id: identity(),
    slug: text("slug", {
      enum: ["unplated", "full", "partial", "two-tone", "reverse-two-tone"],
    })
      .notNull()
      .unique(),
    name: text("name").notNull(),
    description: text("description"),
    ...timestamps,
  },
  (t) => [
    check(
      "nib_plating_style_slug_valid",
      sql`${t.slug} in ('unplated', 'full', 'partial', 'two-tone', 'reverse-two-tone')`,
    ),
  ],
);

/** Material-specific nib model with generic feed/housing defaults. */
export const productDetailNib = pgTable(
  "product_detail_nib",
  {
    id: productId(),
    form: text("form", { enum: ["standard", "complete-unit"] })
      .default("standard")
      .notNull(),
    manufacturerSizeCode: text("manufacturer_size_code").notNull(),
    sizeFamilyId: bigint("size_family_id", { mode: "number" }).references(
      () => catalogTerminologyConcept.id,
      { onDelete: "restrict" },
    ),
    defaultFeedMaterial: text("default_feed_material", {
      enum: ["plastic", "ebonite", "metal", "other", "unknown"],
    })
      .default("plastic")
      .notNull(),
    defaultHousingMaterial: text("default_housing_material", {
      enum: ["plastic", "ebonite", "metal", "other", "unknown"],
    })
      .default("plastic")
      .notNull(),
    ...timestamps,
  },
  (t) => [
    index("product_detail_nib_size_family_idx").on(t.sizeFamilyId),
    check(
      "product_detail_nib_form_valid",
      sql`${t.form} in ('standard', 'complete-unit')`,
    ),
    check(
      "product_detail_nib_code_valid",
      sql`char_length(trim(${t.manufacturerSizeCode})) between 1 and 200`,
    ),
    check(
      "product_detail_nib_feed_valid",
      sql`${t.defaultFeedMaterial} in ('plastic', 'ebonite', 'metal', 'other', 'unknown')`,
    ),
    check(
      "product_detail_nib_housing_valid",
      sql`${t.defaultHousingMaterial} in ('plastic', 'ebonite', 'metal', 'other', 'unknown')`,
    ),
  ],
);
/** Writing widths offered for a specific material-specific nib model. */
export const nibWidthOffering = pgTable(
  "nib_width_offering",
  {
    nibProductId: bigint("nib_product_id", { mode: "number" })
      .notNull()
      .references(() => productDetailNib.id, { onDelete: "cascade" }),
    widthId: bigint("width_id", { mode: "number" })
      .notNull()
      .references(() => nibWidth.id, { onDelete: "restrict" }),
  },
  (t) => [
    primaryKey({ columns: [t.nibProductId, t.widthId] }),
    index("nib_width_offering_width_idx").on(t.widthId),
  ],
);
/** Declared mounting interfaces for a nib model. */
export const nibMountCompatibility = pgTable(
  "nib_mount_compatibility",
  {
    nibProductId: bigint("nib_product_id", { mode: "number" })
      .notNull()
      .references(() => productDetailNib.id, { onDelete: "cascade" }),
    mountId: bigint("mount_id", { mode: "number" })
      .notNull()
      .references(() => nibMount.id, { onDelete: "restrict" }),
  },
  (t) => [
    primaryKey({ columns: [t.nibProductId, t.mountId] }),
    index("nib_mount_compatibility_mount_idx").on(t.mountId),
  ],
);
/** Plating styles actually offered for a nib model. */
export const nibPlatingStyleOffering = pgTable(
  "nib_plating_style_offering",
  {
    nibProductId: bigint("nib_product_id", { mode: "number" })
      .notNull()
      .references(() => productDetailNib.id, { onDelete: "cascade" }),
    style: text("style", {
      enum: ["unplated", "full", "partial", "two-tone", "reverse-two-tone"],
    })
      .notNull()
      .references(() => nibPlatingStyle.slug, { onDelete: "restrict" }),
  },
  (t) => [
    primaryKey({ columns: [t.nibProductId, t.style] }),
    index("nib_plating_style_offering_style_idx").on(t.style),
  ],
);
/** Coating metals actually offered for a nib model. */
export const nibPlatingMetalOffering = pgTable(
  "nib_plating_metal_offering",
  {
    nibProductId: bigint("nib_product_id", { mode: "number" })
      .notNull()
      .references(() => productDetailNib.id, { onDelete: "cascade" }),
    metalId: bigint("metal_id", { mode: "number" })
      .notNull()
      .references(() => nibPlatingMetal.id, { onDelete: "restrict" }),
  },
  (t) => [
    primaryKey({ columns: [t.nibProductId, t.metalId] }),
    index("nib_plating_metal_offering_metal_idx").on(t.metalId),
  ],
);

/** Fountain-pen facts preserve unknown capabilities as null. */
export const productDetailFountainPen = pgTable(
  "product_detail_fountain_pen",
  {
    id: productId(),
    postable: boolean("postable"),
    ownerReplaceableNib: boolean("owner_replaceable_nib"),
    hasClip: boolean("has_clip"),
    hasInkWindow: boolean("has_ink_window"),
    capabilityNotes: text("capability_notes"),
    connectorFamilyId: bigint("connector_family_id", {
      mode: "number",
    }).references(() => fountainPenConnectorFamily.id, {
      onDelete: "restrict",
    }),
    cartridgeConverterLength: text("cartridge_converter_length", {
      enum: ["short", "long", "short-and-long"],
    }),
    nibConstructionId: bigint("nib_construction_id", {
      mode: "number",
    }).references(() => catalogTerminologyConcept.id, { onDelete: "restrict" }),
    bodySilhouetteId: bigint("body_silhouette_id", {
      mode: "number",
    }).references(() => catalogTerminologyConcept.id, { onDelete: "restrict" }),
    crossSectionId: bigint("cross_section_id", { mode: "number" }).references(
      () => catalogTerminologyConcept.id,
      { onDelete: "restrict" },
    ),
    facetCount: integer("facet_count"),
    formFactorId: bigint("form_factor_id", { mode: "number" }).references(
      () => catalogTerminologyConcept.id,
      { onDelete: "restrict" },
    ),
    capClosureId: bigint("cap_closure_id", { mode: "number" }).references(
      () => catalogTerminologyConcept.id,
      { onDelete: "restrict" },
    ),
    nibDeploymentId: bigint("nib_deployment_id", { mode: "number" }).references(
      () => catalogTerminologyConcept.id,
      { onDelete: "restrict" },
    ),
    defaultNibProductId: bigint("default_nib_product_id", {
      mode: "number",
    }).references(() => productDetailNib.id, { onDelete: "restrict" }),
    ...timestamps,
  },
  (t) => [
    index("product_detail_fountain_pen_connector_idx").on(t.connectorFamilyId),
    index("product_detail_fountain_pen_default_nib_idx").on(
      t.defaultNibProductId,
    ),
    index("product_detail_fountain_pen_construction_idx").on(
      t.nibConstructionId,
    ),
    index("product_detail_fountain_pen_silhouette_idx").on(t.bodySilhouetteId),
    index("product_detail_fountain_pen_cross_section_idx").on(t.crossSectionId),
    index("product_detail_fountain_pen_form_factor_idx").on(t.formFactorId),
    index("product_detail_fountain_pen_closure_idx").on(t.capClosureId),
    index("product_detail_fountain_pen_deployment_idx").on(t.nibDeploymentId),
    check(
      "product_detail_fountain_pen_length_valid",
      sql`${t.cartridgeConverterLength} is null or ${t.cartridgeConverterLength} in ('short', 'long', 'short-and-long')`,
    ),
    check(
      "product_detail_fountain_pen_facets_valid",
      sql`${t.facetCount} is null or ${t.facetCount} between 3 and 100`,
    ),
  ],
);
/** Supported filling mechanisms for one physical family model. */
export const fountainPenFillingMechanismAssignment = pgTable(
  "fountain_pen_filling_mechanism_assignment",
  {
    penProductId: bigint("pen_product_id", { mode: "number" })
      .notNull()
      .references(() => productDetailFountainPen.id, { onDelete: "cascade" }),
    mechanismId: bigint("mechanism_id", { mode: "number" })
      .notNull()
      .references(() => fountainPenFillingMechanism.id, {
        onDelete: "restrict",
      }),
  },
  (t) => [
    primaryKey({ columns: [t.penProductId, t.mechanismId] }),
    index("fountain_pen_filling_mechanism_assignment_mechanism_idx").on(
      t.mechanismId,
    ),
  ],
);
/** Explicit nib-model compatibility when no grip-section option is selected. */
export const fountainPenCompatibleNib = pgTable(
  "fountain_pen_compatible_nib",
  {
    penProductId: bigint("pen_product_id", { mode: "number" })
      .notNull()
      .references(() => productDetailFountainPen.id, { onDelete: "cascade" }),
    nibProductId: bigint("nib_product_id", { mode: "number" })
      .notNull()
      .references(() => productDetailNib.id, { onDelete: "restrict" }),
  },
  (t) => [
    primaryKey({ columns: [t.penProductId, t.nibProductId] }),
    index("fountain_pen_compatible_nib_nib_idx").on(t.nibProductId),
  ],
);
/** Model-owned grip section and its explicit mounting/default-nib facts. */
export const fountainPenSectionOption = pgTable(
  "fountain_pen_section_option",
  {
    id: identity(),
    penProductId: bigint("pen_product_id", { mode: "number" })
      .notNull()
      .references(() => productDetailFountainPen.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    mountId: bigint("mount_id", { mode: "number" }).references(
      () => nibMount.id,
      { onDelete: "restrict" },
    ),
    defaultNibProductId: bigint("default_nib_product_id", {
      mode: "number",
    }).references(() => productDetailNib.id, { onDelete: "restrict" }),
    ...timestamps,
  },
  (t) => [
    unique("fountain_pen_section_option_id_pen_unique").on(
      t.id,
      t.penProductId,
    ),
    uniqueIndex("fountain_pen_section_option_name_unique").on(
      t.penProductId,
      sql`lower(trim(${t.name}))`,
    ),
    index("fountain_pen_section_option_mount_idx").on(t.mountId),
    index("fountain_pen_section_option_nib_idx").on(t.defaultNibProductId),
    check(
      "fountain_pen_section_option_name_valid",
      sql`char_length(trim(${t.name})) between 1 and 200`,
    ),
  ],
);
/** Explicit section-specific model fit, separate from physical size families. */
export const fountainPenSectionCompatibleNib = pgTable(
  "fountain_pen_section_compatible_nib",
  {
    sectionOptionId: bigint("section_option_id", { mode: "number" })
      .notNull()
      .references(() => fountainPenSectionOption.id, { onDelete: "cascade" }),
    nibProductId: bigint("nib_product_id", { mode: "number" })
      .notNull()
      .references(() => productDetailNib.id, { onDelete: "restrict" }),
  },
  (t) => [
    primaryKey({ columns: [t.sectionOptionId, t.nibProductId] }),
    index("fountain_pen_section_compatible_nib_nib_idx").on(t.nibProductId),
  ],
);
/** Model-owned finial profiles, without independently collectible small parts. */
export const fountainPenFinialOption = pgTable(
  "fountain_pen_finial_option",
  {
    id: identity(),
    penProductId: bigint("pen_product_id", { mode: "number" })
      .notNull()
      .references(() => productDetailFountainPen.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    ...timestamps,
  },
  (t) => [
    unique("fountain_pen_finial_option_id_pen_unique").on(t.id, t.penProductId),
    uniqueIndex("fountain_pen_finial_option_name_unique").on(
      t.penProductId,
      sql`lower(trim(${t.name}))`,
    ),
    check(
      "fountain_pen_finial_option_name_valid",
      sql`char_length(trim(${t.name})) between 1 and 200`,
    ),
  ],
);
/** Owned nib width, generic component materials, and actual plating selection. */
export const collectionDetailNib = pgTable(
  "collection_detail_nib",
  {
    id: itemId(),
    productNibId: bigint("product_nib_id", { mode: "number" })
      .notNull()
      .references(() => productDetailNib.id, { onDelete: "restrict" }),
    widthId: bigint("width_id", { mode: "number" }).references(
      () => nibWidth.id,
      { onDelete: "restrict" },
    ),
    feedMaterial: text("feed_material", {
      enum: ["plastic", "ebonite", "metal", "other", "unknown"],
    })
      .default("plastic")
      .notNull(),
    housingMaterial: text("housing_material", {
      enum: ["plastic", "ebonite", "metal", "other", "unknown"],
    })
      .default("plastic")
      .notNull(),
    platingStyle: text("plating_style", {
      enum: ["unplated", "full", "partial", "two-tone", "reverse-two-tone"],
    })
      .default("unplated")
      .notNull()
      .references(() => nibPlatingStyle.slug, { onDelete: "restrict" }),
    coatingMetalId: bigint("coating_metal_id", { mode: "number" }).references(
      () => nibPlatingMetal.id,
      { onDelete: "restrict" },
    ),
    bodyCoatingMetalId: bigint("body_coating_metal_id", {
      mode: "number",
    }).references(() => nibPlatingMetal.id, { onDelete: "restrict" }),
    tinesCoatingMetalId: bigint("tines_coating_metal_id", {
      mode: "number",
    }).references(() => nibPlatingMetal.id, { onDelete: "restrict" }),
    ...timestamps,
  },
  (t) => [
    index("collection_detail_nib_product_idx").on(t.productNibId),
    index("collection_detail_nib_width_idx").on(t.widthId),
    index("collection_detail_nib_style_idx").on(t.platingStyle),
    index("collection_detail_nib_coating_idx").on(t.coatingMetalId),
    index("collection_detail_nib_body_coating_idx").on(t.bodyCoatingMetalId),
    index("collection_detail_nib_tines_coating_idx").on(t.tinesCoatingMetalId),
    check(
      "collection_detail_nib_feed_valid",
      sql`${t.feedMaterial} in ('plastic', 'ebonite', 'metal', 'other', 'unknown')`,
    ),
    check(
      "collection_detail_nib_housing_valid",
      sql`${t.housingMaterial} in ('plastic', 'ebonite', 'metal', 'other', 'unknown')`,
    ),
    check(
      "collection_detail_nib_plating_valid",
      sql`(${t.platingStyle} = 'unplated' and ${t.coatingMetalId} is null and ${t.bodyCoatingMetalId} is null and ${t.tinesCoatingMetalId} is null) or (${t.platingStyle} = 'full' and ${t.coatingMetalId} is not null and ${t.bodyCoatingMetalId} is null and ${t.tinesCoatingMetalId} is null) or (${t.platingStyle} in ('partial', 'two-tone', 'reverse-two-tone') and ${t.coatingMetalId} is null and (${t.bodyCoatingMetalId} is not null or ${t.tinesCoatingMetalId} is not null) and (${t.platingStyle} = 'partial' or ${t.bodyCoatingMetalId} is distinct from ${t.tinesCoatingMetalId}))`,
    ),
  ],
);
/** Owned fountain pen with an explicit default/owned/none installed-nib state. */
export const collectionDetailFountainPen = pgTable(
  "collection_detail_fountain_pen",
  {
    id: itemId(),
    productFountainPenId: bigint("product_fountain_pen_id", { mode: "number" })
      .notNull()
      .references(() => productDetailFountainPen.id, { onDelete: "restrict" }),
    sectionOptionId: bigint("section_option_id", { mode: "number" }).references(
      () => fountainPenSectionOption.id,
      { onDelete: "restrict" },
    ),
    finialOptionId: bigint("finial_option_id", { mode: "number" }).references(
      () => fountainPenFinialOption.id,
      { onDelete: "restrict" },
    ),
    nibMode: text("nib_mode", { enum: ["default", "owned", "none"] })
      .default("none")
      .notNull(),
    defaultNibWidthId: bigint("default_nib_width_id", {
      mode: "number",
    }).references(() => nibWidth.id, { onDelete: "restrict" }),
    installedNibCollectionItemId: bigint("installed_nib_collection_item_id", {
      mode: "number",
    })
      .unique()
      .references(() => collectionDetailNib.id, { onDelete: "restrict" }),
    customizedNib: boolean("customized_nib").default(false).notNull(),
    ...timestamps,
  },
  (t) => [
    index("collection_detail_fountain_pen_product_idx").on(
      t.productFountainPenId,
    ),
    index("collection_detail_fountain_pen_section_idx").on(t.sectionOptionId),
    index("collection_detail_fountain_pen_finial_idx").on(t.finialOptionId),
    index("collection_detail_fountain_pen_width_idx").on(t.defaultNibWidthId),
    check(
      "collection_detail_fountain_pen_nib_state_valid",
      sql`(${t.nibMode} = 'default' and ${t.installedNibCollectionItemId} is null and not ${t.customizedNib}) or (${t.nibMode} = 'owned' and ${t.installedNibCollectionItemId} is not null and ${t.defaultNibWidthId} is null) or (${t.nibMode} = 'none' and ${t.installedNibCollectionItemId} is null and ${t.defaultNibWidthId} is null and not ${t.customizedNib})`,
    ),
  ],
);
