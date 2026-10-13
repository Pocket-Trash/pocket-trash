import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import {
  collectionItem,
  finishOption,
  product,
  productImage,
  productMaterial,
} from "./collection.js";
import { maker, mechanism } from "./scraper.js";

/** Shared creation and meaningful-update timestamps for mutable Pens entities. */
const entityTimestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
};

/**
 * Builds a generated bigint primary key for a Pens entity.
 *
 * @returns Generated identity column builder.
 */
const identity = () =>
  bigint("id", { mode: "number" })
    .primaryKey()
    .generatedAlwaysAsIdentity({ startWith: 1000 });

/**
 * Builds a product-owned shared primary key.
 *
 * @returns Product detail identity column builder.
 */
const productDetailId = () =>
  bigint("id", { mode: "number" })
    .primaryKey()
    .references(() => product.id, { onDelete: "cascade" });

/**
 * Builds a collection-item-owned shared primary key.
 *
 * @returns Collection detail identity column builder.
 */
const collectionDetailId = () =>
  bigint("id", { mode: "number" })
    .primaryKey()
    .references(() => collectionItem.id, { onDelete: "cascade" });

/** Catalog marker for a Pen product. */
export const productDetailPen = pgTable("product_detail_pen", {
  id: productDetailId(),
  ...entityTimestamps,
});

/** Shared base marker for a user-swappable Pen part product. */
export const productDetailPenPart = pgTable("product_detail_pen_part", {
  id: productDetailId(),
  ...entityTimestamps,
});

/** Catalog marker for a Pen clip product. */
export const productDetailPenClip = pgTable("product_detail_pen_clip", {
  id: productDetailId().references(() => productDetailPenPart.id, {
    onDelete: "cascade",
  }),
  ...entityTimestamps,
});

/** Catalog marker for a Pen tip product. */
export const productDetailPenTip = pgTable("product_detail_pen_tip", {
  id: productDetailId().references(() => productDetailPenPart.id, {
    onDelete: "cascade",
  }),
  ...entityTimestamps,
});

/** Catalog marker for a Pen top-cap product. */
export const productDetailPenTopCap = pgTable("product_detail_pen_top_cap", {
  id: productDetailId().references(() => productDetailPenPart.id, {
    onDelete: "cascade",
  }),
  ...entityTimestamps,
});

/** Catalog details for a physical Pen mechanism product. */
export const productDetailPenMechanism = pgTable(
  "product_detail_pen_mechanism",
  {
    id: productDetailId().references(() => productDetailPenPart.id, {
      onDelete: "cascade",
    }),
    mechanismId: bigint("mechanism_id", { mode: "number" })
      .notNull()
      .references(() => mechanism.id, { onDelete: "restrict" }),
    ...entityTimestamps,
  },
  (table) => [
    index("product_detail_pen_mechanism_type_idx").on(table.mechanismId),
  ],
);

/** Catalog marker for a standalone Pen actuator product. */
export const productDetailPenActuator = pgTable("product_detail_pen_actuator", {
  id: productDetailId().references(() => productDetailPenPart.id, {
    onDelete: "cascade",
  }),
  ...entityTimestamps,
});

/** Stable maker model identity for a refill product. */
export const productDetailRefill = pgTable(
  "product_detail_refill",
  {
    id: productDetailId(),
    makerId: bigint("maker_id", { mode: "number" }).notNull(),
    model: text("model").notNull(),
    normalizedModel: text("normalized_model").notNull(),
    ...entityTimestamps,
  },
  (table) => [
    foreignKey({
      columns: [table.id, table.makerId],
      foreignColumns: [product.id, product.makerId],
      name: "product_detail_refill_product_maker_fk",
    }).onDelete("cascade"),
    unique("product_detail_refill_maker_model_unique").on(
      table.makerId,
      table.normalizedModel,
    ),
    index("product_detail_refill_maker_id_idx").on(table.makerId),
    check(
      "product_detail_refill_model_valid",
      sql`char_length(trim(${table.model})) between 1 and 200`,
    ),
    check(
      "product_detail_refill_normalized_model_valid",
      sql`char_length(${table.normalizedModel}) between 1 and 200 and ${table.normalizedModel} = lower(trim(${table.normalizedModel}))`,
    ),
  ],
);

