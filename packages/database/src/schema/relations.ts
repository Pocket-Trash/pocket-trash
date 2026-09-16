import { relations } from "drizzle-orm";
import {
  collectionItem,
  collectionSpinner,
  collectionSpinnerButton,
  product,
  productMaterial,
  productSpinner,
  productSpinnerButton,
} from "./collection.js";
import { featureFlags, featureFlagUserOverrides } from "./feature-flags.js";
import {
  maker,
  material,
  mechanism,
  productType,
  scraperRuns,
  tmpAutmogPenMaterials,
  tmpAutmogPens,
  tmpAutmogPenVersions,
  tmpGrimsmoKnifeVariations,
  tmpGrimsmoKnifeVariationVersions,
  tmpGrimsmoKnifeVersions,
  tmpGrimsmoKnives,
  tmpGrimsmoPens,
  tmpGrimsmoPenVariations,
  tmpGrimsmoPenVariationVersions,
  tmpGrimsmoPenVersions,
  tmpImages,
  tmpProductProductTypes,
  tmpProducts,
  tmpProductVariations,
} from "./scraper.js";
import { userSettings } from "./user-settings.js";
import { user } from "./users.js";

export const usersRelations = relations(user, ({ many, one }) => ({
  collectionItems: many(collectionItem),
  settings: one(userSettings),
}));

export const userSettingsRelations = relations(userSettings, ({ one }) => ({
  user: one(user, {
    fields: [userSettings.userId],
    references: [user.id],
  }),
}));

export const featureFlagsRelations = relations(featureFlags, ({ many }) => ({
  userOverrides: many(featureFlagUserOverrides),
}));

export const featureFlagUserOverridesRelations = relations(
  featureFlagUserOverrides,
  ({ one }) => ({
    flag: one(featureFlags, {
      fields: [featureFlagUserOverrides.flagId],
      references: [featureFlags.id],
    }),
    user: one(user, {
      fields: [featureFlagUserOverrides.userId],
      references: [user.id],
    }),
  }),
);

export const makersRelations = relations(maker, ({ many }) => ({
  autmogPens: many(tmpAutmogPens),
  grimsmoKnives: many(tmpGrimsmoKnives),
  grimsmoPens: many(tmpGrimsmoPens),
  products: many(product),
}));

export const materialsRelations = relations(material, ({ many }) => ({
  autmogPens: many(tmpAutmogPenMaterials),
  products: many(productMaterial),
}));

export const mechanismsRelations = relations(mechanism, ({ many }) => ({
  autmogPens: many(tmpAutmogPens),
}));

export const productTypesRelations = relations(productType, ({ many }) => ({
  catalogProducts: many(product),
  products: many(tmpProductProductTypes),
}));

export const scraperRunsRelations = relations(scraperRuns, () => ({}));

export const collectionItemRelations = relations(collectionItem, ({ one }) => ({
  owner: one(user, {
    fields: [collectionItem.ownerId],
    references: [user.id],
  }),
  purchasedFromUser: one(user, {
    fields: [collectionItem.purchasedFromUserId],
    references: [user.id],
  }),
  soldToUser: one(user, {
    fields: [collectionItem.soldToUserId],
    references: [user.id],
  }),
  spinner: one(collectionSpinner, {
    fields: [collectionItem.id],
    references: [collectionSpinner.id],
  }),
  spinnerButton: one(collectionSpinnerButton, {
    fields: [collectionItem.id],
    references: [collectionSpinnerButton.id],
  }),
}));

export const productRelations = relations(product, ({ many, one }) => ({
  maker: one(maker, {
    fields: [product.makerId],
    references: [maker.id],
  }),
  materials: many(productMaterial),
  productType: one(productType, {
    fields: [product.productTypeId],
    references: [productType.id],
  }),
  spinner: one(productSpinner, {
    fields: [product.id],
    references: [productSpinner.id],
  }),
  spinnerButton: one(productSpinnerButton, {
    fields: [product.id],
    references: [productSpinnerButton.id],
  }),
}));

export const productMaterialRelations = relations(
  productMaterial,
  ({ one }) => ({
    material: one(material, {
      fields: [productMaterial.materialId],
      references: [material.id],
    }),
    product: one(product, {
      fields: [productMaterial.productId],
      references: [product.id],
    }),
  }),
);

