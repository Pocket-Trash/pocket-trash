import { defineRelations } from "drizzle-orm";
import * as auditSchema from "./audit.js";
import * as catalogImportSchema from "./catalog-import.js";
import * as collectionSchema from "./collection.js";
import * as erasureSchema from "./erasure.js";
import * as featureFlagSchema from "./feature-flags.js";
import * as feedbackSchema from "./feedback.js";
import * as resourceSchema from "./resources.js";
import * as scraperSchema from "./scraper.js";
import * as uploadSchema from "./uploads.js";
import * as userSettingsSchema from "./user-settings.js";
import * as userSchema from "./users.js";

/** All schema tables available to the relational query builder. */
const tables = {
  ...auditSchema,
  ...catalogImportSchema,
  ...collectionSchema,
  ...erasureSchema,
  ...featureFlagSchema,
  ...feedbackSchema,
  ...resourceSchema,
  ...scraperSchema,
  ...uploadSchema,
  ...userSettingsSchema,
  ...userSchema,
};

/** Runtime relations using v1 metadata and the final subtype tables. */
export const relations = defineRelations(tables, (r) => ({
  user: {
    collections: r.many.userCollection(),
    collectionItems: r.many.collectionItem({
      from: r.user.id,
      to: r.collectionItem.ownerId,
    }),
    settings: r.one.userSettings(),
  },
  userCollection: {
    images: r.many.collectionImage(),
    items: r.many.collectionItem(),
    owner: r.one.user({
      from: [r.userCollection.ownerId],
      to: [r.user.id],
    }),
  },
  userSettings: {
    user: r.one.user({
      from: [r.userSettings.userId],
      to: [r.user.id],
    }),
  },
  resources: {
    categories: r.many.resourcesToCategories(),
    images: r.many.resourceImages(),
    notifications: r.many.resourceNotifications(),
    versions: r.many.resourceVersions(),
  },
  resourceImages: {
    resource: r.one.resources({
      from: [r.resourceImages.resourceId],
      to: [r.resources.id],
    }),
  },
  resourceVersions: {
    downloads: r.many.resourceDownloads(),
    files: r.many.resourceFiles(),
    resource: r.one.resources({
      from: [r.resourceVersions.resourceId],
      to: [r.resources.id],
    }),
  },
  collectionImage: {
    collection: r.one.userCollection({
      from: [r.collectionImage.collectionId],
      to: [r.userCollection.id],
    }),
  },
  resourceFiles: {
    version: r.one.resourceVersions({
      from: [r.resourceFiles.versionId],
      to: [r.resourceVersions.id],
    }),
  },
  resourceCategories: {
    notifications: r.many.resourceNotifications(),
    resources: r.many.resourcesToCategories(),
  },
  resourceNotifications: {
    category: r.one.resourceCategories({
      from: [r.resourceNotifications.categoryId],
      to: [r.resourceCategories.id],
    }),
    resource: r.one.resources({
      from: [r.resourceNotifications.resourceId],
      to: [r.resources.id],
    }),
  },
  resourcesToCategories: {
    category: r.one.resourceCategories({
      from: [r.resourcesToCategories.categoryId],
      to: [r.resourceCategories.id],
    }),
    resource: r.one.resources({
      from: [r.resourcesToCategories.resourceId],
      to: [r.resources.id],
    }),
  },
  resourceDownloads: {
    version: r.one.resourceVersions({
      from: [r.resourceDownloads.versionId],
      to: [r.resourceVersions.id],
    }),
  },
  featureFlags: {
    userOverrides: r.many.featureFlagUserOverrides(),
  },
  featureFlagUserOverrides: {
    flag: r.one.featureFlags({
      from: [r.featureFlagUserOverrides.flagId],
      to: [r.featureFlags.id],
    }),
    user: r.one.user({
      from: [r.featureFlagUserOverrides.userId],
      to: [r.user.id],
    }),
  },
  maker: {
    autmogPens: r.many.tmpAutmogPens(),
    catalogTerminologyAliases: r.many.catalogTerminologyAlias(),
    grimsmoKnives: r.many.tmpGrimsmoKnives(),
    grimsmoPens: r.many.tmpGrimsmoPens(),
    images: r.many.makerImage(),
    products: r.many.product(),
  },
  makerImage: {
    maker: r.one.maker({
      from: [r.makerImage.makerId],
      to: [r.maker.id],
    }),
  },
  catalogTerminologyAlias: {
    maker: r.one.maker({
      from: [r.catalogTerminologyAlias.makerId],
      to: [r.maker.id],
    }),
    productType: r.one.productType({
      from: [r.catalogTerminologyAlias.canonicalKey],
      to: [r.productType.slug],
    }),
  },
  material: {
    autmogPens: r.many.tmpAutmogPenMaterials(),
    collectionItems: r.many.collectionItem(),
    images: r.many.materialImage(),
    products: r.many.productMaterial(),
  },
  materialImage: {
    material: r.one.material({
      from: [r.materialImage.materialId],
      to: [r.material.id],
    }),
  },
  mechanism: {
    autmogPens: r.many.tmpAutmogPens(),
  },
  productType: {
    catalogTerminologyAliases: r.many.catalogTerminologyAlias(),
    catalogProducts: r.many.product(),
    products: r.many.tmpProductProductTypes(),
  },
  scraperRuns: {},
  collectionItem: {
    collection: r.one.userCollection({
      from: [r.collectionItem.collectionId],
      to: [r.userCollection.id],
    }),
    finishOption: r.one.finishOption(),
    images: r.many.collectionItemImage(),
    material: r.one.material({
      from: [r.collectionItem.materialId],
      to: [r.material.id],
    }),
    owner: r.one.user({
      from: [r.collectionItem.ownerId],
      to: [r.user.id],
    }),
    // V1 relation keys cannot shadow the free-text counterparty columns.
    purchasedFromAccount: r.one.user({
      from: [r.collectionItem.purchasedFromUserId],
      to: [r.user.id],
    }),
    soldToAccount: r.one.user({
      from: [r.collectionItem.soldToUserId],
      to: [r.user.id],
    }),
    spinner: r.one.collectionDetailSpinner({
      from: [r.collectionItem.id],
      to: [r.collectionDetailSpinner.id],
    }),
    spinnerButton: r.one.collectionDetailSpinnerButton({
      from: [r.collectionItem.id],
      to: [r.collectionDetailSpinnerButton.id],
    }),
    slider: r.one.collectionDetailSlider({
      from: [r.collectionItem.id],
      to: [r.collectionDetailSlider.id],
    }),
    sliderInsert: r.one.collectionDetailSliderInsert({
      from: [r.collectionItem.id],
      to: [r.collectionDetailSliderInsert.id],
    }),
    sliderPlate: r.one.collectionDetailSliderPlate({
      from: [r.collectionItem.id],
      to: [r.collectionDetailSliderPlate.id],
    }),
  },
  collectionItemImage: {
    collectionItem: r.one.collectionItem({
      from: [r.collectionItemImage.collectionItemId],
      to: [r.collectionItem.id],
    }),
  },
  product: {
    finishOptions: r.many.finishOption(),
    images: r.many.productImage(),
    maker: r.one.maker({
      from: [r.product.makerId],
      to: [r.maker.id],
    }),
    materials: r.many.productMaterial(),
    includedAsSliderPlate: r.many.productDetailSlider({
      alias: "includedSliderPlate",
    }),
    includedAsSliderInsert: r.many.productDetailSlider({
      alias: "includedSliderInsert",
    }),
    productType: r.one.productType({
      from: [r.product.productTypeId],
      to: [r.productType.id],
    }),
    spinner: r.one.productDetailSpinner({
      from: [r.product.id],
      to: [r.productDetailSpinner.id],
    }),
    spinnerButton: r.one.productDetailSpinnerButton({
      from: [r.product.id],
      to: [r.productDetailSpinnerButton.id],
    }),
    slider: r.one.productDetailSlider({
      from: [r.product.id],
      to: [r.productDetailSlider.id],
    }),
    sliderInsert: r.one.productDetailSliderInsert({
      from: [r.product.id],
      to: [r.productDetailSliderInsert.id],
    }),
    sliderPlate: r.one.productDetailSliderPlate({
      from: [r.product.id],
      to: [r.productDetailSliderPlate.id],
    }),
  },
  productImage: {
    product: r.one.product({
      from: [r.productImage.productId],
      to: [r.product.id],
    }),
  },
  productMaterial: {
    material: r.one.material({
      from: [r.productMaterial.materialId],
      to: [r.material.id],
    }),
    product: r.one.product({
      from: [r.productMaterial.productId],
      to: [r.product.id],
    }),
  },
  finish: {
    options: r.many.finishOptionFinish(),
  },
  color: {
    options: r.many.finishOptionColor(),
  },
  colorEffect: {
    options: r.many.finishOption(),
  },
  pattern: {
    options: r.many.finishOption(),
  },
  finishOption: {
    product: r.one.product({
      from: [r.finishOption.productId],
      to: [r.product.id],
    }),
    collectionItem: r.one.collectionItem({
      from: [r.finishOption.collectionItemId],
      to: [r.collectionItem.id],
    }),
    sourceProductFinishOption: r.one.finishOption({
      from: [r.finishOption.sourceProductFinishOptionId],
      to: [r.finishOption.id],
      alias: "finishOptionSource",
    }),
    derivedCollectionOptions: r.many.finishOption({
      alias: "finishOptionSource",
    }),
    colorEffect: r.one.colorEffect({
      from: [r.finishOption.colorEffectId],
      to: [r.colorEffect.id],
    }),
    pattern: r.one.pattern({
      from: [r.finishOption.patternId],
      to: [r.pattern.id],
    }),
    colors: r.many.finishOptionColor(),
    finishes: r.many.finishOptionFinish(),
  },
  finishOptionFinish: {
    finishOption: r.one.finishOption({
      from: [r.finishOptionFinish.finishOptionId],
      to: [r.finishOption.id],
    }),
    finish: r.one.finish({
      from: [r.finishOptionFinish.finishId],
      to: [r.finish.id],
    }),
  },
  finishOptionColor: {
    finishOption: r.one.finishOption({
      from: [r.finishOptionColor.finishOptionId],
      to: [r.finishOption.id],
    }),
    color: r.one.color({
      from: [r.finishOptionColor.colorId],
      to: [r.color.id],
    }),
  },
  productDetailSpinner: {
    product: r.one.product({
      from: [r.productDetailSpinner.id],
      to: [r.product.id],
    }),
  },
  productDetailSpinnerButton: {
    product: r.one.product({
      from: [r.productDetailSpinnerButton.id],
      to: [r.product.id],
    }),
  },
  productDetailSlider: {
    includedInsert: r.one.product({
      from: [r.productDetailSlider.includedInsertProductId],
      to: [r.product.id],
      alias: "includedSliderInsert",
    }),
    includedPlate: r.one.product({
      from: [r.productDetailSlider.includedPlateProductId],
      to: [r.product.id],
      alias: "includedSliderPlate",
    }),
    product: r.one.product({
      from: [r.productDetailSlider.id],
      to: [r.product.id],
    }),
  },
  productDetailSliderPlate: {
    product: r.one.product({
      from: [r.productDetailSliderPlate.id],
      to: [r.product.id],
    }),
  },
  productDetailSliderInsert: {
    product: r.one.product({
      from: [r.productDetailSliderInsert.id],
      to: [r.product.id],
    }),
  },
  collectionDetailSpinner: {
    item: r.one.collectionItem({
      from: [r.collectionDetailSpinner.id],
      to: [r.collectionItem.id],
    }),
    product: r.one.productDetailSpinner({
      from: [r.collectionDetailSpinner.productSpinnerId],
      to: [r.productDetailSpinner.id],
    }),
    installedButton: r.one.collectionDetailSpinnerButton({
      from: [r.collectionDetailSpinner.installedButtonId],
      to: [r.collectionDetailSpinnerButton.id],
    }),
  },
  collectionDetailSpinnerButton: {
    item: r.one.collectionItem({
      from: [r.collectionDetailSpinnerButton.id],
      to: [r.collectionItem.id],
    }),
    product: r.one.productDetailSpinnerButton({
      from: [r.collectionDetailSpinnerButton.productSpinnerButtonId],
      to: [r.productDetailSpinnerButton.id],
    }),
  },
  tmpAutmogPens: {
    maker: r.one.maker({
      from: [r.tmpAutmogPens.makerId],
      to: [r.maker.id],
    }),
    materials: r.many.tmpAutmogPenMaterials(),
    mechanism: r.one.mechanism({
      from: [r.tmpAutmogPens.mechanismId],
      to: [r.mechanism.id],
    }),
    product: r.one.tmpProducts({
      from: [r.tmpAutmogPens.productId],
      to: [r.tmpProducts.id],
    }),
    versions: r.many.tmpAutmogPenVersions(),
  },
  tmpAutmogPenMaterials: {
    material: r.one.material({
      from: [r.tmpAutmogPenMaterials.materialId],
      to: [r.material.id],
    }),
    pen: r.one.tmpAutmogPens({
      from: [r.tmpAutmogPenMaterials.penId],
      to: [r.tmpAutmogPens.id],
    }),
  },
  tmpProducts: {
    autmogPen: r.one.tmpAutmogPens({
      from: [r.tmpProducts.id],
      to: [r.tmpAutmogPens.productId],
    }),
    grimsmoKnife: r.one.tmpGrimsmoKnives({
      from: [r.tmpProducts.id],
      to: [r.tmpGrimsmoKnives.productId],
    }),
    grimsmoPen: r.one.tmpGrimsmoPens({
      from: [r.tmpProducts.id],
      to: [r.tmpGrimsmoPens.productId],
    }),
    images: r.many.tmpImages(),
    productTypes: r.many.tmpProductProductTypes(),
    variations: r.many.tmpProductVariations(),
  },
  tmpProductVariations: {
    grimsmoKnifeVariation: r.one.tmpGrimsmoKnifeVariations({
      from: [r.tmpProductVariations.id],
      to: [r.tmpGrimsmoKnifeVariations.productVariationId],
    }),
    grimsmoPenVariation: r.one.tmpGrimsmoPenVariations({
      from: [r.tmpProductVariations.id],
      to: [r.tmpGrimsmoPenVariations.productVariationId],
    }),
    images: r.many.tmpImages(),
    product: r.one.tmpProducts({
      from: [r.tmpProductVariations.productId],
      to: [r.tmpProducts.id],
    }),
  },
  tmpProductProductTypes: {
    product: r.one.tmpProducts({
      from: [r.tmpProductProductTypes.productId],
      to: [r.tmpProducts.id],
    }),
    productType: r.one.productType({
      from: [r.tmpProductProductTypes.productTypeId],
      to: [r.productType.id],
    }),
  },
  tmpImages: {
    product: r.one.tmpProducts({
      from: [r.tmpImages.productId],
      to: [r.tmpProducts.id],
    }),
    productVariation: r.one.tmpProductVariations({
      from: [r.tmpImages.productVariationId],
      to: [r.tmpProductVariations.id],
    }),
  },
  tmpAutmogPenVersions: {
    pen: r.one.tmpAutmogPens({
      from: [r.tmpAutmogPenVersions.penId],
      to: [r.tmpAutmogPens.id],
    }),
  },
  tmpGrimsmoPens: {
    maker: r.one.maker({
      from: [r.tmpGrimsmoPens.makerId],
      to: [r.maker.id],
    }),
    product: r.one.tmpProducts({
      from: [r.tmpGrimsmoPens.productId],
      to: [r.tmpProducts.id],
    }),
    variations: r.many.tmpGrimsmoPenVariations(),
    versions: r.many.tmpGrimsmoPenVersions(),
  },
  tmpGrimsmoPenVariations: {
    pen: r.one.tmpGrimsmoPens({
      from: [r.tmpGrimsmoPenVariations.penId],
      to: [r.tmpGrimsmoPens.id],
    }),
    productVariation: r.one.tmpProductVariations({
      from: [r.tmpGrimsmoPenVariations.productVariationId],
      to: [r.tmpProductVariations.id],
    }),
    versions: r.many.tmpGrimsmoPenVariationVersions(),
  },
  tmpGrimsmoPenVersions: {
    pen: r.one.tmpGrimsmoPens({
      from: [r.tmpGrimsmoPenVersions.penId],
      to: [r.tmpGrimsmoPens.id],
    }),
  },
  tmpGrimsmoPenVariationVersions: {
    variation: r.one.tmpGrimsmoPenVariations({
      from: [r.tmpGrimsmoPenVariationVersions.variationId],
      to: [r.tmpGrimsmoPenVariations.id],
    }),
  },
  tmpGrimsmoKnives: {
    maker: r.one.maker({
      from: [r.tmpGrimsmoKnives.makerId],
      to: [r.maker.id],
    }),
    product: r.one.tmpProducts({
      from: [r.tmpGrimsmoKnives.productId],
      to: [r.tmpProducts.id],
    }),
    variations: r.many.tmpGrimsmoKnifeVariations(),
    versions: r.many.tmpGrimsmoKnifeVersions(),
  },
  tmpGrimsmoKnifeVariations: {
    knife: r.one.tmpGrimsmoKnives({
      from: [r.tmpGrimsmoKnifeVariations.knifeId],
      to: [r.tmpGrimsmoKnives.id],
    }),
    productVariation: r.one.tmpProductVariations({
      from: [r.tmpGrimsmoKnifeVariations.productVariationId],
      to: [r.tmpProductVariations.id],
    }),
    versions: r.many.tmpGrimsmoKnifeVariationVersions(),
  },
  tmpGrimsmoKnifeVersions: {
    knife: r.one.tmpGrimsmoKnives({
      from: [r.tmpGrimsmoKnifeVersions.knifeId],
      to: [r.tmpGrimsmoKnives.id],
    }),
  },
  tmpGrimsmoKnifeVariationVersions: {
    variation: r.one.tmpGrimsmoKnifeVariations({
      from: [r.tmpGrimsmoKnifeVariationVersions.variationId],
      to: [r.tmpGrimsmoKnifeVariations.id],
    }),
  },
  uploadSession: {
    files: r.many.uploadFile(),
  },
  uploadFile: {
    session: r.one.uploadSession({
      from: [r.uploadFile.sessionId],
      to: [r.uploadSession.id],
    }),
  },
}));

