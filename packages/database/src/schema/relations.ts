import { relations } from "drizzle-orm";
import {
  collectionImage,
  collectionItem,
  collectionItemImage,
  collectionSpinner,
  collectionSpinnerButton,
  color,
  colorEffect,
  finish,
  finishOption,
  finishOptionColor,
  finishOptionFinish,
  makerImage,
  materialImage,
  pattern,
  product,
  productImage,
  productMaterial,
  productSpinner,
  productSpinnerButton,
  userCollection,
} from "./collection.js";
import { featureFlags, featureFlagUserOverrides } from "./feature-flags.js";
import {
  resourceCategories,
  resourceDownloads,
  resourceFiles,
  resourceImages,
  resourceNotifications,
  resources,
  resourcesToCategories,
  resourceVersions,
} from "./resources.js";
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
import { uploadFile, uploadSession } from "./uploads.js";
import { userSettings } from "./user-settings.js";
import { user } from "./users.js";

/** Connects an application user to owned collections, items, and settings. */
export const usersRelations = relations(user, ({ many, one }) => ({
  collections: many(userCollection),
  collectionItems: many(collectionItem),
  settings: one(userSettings),
}));

/** Connects a user collection to its owner, images, and items. */
export const userCollectionRelations = relations(
  userCollection,
  ({ many, one }) => ({
    images: many(collectionImage),
    items: many(collectionItem),
    owner: one(user, {
      fields: [userCollection.ownerId],
      references: [user.id],
    }),
  }),
);

/** Connects user settings to their application user. */
export const userSettingsRelations = relations(userSettings, ({ one }) => ({
  user: one(user, {
    fields: [userSettings.userId],
    references: [user.id],
  }),
}));

/** Connects a resource to its categories, images, notifications, and versions. */
export const resourcesRelations = relations(resources, ({ many }) => ({
  categories: many(resourcesToCategories),
  images: many(resourceImages),
  notifications: many(resourceNotifications),
  versions: many(resourceVersions),
}));

/** Connects a resource image to its resource. */
export const resourceImagesRelations = relations(resourceImages, ({ one }) => ({
  resource: one(resources, {
    fields: [resourceImages.resourceId],
    references: [resources.id],
  }),
}));

/** Connects a resource version to its resource, downloads, and files. */
export const resourceVersionsRelations = relations(
  resourceVersions,
  ({ many, one }) => ({
    downloads: many(resourceDownloads),
    files: many(resourceFiles),
    resource: one(resources, {
      fields: [resourceVersions.resourceId],
      references: [resources.id],
    }),
  }),
);

/** Connects a collection image to its collection. */
export const collectionImageRelations = relations(
  collectionImage,
  ({ one }) => ({
    collection: one(userCollection, {
      fields: [collectionImage.collectionId],
      references: [userCollection.id],
    }),
  }),
);

/** Connects a resource file to its immutable resource version. */
export const resourceFilesRelations = relations(resourceFiles, ({ one }) => ({
  version: one(resourceVersions, {
    fields: [resourceFiles.versionId],
    references: [resourceVersions.id],
  }),
}));

/** Connects a resource category to assignments and category notifications. */
export const resourceCategoriesRelations = relations(
  resourceCategories,
  ({ many }) => ({
    notifications: many(resourceNotifications),
    resources: many(resourcesToCategories),
  }),
);

/** Connects a resource notification to its resource and optional category subjects. */
export const resourceNotificationsRelations = relations(
  resourceNotifications,
  ({ one }) => ({
    category: one(resourceCategories, {
      fields: [resourceNotifications.categoryId],
      references: [resourceCategories.id],
    }),
    resource: one(resources, {
      fields: [resourceNotifications.resourceId],
      references: [resources.id],
    }),
  }),
);

/** Connects each resource-category assignment to its resource and category. */
export const resourcesToCategoriesRelations = relations(
  resourcesToCategories,
  ({ one }) => ({
    category: one(resourceCategories, {
      fields: [resourcesToCategories.categoryId],
      references: [resourceCategories.id],
    }),
    resource: one(resources, {
      fields: [resourcesToCategories.resourceId],
      references: [resources.id],
    }),
  }),
);

/** Connects a resource download to the downloaded version. */
export const resourceDownloadsRelations = relations(
  resourceDownloads,
  ({ one }) => ({
    version: one(resourceVersions, {
      fields: [resourceDownloads.versionId],
      references: [resourceVersions.id],
    }),
  }),
);

/** Connects a feature flag to its per-user overrides. */
export const featureFlagsRelations = relations(featureFlags, ({ many }) => ({
  userOverrides: many(featureFlagUserOverrides),
}));