/** Registered canonical terminology concept. */
export const catalogTerminologyConcept = pgTable(
  "catalog_terminology_concept",
  {
    id: identity(),
    namespace: text("namespace").notNull(),
    key: text("key").notNull(),
    canonicalLabelKey: text("canonical_label_key").notNull(),
    canonicalLabelFallback: text("canonical_label_fallback").notNull(),
    normalizedCanonicalLabel: text("normalized_canonical_label").notNull(),
    ...entityTimestamps,
  },
  (table) => [
    unique("catalog_terminology_concept_id_namespace_unique").on(
      table.id,
      table.namespace,
    ),
    unique("catalog_terminology_concept_namespace_key_unique").on(
      table.namespace,
      table.key,
    ),
    unique("catalog_terminology_concept_namespace_label_unique").on(
      table.namespace,
      table.normalizedCanonicalLabel,
    ),
    check(
      "catalog_terminology_concept_namespace_valid",
      sql`char_length(trim(${table.namespace})) between 1 and 80`,
    ),
    check(
      "catalog_terminology_concept_key_valid",
      sql`char_length(trim(${table.key})) between 1 and 80`,
    ),
    check(
      "catalog_terminology_concept_label_key_valid",
      sql`char_length(trim(${table.canonicalLabelKey})) between 1 and 200`,
    ),
    check(
      "catalog_terminology_concept_label_valid",
      sql`char_length(trim(${table.canonicalLabelFallback})) between 1 and 80`,
    ),
    check(
      "catalog_terminology_concept_normalized_label_valid",
      sql`char_length(${table.normalizedCanonicalLabel}) between 1 and 80 and ${table.normalizedCanonicalLabel} = lower(trim(${table.normalizedCanonicalLabel}))`,
    ),
  ],
);

/** Audited alternate searchable name for one product. */
export const productAlias = pgTable(
  "product_alias",
  {
    id: identity(),
    productId: bigint("product_id", { mode: "number" })
      .notNull()
      .references(() => product.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    normalizedValue: text("normalized_value").notNull(),
    authoredByClerkId: text("authored_by_clerk_id"),
    ...entityTimestamps,
  },
  (table) => [
    unique("product_alias_product_value_unique").on(
      table.productId,
      table.normalizedValue,
    ),
    index("product_alias_product_id_idx").on(table.productId),
    index("product_alias_normalized_value_idx").on(table.normalizedValue),
    check(
      "product_alias_label_valid",
      sql`char_length(trim(${table.label})) between 1 and 80`,
    ),
    check(
      "product_alias_normalized_value_valid",
      sql`char_length(${table.normalizedValue}) between 1 and 80 and ${table.normalizedValue} = lower(trim(${table.normalizedValue}))`,
    ),
  ],
);

/** Functional role assigned to a Pen part. */
export const penPartRoleAssignment = pgTable(
  "pen_part_role_assignment",
  {
    partProductId: bigint("part_product_id", { mode: "number" })
      .notNull()
      .references(() => productDetailPenPart.id, { onDelete: "restrict" }),
    conceptId: bigint("concept_id", { mode: "number" }).notNull(),
    namespace: text("namespace").default("pen-part-role").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.partProductId, table.conceptId] }),
    foreignKey({
      columns: [table.conceptId, table.namespace],
      foreignColumns: [
        catalogTerminologyConcept.id,
        catalogTerminologyConcept.namespace,
      ],
      name: "pen_part_role_assignment_concept_fk",
    }).onDelete("restrict"),
    index("pen_part_role_assignment_concept_idx").on(table.conceptId),
    check(
      "pen_part_role_assignment_namespace_valid",
      sql`${table.namespace} = 'pen-part-role'`,
    ),
  ],
);

