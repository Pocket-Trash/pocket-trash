import { relations } from "drizzle-orm";
import { featureFlags, featureFlagUserOverrides } from "./feature-flags.js";
import {
  resourceCategories,
  resourceDownloads,
  resourceFiles,
  resourceNotifications,
  resources,
  resourcesToCategories,
  resourceUploadFiles,
  resourceUploadSessions,
  resourceVersions,
} from "./resources.js";
import {
  makers,
  materials,
  mechanisms,
  productTypes,
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
import { users } from "./users.js";

export const usersRelations = relations(users, ({ one }) => ({
  settings: one(userSettings),
}));

export const userSettingsRelations = relations(userSettings, ({ one }) => ({
  user: one(users, {
    fields: [userSettings.userId],
    references: [users.id],
  }),
}));

export const resourcesRelations = relations(resources, ({ many }) => ({
  categories: many(resourcesToCategories),
  notifications: many(resourceNotifications),
  versions: many(resourceVersions),
  completedUploadSessions: many(resourceUploadSessions, {
    relationName: "resourceUploadSessionCompletedResource",
  }),
  uploadSessions: many(resourceUploadSessions, {
    relationName: "resourceUploadSessionTarget",
  }),
}));

export const resourceVersionsRelations = relations(
  resourceVersions,
  ({ many, one }) => ({
    files: many(resourceFiles),
    legacyDownloads: many(resourceDownloads),
    resource: one(resources, {
      fields: [resourceVersions.resourceId],
      references: [resources.id],
    }),
  }),
);

export const resourceFilesRelations = relations(
  resourceFiles,
  ({ many, one }) => ({
    downloads: many(resourceDownloads),
    version: one(resourceVersions, {
      fields: [resourceFiles.versionId],
      references: [resourceVersions.id],
    }),
  }),
);

export const resourceUploadSessionsRelations = relations(
  resourceUploadSessions,
  ({ many, one }) => ({
    files: many(resourceUploadFiles),
    resource: one(resources, {
      fields: [resourceUploadSessions.resourceId],
      references: [resources.id],
      relationName: "resourceUploadSessionTarget",
    }),
    completedResource: one(resources, {
      fields: [resourceUploadSessions.completedResourceId],
      references: [resources.id],
      relationName: "resourceUploadSessionCompletedResource",
    }),
  }),
);

export const resourceUploadFilesRelations = relations(
  resourceUploadFiles,
  ({ one }) => ({
    session: one(resourceUploadSessions, {
      fields: [resourceUploadFiles.sessionId],
      references: [resourceUploadSessions.id],
    }),
  }),
);

export const resourceCategoriesRelations = relations(
  resourceCategories,
  ({ many }) => ({
    notifications: many(resourceNotifications),
    resources: many(resourcesToCategories),
  }),
);

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

export const resourceDownloadsRelations = relations(
  resourceDownloads,
  ({ one }) => ({
    file: one(resourceFiles, {
      fields: [resourceDownloads.fileId],
      references: [resourceFiles.id],
    }),
    legacyVersion: one(resourceVersions, {
      fields: [resourceDownloads.versionId],
      references: [resourceVersions.id],
    }),
  }),
);

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
    user: one(users, {
      fields: [featureFlagUserOverrides.userId],
      references: [users.id],
    }),
  }),
);

export const makersRelations = relations(makers, ({ many }) => ({
  autmogPens: many(tmpAutmogPens),
  grimsmoKnives: many(tmpGrimsmoKnives),
  grimsmoPens: many(tmpGrimsmoPens),
}));

export const materialsRelations = relations(materials, ({ many }) => ({
  autmogPens: many(tmpAutmogPenMaterials),
}));

export const mechanismsRelations = relations(mechanisms, ({ many }) => ({
  autmogPens: many(tmpAutmogPens),
}));

export const productTypesRelations = relations(productTypes, ({ many }) => ({
  products: many(tmpProductProductTypes),
}));

export const scraperRunsRelations = relations(scraperRuns, () => ({}));

export const tmpAutmogPensRelations = relations(
  tmpAutmogPens,
  ({ many, one }) => ({
    maker: one(makers, {
      fields: [tmpAutmogPens.makerId],
      references: [makers.id],
    }),
    materials: many(tmpAutmogPenMaterials),
    mechanism: one(mechanisms, {
      fields: [tmpAutmogPens.mechanismId],
      references: [mechanisms.id],
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
    material: one(materials, {
      fields: [tmpAutmogPenMaterials.materialId],
      references: [materials.id],
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
    productType: one(productTypes, {
      fields: [tmpProductProductTypes.productTypeId],
      references: [productTypes.id],
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
    maker: one(makers, {
      fields: [tmpGrimsmoPens.makerId],
      references: [makers.id],
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
    maker: one(makers, {
      fields: [tmpGrimsmoKnives.makerId],
      references: [makers.id],
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