export const productSpinnerRelations = relations(productSpinner, ({ one }) => ({
  product: one(product, {
    fields: [productSpinner.id],
    references: [product.id],
  }),
}));

export const productSpinnerButtonRelations = relations(
  productSpinnerButton,
  ({ one }) => ({
    product: one(product, {
      fields: [productSpinnerButton.id],
      references: [product.id],
    }),
  }),
);

export const collectionSpinnerRelations = relations(
  collectionSpinner,
  ({ one }) => ({
    item: one(collectionItem, {
      fields: [collectionSpinner.id],
      references: [collectionItem.id],
    }),
    product: one(productSpinner, {
      fields: [collectionSpinner.productSpinnerId],
      references: [productSpinner.id],
    }),
    installedButton: one(collectionSpinnerButton, {
      fields: [collectionSpinner.installedButtonId],
      references: [collectionSpinnerButton.id],
    }),
  }),
);

export const collectionSpinnerButtonRelations = relations(
  collectionSpinnerButton,
  ({ one }) => ({
    item: one(collectionItem, {
      fields: [collectionSpinnerButton.id],
      references: [collectionItem.id],
    }),
    product: one(productSpinnerButton, {
      fields: [collectionSpinnerButton.productSpinnerButtonId],
      references: [productSpinnerButton.id],
    }),
  }),
);

export const tmpAutmogPensRelations = relations(
  tmpAutmogPens,
  ({ many, one }) => ({
    maker: one(maker, {
      fields: [tmpAutmogPens.makerId],
      references: [maker.id],
    }),
    materials: many(tmpAutmogPenMaterials),
    mechanism: one(mechanism, {
      fields: [tmpAutmogPens.mechanismId],
      references: [mechanism.id],
    }),
    product: one(tmpProducts, {
      fields: [tmpAutmogPens.productId],
      references: [tmpProducts.id],
    }),
    versions: many(tmpAutmogPenVersions),
  }),
);

export const tmpAutmogPenMaterialsRelations = relations(
  tmpAutmogPenMaterials,
  ({ one }) => ({
    material: one(material, {
      fields: [tmpAutmogPenMaterials.materialId],
      references: [material.id],
    }),
    pen: one(tmpAutmogPens, {
      fields: [tmpAutmogPenMaterials.penId],
      references: [tmpAutmogPens.id],
    }),
  }),
);

export const tmpProductsRelations = relations(tmpProducts, ({ many, one }) => ({
  autmogPen: one(tmpAutmogPens, {
    fields: [tmpProducts.id],
    references: [tmpAutmogPens.productId],
  }),
  grimsmoKnife: one(tmpGrimsmoKnives, {
    fields: [tmpProducts.id],
    references: [tmpGrimsmoKnives.productId],
  }),
  grimsmoPen: one(tmpGrimsmoPens, {
    fields: [tmpProducts.id],
    references: [tmpGrimsmoPens.productId],
  }),
  images: many(tmpImages),
  productTypes: many(tmpProductProductTypes),
  variations: many(tmpProductVariations),
}));

export const tmpProductVariationsRelations = relations(
  tmpProductVariations,
  ({ many, one }) => ({
    grimsmoKnifeVariation: one(tmpGrimsmoKnifeVariations, {
      fields: [tmpProductVariations.id],
      references: [tmpGrimsmoKnifeVariations.productVariationId],
    }),
    grimsmoPenVariation: one(tmpGrimsmoPenVariations, {
      fields: [tmpProductVariations.id],
      references: [tmpGrimsmoPenVariations.productVariationId],
    }),
    images: many(tmpImages),
    product: one(tmpProducts, {
      fields: [tmpProductVariations.productId],
      references: [tmpProducts.id],
    }),
  }),
);

export const tmpProductProductTypesRelations = relations(
  tmpProductProductTypes,
  ({ one }) => ({
    product: one(tmpProducts, {
      fields: [tmpProductProductTypes.productId],
      references: [tmpProducts.id],
    }),
    productType: one(productType, {
      fields: [tmpProductProductTypes.productTypeId],
      references: [productType.id],
    }),
  }),
);