/** Nose profile assigned to a Pen or Pen-tip product. */
export const penNoseProfileAssignment = pgTable(
  "pen_nose_profile_assignment",
  {
    productId: bigint("product_id", { mode: "number" })
      .primaryKey()
      .references(() => product.id, { onDelete: "cascade" }),
    conceptId: bigint("concept_id", { mode: "number" }).notNull(),
    namespace: text("namespace").default("pen-nose-profile").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.conceptId, table.namespace],
      foreignColumns: [
        catalogTerminologyConcept.id,
        catalogTerminologyConcept.namespace,
      ],
      name: "pen_nose_profile_assignment_concept_fk",
    }).onDelete("restrict"),
    index("pen_nose_profile_assignment_concept_idx").on(table.conceptId),
    check(
      "pen_nose_profile_assignment_namespace_valid",
      sql`${table.namespace} = 'pen-nose-profile'`,
    ),
  ],
);

/** Verified physical refill-interchangeability group. */
export const refillCompatibilityGroup = pgTable(
  "refill_compatibility_group",
  {
    id: identity(),
    conceptId: bigint("concept_id", { mode: "number" }).notNull(),
    namespace: text("namespace")
      .default("refill-compatibility-group")
      .notNull(),
    ...entityTimestamps,
  },
  (table) => [
    foreignKey({
      columns: [table.conceptId, table.namespace],
      foreignColumns: [
        catalogTerminologyConcept.id,
        catalogTerminologyConcept.namespace,
      ],
      name: "refill_compatibility_group_concept_fk",
    }).onDelete("restrict"),
    unique("refill_compatibility_group_concept_unique").on(table.conceptId),
    check(
      "refill_compatibility_group_namespace_valid",
      sql`${table.namespace} = 'refill-compatibility-group'`,
    ),
  ],
);

/** Reviewed reusable product-configuration slot kind. */
export const configurationSlotKind = pgTable(
  "configuration_slot_kind",
  {
    id: identity(),
    slug: text("slug").notNull(),
    labelKey: text("label_key").notNull(),
    labelFallback: text("label_fallback").notNull(),
    ...entityTimestamps,
  },
  (table) => [
    unique("configuration_slot_kind_slug_unique").on(table.slug),
    check(
      "configuration_slot_kind_slug_valid",
      sql`char_length(trim(${table.slug})) between 1 and 80`,
    ),
  ],
);

/** Ordered independently selected dimension for a configurable product. */
export const productConfigurationSlot = pgTable(
  "product_configuration_slot",
  {
    id: identity(),
    productId: bigint("product_id", { mode: "number" })
      .notNull()
      .references(() => product.id, { onDelete: "cascade" }),
    slotKindId: bigint("slot_kind_id", { mode: "number" })
      .notNull()
      .references(() => configurationSlotKind.id, { onDelete: "restrict" }),
    position: integer("position").notNull(),
    required: boolean("required").default(false).notNull(),
    ...entityTimestamps,
  },
  (table) => [
    unique("product_configuration_slot_product_kind_unique").on(
      table.productId,
      table.slotKindId,
    ),
    unique("product_configuration_slot_product_position_unique").on(
      table.productId,
      table.position,
    ),
    unique("product_configuration_slot_id_product_unique").on(
      table.id,
      table.productId,
    ),
    index("product_configuration_slot_kind_idx").on(table.slotKindId),
    check(
      "product_configuration_slot_position_valid",
      sql`${table.position} >= 0`,
    ),
  ],
);