/** Connects a feature-flag override to its flag and user. */
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

/** Connects a maker to catalog products and staged Autmog, Grimsmo pen, and Grimsmo knife records. */
export const makersRelations = relations(maker, ({ many }) => ({
  autmogPens: many(tmpAutmogPens),
  grimsmoKnives: many(tmpGrimsmoKnives),
  grimsmoPens: many(tmpGrimsmoPens),
  images: many(makerImage),
  products: many(product),
}));

/** Connects a maker image to its maker profile. */
export const makerImageRelations = relations(makerImage, ({ one }) => ({
  maker: one(maker, {
    fields: [makerImage.makerId],
    references: [maker.id],
  }),
}));

/** Connects a material to catalog products, collection items, and staged Autmog pens. */
export const materialsRelations = relations(material, ({ many }) => ({
  autmogPens: many(tmpAutmogPenMaterials),
  collectionItems: many(collectionItem),
  images: many(materialImage),
  products: many(productMaterial),
}));

/** Connects a material image to its shared material. */
export const materialImageRelations = relations(materialImage, ({ one }) => ({
  material: one(material, {
    fields: [materialImage.materialId],
    references: [material.id],
  }),
}));

/** Connects a mechanism to staged Autmog pens. */
export const mechanismsRelations = relations(mechanism, ({ many }) => ({
  autmogPens: many(tmpAutmogPens),
}));

/** Connects a product type to catalog products and staged product assignments. */
export const productTypesRelations = relations(productType, ({ many }) => ({
  catalogProducts: many(product),
  products: many(tmpProductProductTypes),
}));

/** Scraper-run relation metadata reserved for query composition. */
export const scraperRunsRelations = relations(scraperRuns, () => ({}));

/** Connects a collection item to its collection, owner, trade users, catalog details, images, finish, and spinner data. */
export const collectionItemRelations = relations(
  collectionItem,
  ({ many, one }) => ({
    collection: one(userCollection, {
      fields: [collectionItem.collectionId],
      references: [userCollection.id],
    }),
    finishOption: one(finishOption),
    images: many(collectionItemImage),
    material: one(material, {
      fields: [collectionItem.materialId],
      references: [material.id],
    }),
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
  }),
);

/** Connects a collection-item image to its item. */
export const collectionItemImageRelations = relations(
  collectionItemImage,
  ({ one }) => ({
    collectionItem: one(collectionItem, {
      fields: [collectionItemImage.collectionItemId],
      references: [collectionItem.id],
    }),
  }),
);

