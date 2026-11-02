import type { CatalogProduct } from "@package/services";
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