/** Connects an application user to owned collections, items, and settings. */
export const usersRelations = relations.user;

/** Connects a user collection to its owner, images, and items. */
export const userCollectionRelations = relations.userCollection;

/** Connects user settings to their application user. */
export const userSettingsRelations = relations.userSettings;

/** Connects a resource to its categories, images, notifications, and versions. */
export const resourcesRelations = relations.resources;

/** Connects a resource image to its resource. */
export const resourceImagesRelations = relations.resourceImages;

/** Connects a resource version to its resource, downloads, and files. */
export const resourceVersionsRelations = relations.resourceVersions;

/** Connects a collection image to its collection. */
export const collectionImageRelations = relations.collectionImage;

/** Connects a resource file to its immutable resource version. */
export const resourceFilesRelations = relations.resourceFiles;

/** Connects a resource category to assignments and category notifications. */
export const resourceCategoriesRelations = relations.resourceCategories;

/** Connects a resource notification to its resource and optional category subjects. */
export const resourceNotificationsRelations = relations.resourceNotifications;

/** Connects each resource-category assignment to its resource and category. */
export const resourcesToCategoriesRelations = relations.resourcesToCategories;

/** Connects a resource download to the downloaded version. */
export const resourceDownloadsRelations = relations.resourceDownloads;

/** Connects a feature flag to its per-user overrides. */
export const featureFlagsRelations = relations.featureFlags;