/** Connects a catalog product to its maker, type, finishes, images, materials, and spinner data. */
export const productRelations = relations(product, ({ many, one }) => ({
  finishOptions: many(finishOption),
  images: many(productImage),
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

/** Connects a product image to its catalog product. */
export const productImageRelations = relations(productImage, ({ one }) => ({
  product: one(product, {
    fields: [productImage.productId],
    references: [product.id],
  }),
}));

/** Connects each product-material assignment to its product and material. */
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

/** Connects a finish to the finish options that include it. */
export const finishesRelations = relations(finish, ({ many }) => ({
  options: many(finishOptionFinish),
}));

/** Connects a color to the finish options that include it. */
export const colorsRelations = relations(color, ({ many }) => ({
  options: many(finishOptionColor),
}));

/** Connects a color effect to finish options that use it. */
export const colorEffectsRelations = relations(colorEffect, ({ many }) => ({
  options: many(finishOption),
}));

/** Connects a pattern to finish options that use it. */
export const patternsRelations = relations(pattern, ({ many }) => ({
  options: many(finishOption),
}));

/** Connects a finish option to its product or item, source and derived options, color effect, colors, and finishes. */
export const finishOptionRelations = relations(
  finishOption,
  ({ many, one }) => ({
    product: one(product, {
      fields: [finishOption.productId],
      references: [product.id],
    }),
    collectionItem: one(collectionItem, {
      fields: [finishOption.collectionItemId],
      references: [collectionItem.id],
    }),
    sourceProductFinishOption: one(finishOption, {
      fields: [finishOption.sourceProductFinishOptionId],
      references: [finishOption.id],
      relationName: "finishOptionSource",
    }),
    derivedCollectionOptions: many(finishOption, {
      relationName: "finishOptionSource",
    }),
    colorEffect: one(colorEffect, {
      fields: [finishOption.colorEffectId],
      references: [colorEffect.id],
    }),
    pattern: one(pattern, {
      fields: [finishOption.patternId],
      references: [pattern.id],
    }),
    colors: many(finishOptionColor),
    finishes: many(finishOptionFinish),
  }),
);

/** Connects each finish-option assignment to its option and finish. */
export const finishOptionFinishRelations = relations(
  finishOptionFinish,
  ({ one }) => ({
    finishOption: one(finishOption, {
      fields: [finishOptionFinish.finishOptionId],
      references: [finishOption.id],
    }),
    finish: one(finish, {
      fields: [finishOptionFinish.finishId],
      references: [finish.id],
    }),
  }),
);

/** Connects each finish-option color assignment to its option and color. */
export const finishOptionColorRelations = relations(
  finishOptionColor,
  ({ one }) => ({
    finishOption: one(finishOption, {
      fields: [finishOptionColor.finishOptionId],
      references: [finishOption.id],
    }),
    color: one(color, {
      fields: [finishOptionColor.colorId],
      references: [color.id],
    }),
  }),
);

/** Connects product spinner measurements to their catalog product. */
export const productSpinnerRelations = relations(productSpinner, ({ one }) => ({
  product: one(product, {
    fields: [productSpinner.id],
    references: [product.id],
  }),
}));

/** Connects product spinner-button measurements to their catalog product. */
export const productSpinnerButtonRelations = relations(
  productSpinnerButton,
  ({ one }) => ({
    product: one(product, {
      fields: [productSpinnerButton.id],
      references: [product.id],
    }),
  }),
);

/** Connects a collection spinner to its item, catalog spinner, and installed button. */
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

/** Connects a collection spinner button to its item and catalog button. */
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

/** Connects a staged Autmog pen to its maker, materials, mechanism, product, and versions. */
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

/** Connects each staged Autmog pen-material assignment to its pen and material. */
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

/** Connects a staged product to source-specific details, images, product types, and variations. */
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

/** Connects a staged product variation to its product, images, and source-specific details. */
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

/** Connects each staged product-type assignment to its product and type. */
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

/** Connects a staged image to its product and optional variation. */
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

/** Connects an Autmog pen snapshot to its staged pen. */
export const tmpAutmogPenVersionsRelations = relations(
  tmpAutmogPenVersions,
  ({ one }) => ({
    pen: one(tmpAutmogPens, {
      fields: [tmpAutmogPenVersions.penId],
      references: [tmpAutmogPens.id],
    }),
  }),
);

/** Connects a staged Grimsmo pen to its maker, product, variations, and versions. */
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

/** Connects a staged Grimsmo pen variation to its pen, normalized variation, and versions. */
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

/** Connects a Grimsmo pen snapshot to its staged pen. */
export const tmpGrimsmoPenVersionsRelations = relations(
  tmpGrimsmoPenVersions,
  ({ one }) => ({
    pen: one(tmpGrimsmoPens, {
      fields: [tmpGrimsmoPenVersions.penId],
      references: [tmpGrimsmoPens.id],
    }),
  }),
);

/** Connects a Grimsmo pen-variation snapshot to its staged variation. */
export const tmpGrimsmoPenVariationVersionsRelations = relations(
  tmpGrimsmoPenVariationVersions,
  ({ one }) => ({
    variation: one(tmpGrimsmoPenVariations, {
      fields: [tmpGrimsmoPenVariationVersions.variationId],
      references: [tmpGrimsmoPenVariations.id],
    }),
  }),
);

/** Connects a staged Grimsmo knife to its maker, product, variations, and versions. */
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

/** Connects a staged Grimsmo knife variation to its knife, normalized variation, and versions. */
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

/** Connects a Grimsmo knife snapshot to its staged knife. */
export const tmpGrimsmoKnifeVersionsRelations = relations(
  tmpGrimsmoKnifeVersions,
  ({ one }) => ({
    knife: one(tmpGrimsmoKnives, {
      fields: [tmpGrimsmoKnifeVersions.knifeId],
      references: [tmpGrimsmoKnives.id],
    }),
  }),
);

/** Connects a Grimsmo knife-variation snapshot to its staged variation. */
export const tmpGrimsmoKnifeVariationVersionsRelations = relations(
  tmpGrimsmoKnifeVariationVersions,
  ({ one }) => ({
    variation: one(tmpGrimsmoKnifeVariations, {
      fields: [tmpGrimsmoKnifeVariationVersions.variationId],
      references: [tmpGrimsmoKnifeVariations.id],
    }),
  }),
);

/** Connects an upload session to its files. */
export const uploadSessionRelations = relations(uploadSession, ({ many }) => ({
  files: many(uploadFile),
}));
/** Connects an upload file to its session. */
export const uploadFileRelations = relations(uploadFile, ({ one }) => ({
  session: one(uploadSession, {
    fields: [uploadFile.sessionId],
    references: [uploadSession.id],
  }),
}));