/** One selectable material, appearance, or Pen-part choice in a slot. */
export const productConfigurationChoice = pgTable(
  "product_configuration_choice",
  {
    id: identity(),
    productId: bigint("product_id", { mode: "number" }).notNull(),
    slotId: bigint("slot_id", { mode: "number" }).notNull(),
    position: integer("position").notNull(),
    productMaterialId: bigint("product_material_id", { mode: "number" }),
    finishOptionId: bigint("finish_option_id", { mode: "number" }),
    partProductId: bigint("part_product_id", { mode: "number" }).references(
      () => productDetailPenPart.id,
      { onDelete: "restrict" },
    ),
    ...entityTimestamps,
  },
  (table) => [
    foreignKey({
      columns: [table.slotId, table.productId],
      foreignColumns: [
        productConfigurationSlot.id,
        productConfigurationSlot.productId,
      ],
      name: "product_configuration_choice_slot_product_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.productMaterialId, table.productId],
      foreignColumns: [productMaterial.id, productMaterial.productId],
      name: "product_configuration_choice_material_product_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.finishOptionId, table.productId],
      foreignColumns: [finishOption.id, finishOption.productId],
      name: "product_configuration_choice_finish_product_fk",
    }).onDelete("restrict"),
    unique("product_configuration_choice_slot_position_unique").on(
      table.slotId,
      table.position,
    ),
    unique("product_configuration_choice_id_slot_product_unique").on(
      table.id,
      table.slotId,
      table.productId,
    ),
    unique("product_configuration_choice_id_slot_unique").on(
      table.id,
      table.slotId,
    ),
    unique("product_configuration_choice_id_product_unique").on(
      table.id,
      table.productId,
    ),
    index("product_configuration_choice_material_idx").on(
      table.productMaterialId,
    ),
    index("product_configuration_choice_finish_idx").on(table.finishOptionId),
    index("product_configuration_choice_part_idx").on(table.partProductId),
    check(
      "product_configuration_choice_carrier_valid",
      sql`num_nonnulls(${table.productMaterialId}, ${table.finishOptionId}, ${table.partProductId}) = 1`,
    ),
    check(
      "product_configuration_choice_part_distinct",
      sql`${table.partProductId} is null or ${table.partProductId} <> ${table.productId}`,
    ),
    check(
      "product_configuration_choice_position_valid",
      sql`${table.position} >= 0`,
    ),
  ],
);

/** One OR branch describing when a target choice is available. */
export const productConfigurationChoiceRule = pgTable(
  "product_configuration_choice_rule",
  {
    id: identity(),
    productId: bigint("product_id", { mode: "number" }).notNull(),
    targetChoiceId: bigint("target_choice_id", { mode: "number" }).notNull(),
    position: integer("position").notNull(),
    ...entityTimestamps,
  },
  (table) => [
    foreignKey({
      columns: [table.targetChoiceId, table.productId],
      foreignColumns: [
        productConfigurationChoice.id,
        productConfigurationChoice.productId,
      ],
      name: "product_configuration_choice_rule_target_fk",
    }).onDelete("cascade"),
    unique("product_configuration_choice_rule_target_position_unique").on(
      table.targetChoiceId,
      table.position,
    ),
    unique("product_configuration_choice_rule_id_target_product_unique").on(
      table.id,
      table.targetChoiceId,
      table.productId,
    ),
    unique("product_configuration_choice_rule_id_product_unique").on(
      table.id,
      table.productId,
    ),
    check(
      "product_configuration_choice_rule_position_valid",
      sql`${table.position} >= 0`,
    ),
  ],
);

/** One AND requirement in a product-configuration availability rule. */
export const productConfigurationChoiceRequirement = pgTable(
  "product_configuration_choice_requirement",
  {
    ruleId: bigint("rule_id", { mode: "number" }).notNull(),
    productId: bigint("product_id", { mode: "number" }).notNull(),
    requiredChoiceId: bigint("required_choice_id", {
      mode: "number",
    }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.ruleId, table.requiredChoiceId] }),
    foreignKey({
      columns: [table.ruleId, table.productId],
      foreignColumns: [
        productConfigurationChoiceRule.id,
        productConfigurationChoiceRule.productId,
      ],
      name: "product_configuration_choice_requirement_rule_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.requiredChoiceId, table.productId],
      foreignColumns: [
        productConfigurationChoice.id,
        productConfigurationChoice.productId,
      ],
      name: "product_configuration_choice_requirement_choice_fk",
    }).onDelete("restrict"),
    index("product_configuration_choice_requirement_choice_idx").on(
      table.requiredChoiceId,
    ),
  ],
);