/** Connects a feature-flag override to its flag and user. */
export const featureFlagUserOverridesRelations =
  relations.featureFlagUserOverrides;

/** Connects a maker to catalog products and staged Autmog, Grimsmo pen, and Grimsmo knife records. */
export const makersRelations = relations.maker;

/** Connects a maker image to its maker profile. */
export const makerImageRelations = relations.makerImage;

/** Connects a terminology alias to the maker and canonical product type it names. */
export const catalogTerminologyAliasRelations =
  relations.catalogTerminologyAlias;

/** Connects a material to catalog products, collection items, and staged Autmog pens. */
export const materialsRelations = relations.material;

/** Connects a material image to its shared material. */
export const materialImageRelations = relations.materialImage;

/** Connects a mechanism to staged Autmog pens. */
export const mechanismsRelations = relations.mechanism;

/** Connects a product type to catalog products and staged product assignments. */
export const productTypesRelations = relations.productType;

/** Scraper-run relation metadata reserved for query composition. */
export const scraperRunsRelations = relations.scraperRuns;

/** Connects a collection item to its collection, owner, trade users, catalog details, images, finish, and spinner data. */
export const collectionItemRelations = relations.collectionItem;

/** Connects a collection-item image to its item. */
export const collectionItemImageRelations = relations.collectionItemImage;

