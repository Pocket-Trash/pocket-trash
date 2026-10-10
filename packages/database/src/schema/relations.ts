import { defineRelations } from "drizzle-orm";
import * as auditSchema from "./audit.js";
import * as catalogImportSchema from "./catalog-import.js";
import * as collectionSchema from "./collection.js";
import * as erasureSchema from "./erasure.js";
import * as featureFlagSchema from "./feature-flags.js";
import * as feedbackSchema from "./feedback.js";
import * as pensSchema from "./pens.js";
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
  ...pensSchema,
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
    sourceListings: r.many.catalogSourceListing(),
    refillIdentifiers: r.many.refillOfferingIdentifier(),
  },
  makerImage: {
    maker: r.one.maker({
      from: [r.makerImage.makerId],
      to: [r.maker.id],
    }),
  },
  catalogTerminologyAlias: {
    concept: r.one.catalogTerminologyConcept({
      from: [r.catalogTerminologyAlias.conceptId],
      to: [r.catalogTerminologyConcept.id],
    }),
    maker: r.one.maker({
      from: [r.catalogTerminologyAlias.makerId],
      to: [r.maker.id],
    }),
  },
  material: {
    specifics: r.many.materialSpecific(),
    autmogPens: r.many.tmpAutmogPenMaterials(),
    collectionItems: r.many.collectionItem(),
    images: r.many.materialImage(),
    products: r.many.productMaterial(),
  },
  materialSpecific: {
    material: r.one.material({
      from: [r.materialSpecific.materialId],
      to: [r.material.id],
    }),
    images: r.many.materialImage(),
    products: r.many.productMaterial(),
    collectionItems: r.many.collectionItem(),
  },
  materialImage: {
    specific: r.one.materialSpecific({
      from: [r.materialImage.materialSpecificId],
      to: [r.materialSpecific.id],
    }),
    material: r.one.material({
      from: [r.materialImage.materialId],
      to: [r.material.id],
    }),
  },
  mechanism: {
    autmogPens: r.many.tmpAutmogPens(),
    penMechanismProducts: r.many.productDetailPenMechanism(),
  },
  productType: {
    catalogProducts: r.many.product(),
    products: r.many.tmpProductProductTypes(),
  },
  scraperRuns: {},
  collectionItem: {
    specific: r.one.materialSpecific({
      from: [r.collectionItem.materialSpecificId],
      to: [r.materialSpecific.id],
    }),
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
    configurationSelections: r.many.collectionItemConfigurationSelection({
      from: r.collectionItem.id,
      to: r.collectionItemConfigurationSelection.collectionItemId,
      alias: "configuredItem",
    }),
    installedInSelections: r.many.collectionItemConfigurationSelection({
      from: r.collectionItem.id,
      to: r.collectionItemConfigurationSelection.installedPartCollectionItemId,
      alias: "installedPart",
    }),
    pen: r.one.collectionDetailPen({
      from: [r.collectionItem.id],
      to: [r.collectionDetailPen.id],
    }),
    penActuator: r.one.collectionDetailPenActuator({
      from: [r.collectionItem.id],
      to: [r.collectionDetailPenActuator.id],
    }),
    penClip: r.one.collectionDetailPenClip({
      from: [r.collectionItem.id],
      to: [r.collectionDetailPenClip.id],
    }),
    penMechanism: r.one.collectionDetailPenMechanism({
      from: [r.collectionItem.id],
      to: [r.collectionDetailPenMechanism.id],
    }),
    penTip: r.one.collectionDetailPenTip({
      from: [r.collectionItem.id],
      to: [r.collectionDetailPenTip.id],
    }),
    penTopCap: r.one.collectionDetailPenTopCap({
      from: [r.collectionItem.id],
      to: [r.collectionDetailPenTopCap.id],
    }),
  },
  collectionItemImage: {
    collectionItem: r.one.collectionItem({
      from: [r.collectionItemImage.collectionItemId],
      to: [r.collectionItem.id],
    }),
  },
  product: {
    aliases: r.many.productAlias(),
    configurationSlots: r.many.productConfigurationSlot(),
    finishOptions: r.many.finishOption(),
    images: r.many.productImage(),
    maker: r.one.maker({
      from: [r.product.makerId],
      to: [r.maker.id],
    }),
    materials: r.many.productMaterial(),
    sourceListings: r.many.productSourceListing(),
    pen: r.one.productDetailPen({
      from: [r.product.id],
      to: [r.productDetailPen.id],
    }),
    penPart: r.one.productDetailPenPart({
      from: [r.product.id],
      to: [r.productDetailPenPart.id],
    }),
    refill: r.one.productDetailRefill({
      from: [r.product.id],
      to: [r.productDetailRefill.id],
    }),
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
    sourceImages: r.many.catalogSourceImage(),
  },
  productMaterial: {
    configurationChoices: r.many.productConfigurationChoice({
      from: r.productMaterial.id,
      to: r.productConfigurationChoice.productMaterialId,
    }),
    specific: r.one.materialSpecific({
      from: [r.productMaterial.materialSpecificId],
      to: [r.materialSpecific.id],
    }),
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
    configurationChoices: r.many.productConfigurationChoice({
      from: r.finishOption.id,
      to: r.productConfigurationChoice.finishOptionId,
    }),
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
  catalogTerminologyConcept: {
    aliases: r.many.catalogTerminologyAlias(),
    noseProfiles: r.many.penNoseProfileAssignment(),
    partRoles: r.many.penPartRoleAssignment(),
    refillGroup: r.one.refillCompatibilityGroup(),
  },
  productAlias: {
    product: r.one.product({
      from: [r.productAlias.productId],
      to: [r.product.id],
    }),
  },
  penPartRoleAssignment: {
    concept: r.one.catalogTerminologyConcept({
      from: [r.penPartRoleAssignment.conceptId],
      to: [r.catalogTerminologyConcept.id],
    }),
    part: r.one.productDetailPenPart({
      from: [r.penPartRoleAssignment.partProductId],
      to: [r.productDetailPenPart.id],
    }),
  },
  penNoseProfileAssignment: {
    concept: r.one.catalogTerminologyConcept({
      from: [r.penNoseProfileAssignment.conceptId],
      to: [r.catalogTerminologyConcept.id],
    }),
    product: r.one.product({
      from: [r.penNoseProfileAssignment.productId],
      to: [r.product.id],
    }),
  },
  productDetailPen: {
    collectionItems: r.many.collectionDetailPen(),
    compatibilityAssertions: r.many.refillCompatibilityAssertion(),
    compatibilityEvidence: r.many.refillCompatibilityEvidence(),
    product: r.one.product({
      from: [r.productDetailPen.id],
      to: [r.product.id],
    }),
  },
  productDetailPenPart: {
    choices: r.many.productConfigurationChoice(),
    product: r.one.product({
      from: [r.productDetailPenPart.id],
      to: [r.product.id],
    }),
    roles: r.many.penPartRoleAssignment(),
  },
  productDetailPenClip: {
    collectionItems: r.many.collectionDetailPenClip(),
    part: r.one.productDetailPenPart({
      from: [r.productDetailPenClip.id],
      to: [r.productDetailPenPart.id],
    }),
    product: r.one.product({
      from: [r.productDetailPenClip.id],
      to: [r.product.id],
    }),
  },
  productDetailPenTip: {
    assertions: r.many.refillCompatibilityAssertion(),
    collectionItems: r.many.collectionDetailPenTip(),
    evidence: r.many.refillCompatibilityEvidence(),
    part: r.one.productDetailPenPart({
      from: [r.productDetailPenTip.id],
      to: [r.productDetailPenPart.id],
    }),
    product: r.one.product({
      from: [r.productDetailPenTip.id],
      to: [r.product.id],
    }),
  },
  productDetailPenTopCap: {
    collectionItems: r.many.collectionDetailPenTopCap(),
    part: r.one.productDetailPenPart({
      from: [r.productDetailPenTopCap.id],
      to: [r.productDetailPenPart.id],
    }),
    product: r.one.product({
      from: [r.productDetailPenTopCap.id],
      to: [r.product.id],
    }),
  },
  productDetailPenMechanism: {
    collectionItems: r.many.collectionDetailPenMechanism(),
    mechanism: r.one.mechanism({
      from: [r.productDetailPenMechanism.mechanismId],
      to: [r.mechanism.id],
    }),
    part: r.one.productDetailPenPart({
      from: [r.productDetailPenMechanism.id],
      to: [r.productDetailPenPart.id],
    }),
    product: r.one.product({
      from: [r.productDetailPenMechanism.id],
      to: [r.product.id],
    }),
  },
  productDetailPenActuator: {
    collectionItems: r.many.collectionDetailPenActuator(),
    part: r.one.productDetailPenPart({
      from: [r.productDetailPenActuator.id],
      to: [r.productDetailPenPart.id],
    }),
    product: r.one.product({
      from: [r.productDetailPenActuator.id],
      to: [r.product.id],
    }),
  },
  productDetailRefill: {
    collectionPens: r.many.collectionDetailPen(),
    compatibilityAssertions: r.many.refillCompatibilityAssertion(),
    compatibilityEvidence: r.many.refillCompatibilityEvidence(),
    groupMemberships: r.many.refillCompatibilityGroupMembership(),
    offerings: r.many.refillOffering(),
    product: r.one.product({
      from: [r.productDetailRefill.id],
      to: [r.product.id],
    }),
  },
  collectionDetailPen: {
    installedOffering: r.one.refillOffering({
      from: [r.collectionDetailPen.installedRefillOfferingId],
      to: [r.refillOffering.id],
    }),
    installedRefill: r.one.productDetailRefill({
      from: [r.collectionDetailPen.installedRefillProductId],
      to: [r.productDetailRefill.id],
    }),
    item: r.one.collectionItem({
      from: [r.collectionDetailPen.id],
      to: [r.collectionItem.id],
    }),
    product: r.one.productDetailPen({
      from: [r.collectionDetailPen.productPenId],
      to: [r.productDetailPen.id],
    }),
  },
  collectionDetailPenClip: {
    item: r.one.collectionItem({
      from: [r.collectionDetailPenClip.id],
      to: [r.collectionItem.id],
    }),
    product: r.one.productDetailPenClip({
      from: [r.collectionDetailPenClip.productPenClipId],
      to: [r.productDetailPenClip.id],
    }),
  },
  collectionDetailPenTip: {
    item: r.one.collectionItem({
      from: [r.collectionDetailPenTip.id],
      to: [r.collectionItem.id],
    }),
    product: r.one.productDetailPenTip({
      from: [r.collectionDetailPenTip.productPenTipId],
      to: [r.productDetailPenTip.id],
    }),
  },
  collectionDetailPenTopCap: {
    item: r.one.collectionItem({
      from: [r.collectionDetailPenTopCap.id],
      to: [r.collectionItem.id],
    }),
    product: r.one.productDetailPenTopCap({
      from: [r.collectionDetailPenTopCap.productPenTopCapId],
      to: [r.productDetailPenTopCap.id],
    }),
  },
  collectionDetailPenMechanism: {
    item: r.one.collectionItem({
      from: [r.collectionDetailPenMechanism.id],
      to: [r.collectionItem.id],
    }),
    product: r.one.productDetailPenMechanism({
      from: [r.collectionDetailPenMechanism.productPenMechanismId],
      to: [r.productDetailPenMechanism.id],
    }),
  },
  collectionDetailPenActuator: {
    item: r.one.collectionItem({
      from: [r.collectionDetailPenActuator.id],
      to: [r.collectionItem.id],
    }),
    product: r.one.productDetailPenActuator({
      from: [r.collectionDetailPenActuator.productPenActuatorId],
      to: [r.productDetailPenActuator.id],
    }),
  },
  configurationSlotKind: {
    slots: r.many.productConfigurationSlot(),
  },
  productConfigurationSlot: {
    choices: r.many.productConfigurationChoice(),
    kind: r.one.configurationSlotKind({
      from: [r.productConfigurationSlot.slotKindId],
      to: [r.configurationSlotKind.id],
    }),
    product: r.one.product({
      from: [r.productConfigurationSlot.productId],
      to: [r.product.id],
    }),
    selections: r.many.collectionItemConfigurationSelection(),
  },
  productConfigurationChoice: {
    finishOption: r.one.finishOption({
      from: [r.productConfigurationChoice.finishOptionId],
      to: [r.finishOption.id],
    }),
    listingChoices: r.many.catalogSourceListingChoice(),
    material: r.one.productMaterial({
      from: [r.productConfigurationChoice.productMaterialId],
      to: [r.productMaterial.id],
    }),
    part: r.one.productDetailPenPart({
      from: [r.productConfigurationChoice.partProductId],
      to: [r.productDetailPenPart.id],
    }),
    requiredBy: r.many.productConfigurationChoiceRequirement({
      from: r.productConfigurationChoice.id,
      to: r.productConfigurationChoiceRequirement.requiredChoiceId,
      alias: "requiredChoice",
    }),
    rules: r.many.productConfigurationChoiceRule(),
    selections: r.many.collectionItemConfigurationSelection(),
    slot: r.one.productConfigurationSlot({
      from: [r.productConfigurationChoice.slotId],
      to: [r.productConfigurationSlot.id],
    }),
  },
  productConfigurationChoiceRule: {
    requirements: r.many.productConfigurationChoiceRequirement(),
    target: r.one.productConfigurationChoice({
      from: [r.productConfigurationChoiceRule.targetChoiceId],
      to: [r.productConfigurationChoice.id],
    }),
  },
  productConfigurationChoiceRequirement: {
    requiredChoice: r.one.productConfigurationChoice({
      from: [r.productConfigurationChoiceRequirement.requiredChoiceId],
      to: [r.productConfigurationChoice.id],
      alias: "requiredChoice",
    }),
    rule: r.one.productConfigurationChoiceRule({
      from: [r.productConfigurationChoiceRequirement.ruleId],
      to: [r.productConfigurationChoiceRule.id],
    }),
  },
  collectionItemConfigurationSelection: {
    choice: r.one.productConfigurationChoice({
      from: [r.collectionItemConfigurationSelection.choiceId],
      to: [r.productConfigurationChoice.id],
    }),
    installedPart: r.one.collectionItem({
      from: [
        r.collectionItemConfigurationSelection.installedPartCollectionItemId,
      ],
      to: [r.collectionItem.id],
      alias: "installedPart",
    }),
    item: r.one.collectionItem({
      from: [r.collectionItemConfigurationSelection.collectionItemId],
      to: [r.collectionItem.id],
      alias: "configuredItem",
    }),
    slot: r.one.productConfigurationSlot({
      from: [r.collectionItemConfigurationSelection.slotId],
      to: [r.productConfigurationSlot.id],
    }),
  },
  refillTipStyle: {
    offerings: r.many.refillOffering(),
  },
  refillInkColor: {
    offerings: r.many.refillOffering(),
  },
  refillOffering: {
    evidence: r.many.refillOfferingEvidence(),
    identifiers: r.many.refillOfferingIdentifier(),
    inkColor: r.one.refillInkColor({
      from: [r.refillOffering.inkColorId],
      to: [r.refillInkColor.id],
    }),
    installedInPens: r.many.collectionDetailPen(),
    marketStatuses: r.many.refillOfferingMarketStatus(),
    refill: r.one.productDetailRefill({
      from: [r.refillOffering.refillProductId],
      to: [r.productDetailRefill.id],
    }),
    tipStyle: r.one.refillTipStyle({
      from: [r.refillOffering.tipStyleId],
      to: [r.refillTipStyle.id],
    }),
  },
  catalogMarket: {
    childEdges: r.many.catalogMarketContainment({
      from: r.catalogMarket.id,
      to: r.catalogMarketContainment.parentMarketId,
      alias: "parentMarket",
    }),
    evidence: r.many.catalogSourceEvidence(),
    identifiers: r.many.refillOfferingIdentifier(),
    parentEdges: r.many.catalogMarketContainment({
      from: r.catalogMarket.id,
      to: r.catalogMarketContainment.childMarketId,
      alias: "childMarket",
    }),
    statuses: r.many.refillOfferingMarketStatus(),
  },
  catalogMarketContainment: {
    child: r.one.catalogMarket({
      from: [r.catalogMarketContainment.childMarketId],
      to: [r.catalogMarket.id],
      alias: "childMarket",
    }),
    parent: r.one.catalogMarket({
      from: [r.catalogMarketContainment.parentMarketId],
      to: [r.catalogMarket.id],
      alias: "parentMarket",
    }),
  },
  catalogSourceListing: {
    choices: r.many.catalogSourceListingChoice(),
    evidence: r.many.catalogSourceEvidence(),
    images: r.many.catalogSourceImage(),
    maker: r.one.maker({
      from: [r.catalogSourceListing.makerId],
      to: [r.maker.id],
    }),
    product: r.one.productSourceListing(),
  },
  catalogSourceEvidence: {
    listing: r.one.catalogSourceListing({
      from: [r.catalogSourceEvidence.listingId],
      to: [r.catalogSourceListing.id],
    }),
    market: r.one.catalogMarket({
      from: [r.catalogSourceEvidence.marketId],
      to: [r.catalogMarket.id],
    }),
    offeringLinks: r.many.refillOfferingEvidence(),
    identifierLinks: r.many.refillOfferingIdentifierEvidence(),
    statusLinks: r.many.refillOfferingMarketStatusEvidence(),
  },
  productSourceListing: {
    listing: r.one.catalogSourceListing({
      from: [r.productSourceListing.listingId],
      to: [r.catalogSourceListing.id],
    }),
    product: r.one.product({
      from: [r.productSourceListing.productId],
      to: [r.product.id],
    }),
  },
  catalogSourceListingChoice: {
    choice: r.one.productConfigurationChoice({
      from: [r.catalogSourceListingChoice.choiceId],
      to: [r.productConfigurationChoice.id],
    }),
    listing: r.one.catalogSourceListing({
      from: [r.catalogSourceListingChoice.listingId],
      to: [r.catalogSourceListing.id],
    }),
  },
  catalogSourceImage: {
    listing: r.one.catalogSourceListing({
      from: [r.catalogSourceImage.listingId],
      to: [r.catalogSourceListing.id],
    }),
    productImage: r.one.productImage({
      from: [r.catalogSourceImage.productImageId],
      to: [r.productImage.id],
    }),
  },
  refillCompatibilityGroup: {
    assertions: r.many.refillCompatibilityAssertion(),
    concept: r.one.catalogTerminologyConcept({
      from: [r.refillCompatibilityGroup.conceptId],
      to: [r.catalogTerminologyConcept.id],
    }),
    memberships: r.many.refillCompatibilityGroupMembership(),
  },
  refillCompatibilityGroupMembership: {
    evidence: r.many.refillCompatibilityGroupMembershipEvidence(),
    group: r.one.refillCompatibilityGroup({
      from: [r.refillCompatibilityGroupMembership.groupId],
      to: [r.refillCompatibilityGroup.id],
    }),
    refill: r.one.productDetailRefill({
      from: [r.refillCompatibilityGroupMembership.refillProductId],
      to: [r.productDetailRefill.id],
    }),
  },
  refillCompatibilityAssertion: {
    evidence: r.many.refillCompatibilityAssertionEvidence(),
    pen: r.one.productDetailPen({
      from: [r.refillCompatibilityAssertion.penProductId],
      to: [r.productDetailPen.id],
    }),
    requiredTip: r.one.productDetailPenTip({
      from: [r.refillCompatibilityAssertion.requiredTipProductId],
      to: [r.productDetailPenTip.id],
    }),
    targetGroup: r.one.refillCompatibilityGroup({
      from: [r.refillCompatibilityAssertion.targetGroupId],
      to: [r.refillCompatibilityGroup.id],
    }),
    targetRefill: r.one.productDetailRefill({
      from: [r.refillCompatibilityAssertion.targetRefillProductId],
      to: [r.productDetailRefill.id],
    }),
  },
  refillCompatibilityEvidence: {
    assertionLinks: r.many.refillCompatibilityAssertionEvidence(),
    membershipLinks: r.many.refillCompatibilityGroupMembershipEvidence(),
    pen: r.one.productDetailPen({
      from: [r.refillCompatibilityEvidence.penProductId],
      to: [r.productDetailPen.id],
    }),
    refill: r.one.productDetailRefill({
      from: [r.refillCompatibilityEvidence.refillProductId],
      to: [r.productDetailRefill.id],
    }),
    requiredTip: r.one.productDetailPenTip({
      from: [r.refillCompatibilityEvidence.requiredTipProductId],
      to: [r.productDetailPenTip.id],
    }),
  },
  refillCompatibilityAssertionEvidence: {
    assertion: r.one.refillCompatibilityAssertion({
      from: [r.refillCompatibilityAssertionEvidence.assertionId],
      to: [r.refillCompatibilityAssertion.id],
    }),
    evidence: r.one.refillCompatibilityEvidence({
      from: [r.refillCompatibilityAssertionEvidence.evidenceId],
      to: [r.refillCompatibilityEvidence.id],
    }),
  },
  refillCompatibilityGroupMembershipEvidence: {
    evidence: r.one.refillCompatibilityEvidence({
      from: [r.refillCompatibilityGroupMembershipEvidence.evidenceId],
      to: [r.refillCompatibilityEvidence.id],
    }),
    membership: r.one.refillCompatibilityGroupMembership({
      from: [r.refillCompatibilityGroupMembershipEvidence.membershipId],
      to: [r.refillCompatibilityGroupMembership.id],
    }),
  },
  refillOfferingEvidence: {
    evidence: r.one.catalogSourceEvidence({
      from: [r.refillOfferingEvidence.evidenceId],
      to: [r.catalogSourceEvidence.id],
    }),
    offering: r.one.refillOffering({
      from: [r.refillOfferingEvidence.offeringId],
      to: [r.refillOffering.id],
    }),
  },
  refillOfferingMarketStatus: {
    evidence: r.many.refillOfferingMarketStatusEvidence(),
    market: r.one.catalogMarket({
      from: [r.refillOfferingMarketStatus.marketId],
      to: [r.catalogMarket.id],
    }),
    offering: r.one.refillOffering({
      from: [r.refillOfferingMarketStatus.offeringId],
      to: [r.refillOffering.id],
    }),
    successor: r.one.refillOfferingMarketStatus({
      from: [r.refillOfferingMarketStatus.successorId],
      to: [r.refillOfferingMarketStatus.id],
      alias: "statusSuccessor",
    }),
    supersededRows: r.many.refillOfferingMarketStatus({
      alias: "statusSuccessor",
    }),
  },
  refillOfferingMarketStatusEvidence: {
    evidence: r.one.catalogSourceEvidence({
      from: [r.refillOfferingMarketStatusEvidence.evidenceId],
      to: [r.catalogSourceEvidence.id],
    }),
    status: r.one.refillOfferingMarketStatus({
      from: [r.refillOfferingMarketStatusEvidence.statusId],
      to: [r.refillOfferingMarketStatus.id],
    }),
  },
  refillOfferingIdentifier: {
    evidence: r.many.refillOfferingIdentifierEvidence(),
    maker: r.one.maker({
      from: [r.refillOfferingIdentifier.makerId],
      to: [r.maker.id],
    }),
    market: r.one.catalogMarket({
      from: [r.refillOfferingIdentifier.marketId],
      to: [r.catalogMarket.id],
    }),
    offering: r.one.refillOffering({
      from: [r.refillOfferingIdentifier.offeringId],
      to: [r.refillOffering.id],
    }),
    successor: r.one.refillOfferingIdentifier({
      from: [r.refillOfferingIdentifier.successorId],
      to: [r.refillOfferingIdentifier.id],
      alias: "identifierSuccessor",
    }),
    supersededRows: r.many.refillOfferingIdentifier({
      alias: "identifierSuccessor",
    }),
  },
  refillOfferingIdentifierEvidence: {
    evidence: r.one.catalogSourceEvidence({
      from: [r.refillOfferingIdentifierEvidence.evidenceId],
      to: [r.catalogSourceEvidence.id],
    }),
    identifier: r.one.refillOfferingIdentifier({
      from: [r.refillOfferingIdentifierEvidence.identifierId],
      to: [r.refillOfferingIdentifier.id],
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
