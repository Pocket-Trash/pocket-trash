import type { UserCollectionItem } from "@package/services";
import { describe, expect, it } from "vitest";
import {
  compareComposition,
  summarizeCommunityTrends,
  summarizeUserTrends,
} from "./user-trends";

describe("summarizeUserTrends", () => {
  it("counts private duplicate and secondary physical items exactly once", () => {
    const items = [
      item({ collectionItemId: 1, isPrivate: true }),
      item({ collectionItemId: 2, isPrivate: true }),
      item({
        collectionItemId: 3,
        name: "Plate",
        productId: 200,
        productSlug: "plate",
        productTypeId: 20,
        productTypeName: "Slider Plate",
        productTypeSlug: "slider-plate",
      }),
    ];

    expect(summarizeUserTrends(items, 2, {})).toMatchObject({
      collectionCount: 2,
      itemCount: 3,
      makers: [{ count: 3, id: 10, label: "Maker" }],
      products: [
        { count: 2, id: 100, label: "Product" },
        { count: 1, id: 200, label: "Plate" },
      ],
      productTypes: [
        { count: 2, id: 1, label: "Slider" },
        { count: 1, id: 20, label: "Slider Plate" },
      ],
    });
  });

  it("applies stable URL filters without changing whole-collection totals", () => {
    const items = [
      item({ collectionItemId: 1 }),
      item({ collectionItemId: 2, makerId: 11, makerName: "Other maker" }),
    ];

    expect(summarizeUserTrends(items, 1, { makerId: 11 })).toMatchObject({
      collectionCount: 1,
      itemCount: 2,
      makers: [{ count: 1, id: 11, label: "Other maker" }],
      products: [{ count: 1 }],
    });
  });

  it("counts every component in a material combination", () => {
    const steel = {
      id: 31,
      name: "Steel",
      slug: "steel",
      specific: { id: 32, name: "M390", slug: "m390" },
    };
    const combined = item({
      materials: [
        { id: 30, name: "Titanium", slug: "titanium", specific: null },
        steel,
      ],
    });

    expect(summarizeUserTrends([combined], 1, {}).materials).toEqual([
      expect.objectContaining({ count: 1, id: 31, label: "Steel" }),
      expect.objectContaining({ count: 1, id: 30, label: "Titanium" }),
    ]);
    expect(
      summarizeUserTrends([combined], 1, { materialId: 31 }).materials,
    ).toEqual([expect.objectContaining({ count: 1, id: 32, label: "M390" })]);
  });

  it("compares percentages without exposing raw community totals", () => {
    expect(
      compareComposition(
        [
          { count: 3, id: 1, label: "Slider" },
          { count: 1, id: 2, label: "Pen" },
        ],
        [{ count: 15, id: 1, label: "Slider" }],
        true,
      ),
    ).toEqual([
      expect.objectContaining({
        communityPercentage: 100,
        id: 1,
        personalPercentage: 75,
      }),
      expect.objectContaining({
        communityPercentage: null,
        id: 2,
        personalPercentage: 25,
      }),
    ]);
  });

  it("shows zero personal composition for community-only categories", () => {
    expect(
      compareComposition([], [{ count: 10, id: 1, label: "Slider" }], false),
    ).toEqual([
      expect.objectContaining({
        communityPercentage: 100,
        personalPercentage: 0,
      }),
    ]);
  });

  it("preserves aggregate freshness and suppression metadata", () => {
    const generatedAt = new Date("2026-10-14T12:00:00.000Z");
    const community = summarizeCommunityTrends(
      {
        collectionItems: {
          generatedAt,
          hasSuppressedValues: true,
          stale: true,
          values: [
            {
              collectorCount: 10,
              count: 15,
              productTypeId: 1,
              productTypeName: "Slider",
            },
          ],
        },
        makerProducts: null,
        materials: null,
      },
      {},
      { generalMaterial: "General", unspecifiedMaterial: "Unspecified" },
    );

    expect(community.productTypes).toMatchObject({
      generatedAt,
      hasSuppressedValues: true,
      stale: true,
      values: [{ count: 15, id: 1, label: "Slider" }],
    });
  });
});

/**
 * Builds a complete currently-owned item fixture.
 *
 * @param overrides - Fixture fields to replace.
 * @returns Complete owned-item fixture.
 */
function item(overrides: Partial<UserCollectionItem>): UserCollectionItem {
  return {
    approvalStatus: "approved",
    bearing: null,
    bearingOverride: null,
    canAdminister: false,
    canEdit: true,
    collectionId: 1,
    collectionIsPrivate: true,
    collectionItemId: 1,
    collectionName: "Private collection",
    compatibleButtonId: null,
    compatibleButtonName: null,
    description: null,
    descriptionOverride: null,
    displayName: "Product",
    effectiveSliderSetup: null,
    finishOption: null,
    imageCount: 0,
    images: [],
    includedInsert: null,
    includedPlate: null,
    installedButtonId: null,
    installedInsertId: null,
    installedOnSliderId: null,
    installedPlateId: null,
    isAdminPrivate: false,
    isPrivate: false,
    makerId: 10,
    makerName: "Maker",
    makerSlug: "maker",
    makerUrl: null,
    materials: [
      {
        id: 30,
        name: "Titanium",
        slug: "titanium",
        specific: null,
      },
    ],
    name: "Product",
    ownerClerkId: "user_owner",
    ownerImageUrl: null,
    ownerIsProfilePublic: true,
    ownerUserId: 1,
    ownerUsername: "owner",
    productId: 100,
    productImages: [],
    productSlug: "product",
    productTypeId: 1,
    productTypeName: "Slider",
    productTypeSlug: "slider",
    sourceProductFinishOptionId: null,
    ...overrides,
  };
}