export const tmpImagesRelations = relations(tmpImages, ({ one }) => ({
  product: one(tmpProducts, {
    fields: [tmpImages.productId],
    references: [tmpProducts.id],
  }),
  productVariation: one(tmpProductVariations, {
    fields: [tmpImages.productVariationId],
    references: [tmpProductVariations.id],
  }),
}));

export const tmpAutmogPenVersionsRelations = relations(
  tmpAutmogPenVersions,
  ({ one }) => ({
    pen: one(tmpAutmogPens, {
      fields: [tmpAutmogPenVersions.penId],
      references: [tmpAutmogPens.id],
    }),
  }),
);

export const tmpGrimsmoPensRelations = relations(
  tmpGrimsmoPens,
  ({ many, one }) => ({
    maker: one(maker, {
      fields: [tmpGrimsmoPens.makerId],
      references: [maker.id],
    }),
    product: one(tmpProducts, {
      fields: [tmpGrimsmoPens.productId],
      references: [tmpProducts.id],
    }),
    variations: many(tmpGrimsmoPenVariations),
    versions: many(tmpGrimsmoPenVersions),
  }),
);

export const tmpGrimsmoPenVariationsRelations = relations(
  tmpGrimsmoPenVariations,
  ({ many, one }) => ({
    pen: one(tmpGrimsmoPens, {
      fields: [tmpGrimsmoPenVariations.penId],
      references: [tmpGrimsmoPens.id],
    }),
    productVariation: one(tmpProductVariations, {
      fields: [tmpGrimsmoPenVariations.productVariationId],
      references: [tmpProductVariations.id],
    }),
    versions: many(tmpGrimsmoPenVariationVersions),
  }),
);

export const tmpGrimsmoPenVersionsRelations = relations(
  tmpGrimsmoPenVersions,
  ({ one }) => ({
    pen: one(tmpGrimsmoPens, {
      fields: [tmpGrimsmoPenVersions.penId],
      references: [tmpGrimsmoPens.id],
    }),
  }),
);

export const tmpGrimsmoPenVariationVersionsRelations = relations(
  tmpGrimsmoPenVariationVersions,
  ({ one }) => ({
    variation: one(tmpGrimsmoPenVariations, {
      fields: [tmpGrimsmoPenVariationVersions.variationId],
      references: [tmpGrimsmoPenVariations.id],
    }),
  }),
);

export const tmpGrimsmoKnivesRelations = relations(
  tmpGrimsmoKnives,
  ({ many, one }) => ({
    maker: one(maker, {
      fields: [tmpGrimsmoKnives.makerId],
      references: [maker.id],
    }),
    product: one(tmpProducts, {
      fields: [tmpGrimsmoKnives.productId],
      references: [tmpProducts.id],
    }),
    variations: many(tmpGrimsmoKnifeVariations),
    versions: many(tmpGrimsmoKnifeVersions),
  }),
);

export const tmpGrimsmoKnifeVariationsRelations = relations(
  tmpGrimsmoKnifeVariations,
  ({ many, one }) => ({
    knife: one(tmpGrimsmoKnives, {
      fields: [tmpGrimsmoKnifeVariations.knifeId],
      references: [tmpGrimsmoKnives.id],
    }),
    productVariation: one(tmpProductVariations, {
      fields: [tmpGrimsmoKnifeVariations.productVariationId],
      references: [tmpProductVariations.id],
    }),
    versions: many(tmpGrimsmoKnifeVariationVersions),
  }),
);

export const tmpGrimsmoKnifeVersionsRelations = relations(
  tmpGrimsmoKnifeVersions,
  ({ one }) => ({
    knife: one(tmpGrimsmoKnives, {
      fields: [tmpGrimsmoKnifeVersions.knifeId],
      references: [tmpGrimsmoKnives.id],
    }),
  }),
);

export const tmpGrimsmoKnifeVariationVersionsRelations = relations(
  tmpGrimsmoKnifeVariationVersions,
  ({ one }) => ({
    variation: one(tmpGrimsmoKnifeVariations, {
      fields: [tmpGrimsmoKnifeVariationVersions.variationId],
      references: [tmpGrimsmoKnifeVariations.id],
    }),
  }),
);