/** Connects a catalog product to its maker, type, finishes, images, materials, and spinner data. */
export const productRelations = relations.product;

/** Connects a product image to its catalog product. */
export const productImageRelations = relations.productImage;

/** Connects each product-material assignment to its product and material. */
export const productMaterialRelations = relations.productMaterial;

/** Connects a finish to the finish options that include it. */
export const finishesRelations = relations.finish;

/** Connects a color to the finish options that include it. */
export const colorsRelations = relations.color;

/** Connects a color effect to finish options that use it. */
export const colorEffectsRelations = relations.colorEffect;

/** Connects a pattern to finish options that use it. */
export const patternsRelations = relations.pattern;

/** Connects a finish option to its product or item, source and derived options, color effect, colors, and finishes. */
export const finishOptionRelations = relations.finishOption;

/** Connects each finish-option assignment to its option and finish. */
export const finishOptionFinishRelations = relations.finishOptionFinish;

/** Connects each finish-option color assignment to its option and color. */
export const finishOptionColorRelations = relations.finishOptionColor;

/** Connects product spinner measurements to their catalog product. */
export const productDetailSpinnerRelations = relations.productDetailSpinner;

/** Connects product spinner-button measurements to their catalog product. */
export const productDetailSpinnerButtonRelations =
  relations.productDetailSpinnerButton;