/** Canonical tip style for refill offerings. */
export const refillTipStyle = pgTable(
  "refill_tip_style",
  {
    id: identity(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    ...entityTimestamps,
  },
  (table) => [
    uniqueIndex("refill_tip_style_name_unique").on(sql`lower(${table.name})`),
    unique("refill_tip_style_slug_unique").on(table.slug),
  ],
);

/** Canonical writing-ink color for refill offerings. */
export const refillInkColor = pgTable(
  "refill_ink_color",
  {
    id: identity(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    ...entityTimestamps,
  },
  (table) => [
    uniqueIndex("refill_ink_color_name_unique").on(sql`lower(${table.name})`),
    unique("refill_ink_color_slug_unique").on(table.slug),
  ],
);

/** Confirmed tip-size and ink-color combination sold for a refill model. */
export const refillOffering = pgTable(
  "refill_offering",
  {
    id: identity(),
    refillProductId: bigint("refill_product_id", { mode: "number" })
      .notNull()
      .references(() => productDetailRefill.id, { onDelete: "restrict" }),
    tipStyleId: bigint("tip_style_id", { mode: "number" })
      .notNull()
      .references(() => refillTipStyle.id, { onDelete: "restrict" }),
    tipSize: text("tip_size").notNull(),
    normalizedTipSize: text("normalized_tip_size").notNull(),
    inkColorId: bigint("ink_color_id", { mode: "number" })
      .notNull()
      .references(() => refillInkColor.id, { onDelete: "restrict" }),
    ...entityTimestamps,
  },
  (table) => [
    unique("refill_offering_identity_unique").on(
      table.refillProductId,
      table.tipStyleId,
      table.normalizedTipSize,
      table.inkColorId,
    ),
    unique("refill_offering_id_refill_unique").on(
      table.id,
      table.refillProductId,
    ),
    index("refill_offering_refill_idx").on(table.refillProductId),
    index("refill_offering_tip_style_idx").on(table.tipStyleId),
    index("refill_offering_ink_color_idx").on(table.inkColorId),
    check(
      "refill_offering_tip_size_valid",
      sql`char_length(trim(${table.tipSize})) between 1 and 80`,
    ),
    check(
      "refill_offering_normalized_tip_size_valid",
      sql`char_length(${table.normalizedTipSize}) between 1 and 80 and ${table.normalizedTipSize} = lower(trim(${table.normalizedTipSize}))`,
    ),
  ],
);

/** Owned Pen and its selected refill state. */
export const collectionDetailPen = pgTable(
  "collection_detail_pen",
  {
    id: collectionDetailId(),
    productPenId: bigint("product_pen_id", { mode: "number" })
      .notNull()
      .references(() => productDetailPen.id, { onDelete: "restrict" }),
    installedRefillProductId: bigint("installed_refill_product_id", {
      mode: "number",
    }).references(() => productDetailRefill.id, { onDelete: "restrict" }),
    installedRefillOfferingId: bigint("installed_refill_offering_id", {
      mode: "number",
    }),
    ...entityTimestamps,
  },
  (table) => [
    foreignKey({
      columns: [
        table.installedRefillOfferingId,
        table.installedRefillProductId,
      ],
      foreignColumns: [refillOffering.id, refillOffering.refillProductId],
      name: "collection_detail_pen_refill_offering_fk",
    }).onDelete("restrict"),
    index("collection_detail_pen_product_idx").on(table.productPenId),
    index("collection_detail_pen_refill_idx").on(
      table.installedRefillProductId,
    ),
    index("collection_detail_pen_offering_idx").on(
      table.installedRefillOfferingId,
    ),
    check(
      "collection_detail_pen_offering_requires_refill",
      sql`${table.installedRefillOfferingId} is null or ${table.installedRefillProductId} is not null`,
    ),
  ],
);

/** Owned Pen clip mapped to its catalog product. */
export const collectionDetailPenClip = pgTable(
  "collection_detail_pen_clip",
  {
    id: collectionDetailId(),
    productPenClipId: bigint("product_pen_clip_id", { mode: "number" })
      .notNull()
      .references(() => productDetailPenClip.id, { onDelete: "restrict" }),
    ...entityTimestamps,
  },
  (table) => [
    index("collection_detail_pen_clip_product_idx").on(table.productPenClipId),
  ],
);

/** Owned Pen tip mapped to its catalog product. */
export const collectionDetailPenTip = pgTable(
  "collection_detail_pen_tip",
  {
    id: collectionDetailId(),
    productPenTipId: bigint("product_pen_tip_id", { mode: "number" })
      .notNull()
      .references(() => productDetailPenTip.id, { onDelete: "restrict" }),
    ...entityTimestamps,
  },
  (table) => [
    index("collection_detail_pen_tip_product_idx").on(table.productPenTipId),
  ],
);

/** Owned Pen top cap mapped to its catalog product. */
export const collectionDetailPenTopCap = pgTable(
  "collection_detail_pen_top_cap",
  {
    id: collectionDetailId(),
    productPenTopCapId: bigint("product_pen_top_cap_id", { mode: "number" })
      .notNull()
      .references(() => productDetailPenTopCap.id, { onDelete: "restrict" }),
    ...entityTimestamps,
  },
  (table) => [
    index("collection_detail_pen_top_cap_product_idx").on(
      table.productPenTopCapId,
    ),
  ],
);

/** Owned Pen mechanism mapped to its catalog product. */
export const collectionDetailPenMechanism = pgTable(
  "collection_detail_pen_mechanism",
  {
    id: collectionDetailId(),
    productPenMechanismId: bigint("product_pen_mechanism_id", {
      mode: "number",
    })
      .notNull()
      .references(() => productDetailPenMechanism.id, { onDelete: "restrict" }),
    ...entityTimestamps,
  },
  (table) => [
    index("collection_detail_pen_mechanism_product_idx").on(
      table.productPenMechanismId,
    ),
  ],
);

/** Owned Pen actuator mapped to its catalog product. */
export const collectionDetailPenActuator = pgTable(
  "collection_detail_pen_actuator",
  {
    id: collectionDetailId(),
    productPenActuatorId: bigint("product_pen_actuator_id", { mode: "number" })
      .notNull()
      .references(() => productDetailPenActuator.id, { onDelete: "restrict" }),
    ...entityTimestamps,
  },
  (table) => [
    index("collection_detail_pen_actuator_product_idx").on(
      table.productPenActuatorId,
    ),
  ],
);

/** Saved configuration choice for one owned catalog item. */
export const collectionItemConfigurationSelection = pgTable(
  "collection_item_configuration_selection",
  {
    collectionItemId: bigint("collection_item_id", { mode: "number" })
      .notNull()
      .references(() => collectionItem.id, { onDelete: "cascade" }),
    slotId: bigint("slot_id", { mode: "number" }).notNull(),
    choiceId: bigint("choice_id", { mode: "number" }).notNull(),
    installedPartCollectionItemId: bigint("installed_part_collection_item_id", {
      mode: "number",
    }).references(() => collectionItem.id, { onDelete: "restrict" }),
    ...entityTimestamps,
  },
  (table) => [
    primaryKey({ columns: [table.collectionItemId, table.slotId] }),
    foreignKey({
      columns: [table.choiceId, table.slotId],
      foreignColumns: [
        productConfigurationChoice.id,
        productConfigurationChoice.slotId,
      ],
      name: "collection_item_configuration_selection_choice_slot_fk",
    }).onDelete("restrict"),
    index("collection_item_configuration_selection_choice_idx").on(
      table.choiceId,
    ),
    index("collection_item_configuration_selection_installed_part_idx").on(
      table.installedPartCollectionItemId,
    ),
  ],
);

/** Stable maker-source listing identity. */
export const catalogSourceListing = pgTable(
  "catalog_source_listing",
  {
    id: identity(),
    makerId: bigint("maker_id", { mode: "number" })
      .notNull()
      .references(() => maker.id, { onDelete: "restrict" }),
    sourceSystem: text("source_system").notNull(),
    sourceRecordId: text("source_record_id").notNull(),
    listingUrl: text("listing_url").notNull(),
    sourceHandle: text("source_handle"),
    ...entityTimestamps,
  },
  (table) => [
    unique("catalog_source_listing_identity_unique").on(
      table.makerId,
      table.sourceSystem,
      table.sourceRecordId,
      table.listingUrl,
    ),
    index("catalog_source_listing_source_idx").on(
      table.makerId,
      table.sourceSystem,
      table.sourceRecordId,
    ),
    index("catalog_source_listing_url_idx").on(table.listingUrl),
  ],
);

/** Maps one source listing to exactly one catalog product. */
export const productSourceListing = pgTable(
  "product_source_listing",
  {
    productId: bigint("product_id", { mode: "number" })
      .notNull()
      .references(() => product.id, { onDelete: "restrict" }),
    listingId: bigint("listing_id", { mode: "number" })
      .primaryKey()
      .references(() => catalogSourceListing.id, { onDelete: "restrict" }),
  },
  (table) => [index("product_source_listing_product_idx").on(table.productId)],
);

/** Configuration choice represented by a source listing. */
export const catalogSourceListingChoice = pgTable(
  "catalog_source_listing_choice",
  {
    listingId: bigint("listing_id", { mode: "number" })
      .notNull()
      .references(() => catalogSourceListing.id, { onDelete: "restrict" }),
    choiceId: bigint("choice_id", { mode: "number" })
      .notNull()
      .references(() => productConfigurationChoice.id, {
        onDelete: "restrict",
      }),
  },
  (table) => [
    primaryKey({ columns: [table.listingId, table.choiceId] }),
    index("catalog_source_listing_choice_choice_idx").on(table.choiceId),
  ],
);

/** Preserved source identity for an existing product image. */
export const catalogSourceImage = pgTable(
  "catalog_source_image",
  {
    id: identity(),
    listingId: bigint("listing_id", { mode: "number" })
      .notNull()
      .references(() => catalogSourceListing.id, { onDelete: "restrict" }),
    productImageId: bigint("product_image_id", { mode: "number" })
      .notNull()
      .references(() => productImage.id, { onDelete: "restrict" }),
    sourceImageId: text("source_image_id").notNull(),
    sourceUrl: text("source_url").notNull(),
    sourceHash: text("source_hash").notNull(),
    position: integer("position").notNull(),
    ...entityTimestamps,
  },
  (table) => [
    unique("catalog_source_image_listing_identity_unique").on(
      table.listingId,
      table.sourceImageId,
    ),
    unique("catalog_source_image_listing_product_image_unique").on(
      table.listingId,
      table.productImageId,
    ),
    index("catalog_source_image_product_image_idx").on(table.productImageId),
    index("catalog_source_image_url_idx").on(table.sourceUrl),
    index("catalog_source_image_hash_idx").on(table.sourceHash),
    check("catalog_source_image_position_valid", sql`${table.position} >= 0`),
  ],
);

/** Exact maker code or SKU assigned to a refill offering. */
export const refillOfferingIdentifier = pgTable(
  "refill_offering_identifier",
  {
    id: identity(),
    offeringId: bigint("offering_id", { mode: "number" })
      .notNull()
      .references(() => refillOffering.id, { onDelete: "restrict" }),
    makerId: bigint("maker_id", { mode: "number" })
      .notNull()
      .references(() => maker.id, { onDelete: "restrict" }),
    kind: text("kind", { enum: ["maker-code", "sku"] }).notNull(),
    sourceValue: text("source_value").notNull(),
    comparisonValue: text("comparison_value").notNull(),
    comparisonRule: text("comparison_rule").default("trim").notNull(),
    ...entityTimestamps,
  },
  (table) => [
    unique("refill_offering_identifier_value_unique").on(
      table.makerId,
      table.kind,
      table.comparisonValue,
    ),
    index("refill_offering_identifier_offering_idx").on(table.offeringId),
    check(
      "refill_offering_identifier_kind_valid",
      sql`${table.kind} in ('maker-code', 'sku')`,
    ),
    check(
      "refill_offering_identifier_value_valid",
      sql`char_length(trim(${table.sourceValue})) between 1 and 200 and char_length(trim(${table.comparisonValue})) between 1 and 200`,
    ),
    check(
      "refill_offering_identifier_default_comparison_valid",
      sql`${table.comparisonRule} <> 'trim' or ${table.comparisonValue} = trim(${table.sourceValue})`,
    ),
  ],
);

/** Membership of a refill model in a physical compatibility group. */
export const refillCompatibilityGroupMembership = pgTable(
  "refill_compatibility_group_membership",
  {
    id: identity(),
    groupId: bigint("group_id", { mode: "number" })
      .notNull()
      .references(() => refillCompatibilityGroup.id, { onDelete: "restrict" }),
    refillProductId: bigint("refill_product_id", { mode: "number" })
      .notNull()
      .references(() => productDetailRefill.id, { onDelete: "restrict" }),
    ...entityTimestamps,
  },
  (table) => [
    unique("refill_compatibility_group_membership_unique").on(
      table.groupId,
      table.refillProductId,
    ),
    index("refill_compatibility_group_membership_refill_idx").on(
      table.refillProductId,
    ),
  ],
);

/** Catalog compatibility statement for a Pen and refill target. */
export const refillCompatibilityAssertion = pgTable(
  "refill_compatibility_assertion",
  {
    id: identity(),
    penProductId: bigint("pen_product_id", { mode: "number" })
      .notNull()
      .references(() => productDetailPen.id, { onDelete: "restrict" }),
    requiredTipProductId: bigint("required_tip_product_id", {
      mode: "number",
    }).references(() => productDetailPenTip.id, { onDelete: "restrict" }),
    targetGroupId: bigint("target_group_id", { mode: "number" }).references(
      () => refillCompatibilityGroup.id,
      { onDelete: "restrict" },
    ),
    targetRefillProductId: bigint("target_refill_product_id", {
      mode: "number",
    }).references(() => productDetailRefill.id, { onDelete: "restrict" }),
    ...entityTimestamps,
  },
  (table) => [
    unique("refill_compatibility_assertion_scope_unique")
      .on(
        table.penProductId,
        table.requiredTipProductId,
        table.targetGroupId,
        table.targetRefillProductId,
      )
      .nullsNotDistinct(),
    index("refill_compatibility_assertion_refill_tip_idx").on(
      table.penProductId,
      table.requiredTipProductId,
      table.targetRefillProductId,
    ),
    index("refill_compatibility_assertion_group_tip_idx").on(
      table.penProductId,
      table.requiredTipProductId,
      table.targetGroupId,
    ),
    index("refill_compatibility_assertion_required_tip_idx").on(
      table.requiredTipProductId,
    ),
    index("refill_compatibility_assertion_target_group_idx").on(
      table.targetGroupId,
    ),
    index("refill_compatibility_assertion_target_refill_idx").on(
      table.targetRefillProductId,
    ),
    check(
      "refill_compatibility_assertion_target_valid",
      sql`num_nonnulls(${table.targetGroupId}, ${table.targetRefillProductId}) = 1`,
    ),
  ],
);

/** Stored row type for each Pens schema table. */
export type PensSchemaRows = {
  [Key in keyof typeof pensTables]: (typeof pensTables)[Key]["$inferSelect"];
};

/** Insert row type for each Pens schema table. */
export type NewPensSchemaRows = {
  [Key in keyof typeof pensTables]: (typeof pensTables)[Key]["$inferInsert"];
};

/** Complete named Pens table registry used to expose inferred row types. */
export const pensTables = {
  catalogSourceImage,
  catalogSourceListing,
  catalogSourceListingChoice,
  catalogTerminologyConcept,
  collectionDetailPen,
  collectionDetailPenActuator,
  collectionDetailPenClip,
  collectionDetailPenMechanism,
  collectionDetailPenTip,
  collectionDetailPenTopCap,
  collectionItemConfigurationSelection,
  configurationSlotKind,
  penNoseProfileAssignment,
  penPartRoleAssignment,
  productAlias,
  productConfigurationChoice,
  productConfigurationChoiceRequirement,
  productConfigurationChoiceRule,
  productConfigurationSlot,
  productDetailPen,
  productDetailPenActuator,
  productDetailPenClip,
  productDetailPenMechanism,
  productDetailPenPart,
  productDetailPenTip,
  productDetailPenTopCap,
  productDetailRefill,
  productSourceListing,
  refillCompatibilityAssertion,
  refillCompatibilityGroup,
  refillCompatibilityGroupMembership,
  refillInkColor,
  refillOffering,
  refillOfferingIdentifier,
  refillTipStyle,
} as const;
