import type { CatalogProduct, UserCollectionItem } from "@package/services";
import type { EditableCatalogProductType } from "@/lib/catalog-api";

/**
 * Creates a catalog product fixture.
 *
 * @param id - Product identifier.
 * @param name - Product name.
 * @param productTypeSlug - Product type slug.
 * @returns The catalog product fixture.
 */
export function productFixture(
  id: number,
  name: string,
  productTypeSlug: EditableCatalogProductType,
): CatalogProduct {
  return {
    aliases: [],
    approvalStatus: "approved",
    bearing: null,
    buttonDiameter: null,
    clickCount: productTypeSlug === "slider" ? 3 : null,
    canAdminister: false,
    canEdit: true,
    compatibleButtonId: null,
    compatibleButtonName: null,
    compatiblePens: [],
    refillCompatibility: [],
    compatibleParts: [],
    createdAt: new Date(0),
    description: null,
    diameter: null,
    finishOptions: [
      {
        colorEffect: null,
        colors: [],
        finishes: [{ id: id + 2, name: "Polished", slug: "polished" }],
        id: id + 3,
        pattern: null,
      },
    ],
    imageCount: 0,
    images: [],
    includedInsert: null,
    includedPlate: null,
    id,
    length: null,
    makerId: 1,
    makerName: "Maker",
    makerSlug: "maker",
    productLinks: [],
    makerUrl: null,
    magnetLayout: productTypeSlug === "slider" ? "2x4" : null,
    usesInserts: productTypeSlug === "slider" ? false : null,
    materials: [
      {
        assignmentId: id + 1,
        weight: null,
        materials: [
          {
            specific: null,
            id: id + 1,
            name: "Bronze",
            slug: "bronze",
          },
        ],
      },
    ],
    name,
    refillModel: null,
    refillOfferings: [],
    ownerClerkId: "user_test",
    isAdminPrivate: false,
    isPrivate: false,
    productTypeId: 1,
    productTypeName: productTypeSlug,
    productTypeSlug,
    slug: name.toLowerCase(),
    spinDiameter: null,
    thickness: null,
    thicknessWithButton: null,
    updatedAt: new Date(0),
    weight: null,
    width: null,
  };
}

/**
 * Creates a collection item fixture for a catalog product.
 *
 * @param collectionItemId - Collection item identifier.
 * @param product - Source catalog product.
 * @param sourceProductFinishOptionId - Source finish option identifier.
 * @returns The collection item fixture.
 */
export function collectionFixture(
  collectionItemId: number,
  product: CatalogProduct,
  sourceProductFinishOptionId: number,
): UserCollectionItem {
  return {
    approvalStatus: "approved",
    bearing: null,
    bearingOverride: null,
    canAdminister: false,
    canEdit: true,
    collectionId: 1000,
    collectionItemId,
    collectionIsPrivate: false,
    collectionName: "Test collection",
    compatibleButtonId: null,
    compatibleButtonName: null,
    displayName: product.name,
    description: null,
    descriptionOverride: null,
    finishOption: product.finishOptions[0] ?? null,
    imageCount: 0,
    images: [],
    effectiveSliderSetup: null,
    isAdminPrivate: false,
    isPrivate: false,
    installedButtonId: null,
    installedInsertId: null,
    installedOnSliderId: null,
    installedPlateId: null,
    includedInsert: null,
    includedPlate: null,
    makerId: product.makerId,
    makerName: product.makerName,
    makerSlug: product.makerSlug,
    makerUrl: product.makerUrl,
    materials: product.materials[0]?.materials ?? [],
    name: product.name,
    ownerClerkId: "user_test",
    ownerImageUrl: null,
    ownerIsProfilePublic: true,
    ownerUsername: "tester",
    ownerUserId: 1,
    productId: product.id,
    productSlug: product.slug,
    productTypeId: product.productTypeId,
    productTypeName: product.productTypeName,
    productTypeSlug: product.productTypeSlug,
    productImages: [],
    sourceProductFinishOptionId,
  };
}