/** Connects a slider body subtype to its catalog product. */
export const productDetailSliderRelations = relations.productDetailSlider;

/** Connects a slider plate-set subtype to its catalog product. */
export const productDetailSliderPlateRelations =
  relations.productDetailSliderPlate;

/** Connects a slider insert-set subtype to its catalog product. */
export const productDetailSliderInsertRelations =
  relations.productDetailSliderInsert;

/** Connects a collection spinner to its item, catalog spinner, and installed button. */
export const collectionDetailSpinnerRelations =
  relations.collectionDetailSpinner;

/** Connects a collection spinner button to its item and catalog button. */
export const collectionDetailSpinnerButtonRelations =
  relations.collectionDetailSpinnerButton;

/** Connects a staged Autmog pen to its maker, materials, mechanism, product, and versions. */
export const tmpAutmogPensRelations = relations.tmpAutmogPens;

/** Connects each staged Autmog pen-material assignment to its pen and material. */
export const tmpAutmogPenMaterialsRelations = relations.tmpAutmogPenMaterials;

/** Connects a staged product to source-specific details, images, product types, and variations. */
export const tmpProductsRelations = relations.tmpProducts;

/** Connects a staged product variation to its product, images, and source-specific details. */
export const tmpProductVariationsRelations = relations.tmpProductVariations;

/** Connects each staged product-type assignment to its product and type. */
export const tmpProductProductTypesRelations = relations.tmpProductProductTypes;

/** Connects a staged image to its product and optional variation. */
export const tmpImagesRelations = relations.tmpImages;

/** Connects an Autmog pen snapshot to its staged pen. */
export const tmpAutmogPenVersionsRelations = relations.tmpAutmogPenVersions;

/** Connects a staged Grimsmo pen to its maker, product, variations, and versions. */
export const tmpGrimsmoPensRelations = relations.tmpGrimsmoPens;

/** Connects a staged Grimsmo pen variation to its pen, normalized variation, and versions. */
export const tmpGrimsmoPenVariationsRelations =
  relations.tmpGrimsmoPenVariations;

/** Connects a Grimsmo pen snapshot to its staged pen. */
export const tmpGrimsmoPenVersionsRelations = relations.tmpGrimsmoPenVersions;

/** Connects a Grimsmo pen-variation snapshot to its staged variation. */
export const tmpGrimsmoPenVariationVersionsRelations =
  relations.tmpGrimsmoPenVariationVersions;

/** Connects a staged Grimsmo knife to its maker, product, variations, and versions. */
export const tmpGrimsmoKnivesRelations = relations.tmpGrimsmoKnives;

/** Connects a staged Grimsmo knife variation to its knife, normalized variation, and versions. */
export const tmpGrimsmoKnifeVariationsRelations =
  relations.tmpGrimsmoKnifeVariations;

/** Connects a Grimsmo knife snapshot to its staged knife. */
export const tmpGrimsmoKnifeVersionsRelations =
  relations.tmpGrimsmoKnifeVersions;

/** Connects a Grimsmo knife-variation snapshot to its staged variation. */
export const tmpGrimsmoKnifeVariationVersionsRelations =
  relations.tmpGrimsmoKnifeVariationVersions;

/** Connects an upload session to its files. */
export const uploadSessionRelations = relations.uploadSession;

/** Connects an upload file to its session. */
export const uploadFileRelations = relations.uploadFile;
