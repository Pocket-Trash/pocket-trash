import type {
  UserActivityTrends,
  UserCollectionHistoryTrends,
  UserCollectionItem,
} from "@package/services";
import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { useState } from "react";
import { expect, fn, within } from "storybook/test";
import type { CatalogTrendsSearch } from "@/lib/catalog-filters";
import type { CommunityTrendsSource } from "@/lib/user-trends";
import { mockStoryAuth, StoryProviders } from "../../.storybook/story-fixtures";
import { UserTrendsPage } from "./user-trends-page";

/** Personal Trends Storybook configuration. */
const meta = {
  beforeEach: mockStoryAuth,
  component: UserTrendsPage,
  decorators: [
    (Story) => (
      <StoryProviders>
        <Story />
      </StoryProviders>
    ),
  ],
  parameters: { layout: "fullscreen" },
  title: "Pages/User Trends",
} satisfies Meta<typeof UserTrendsPage>;

export default meta;
/** Personal Trends story contract. */
type Story = StoryObj<typeof meta>;

/** Exact personal collection activity used by the populated story. */
const activityTrends: UserActivityTrends = {
  granularity: "month",
  range: "year",
  values: [
    { bucketStart: new Date("2026-08-01T00:00:00.000Z"), count: 2 },
    { bucketStart: new Date("2026-09-01T00:00:00.000Z"), count: 3 },
    { bucketStart: new Date("2026-10-01T00:00:00.000Z"), count: 5 },
  ],
};

/** Effective-date collection history used by the populated story. */
const collectionHistoryTrends: UserCollectionHistoryTrends = {
  exactDateCount: 2,
  granularity: "month",
  imputedDateCount: 1,
  range: "year",
  values: [
    {
      acquisitionCount: 2,
      bucketStart: new Date("2026-08-01T00:00:00.000Z"),
      collectionCount: 2,
      departureCount: 0,
    },
    {
      acquisitionCount: 0,
      bucketStart: new Date("2026-09-01T00:00:00.000Z"),
      collectionCount: 1,
      departureCount: 1,
    },
    {
      acquisitionCount: 1,
      bucketStart: new Date("2026-10-01T00:00:00.000Z"),
      collectionCount: 2,
      departureCount: 0,
    },
  ],
};

/**
 * Renders controlled personal Trends URL-filter state.
 *
 * @returns Populated personal Trends fixture.
 */
function UserTrendsFixture() {
  const [search, setSearch] = useState<CatalogTrendsSearch>({});
  return (
    <UserTrendsPage
      activityTrends={activityTrends}
      collectionCount={2}
      collectionHistoryTrends={collectionHistoryTrends}
      communityTrends={communityTrends}
      items={items}
      onSearchChange={setSearch}
      search={search}
    />
  );
}

/** Populated private current-state collection Trends. */
export const Populated: Story = {
  args: {
    activityTrends,
    collectionCount: 2,
    collectionHistoryTrends,
    items: [],
    onSearchChange: fn(),
    search: {},
  },
  /**
   * Renders the controlled populated fixture.
   *
   * @returns Populated personal Trends fixture.
   */
  render: () => <UserTrendsFixture />,
  /**
   * Verifies totals, complete tables, and catalog actions.
   *
   * @param context - Story interaction context.
   * @param context.canvasElement - Rendered story canvas.
   */
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByRole("table")).toHaveLength(6);
    await expect(
      canvas.getByRole("heading", {
        name: /Collection history|web\.userTrends\.collectionHistory/,
      }),
    ).toBeVisible();
    await expect(canvas.getByText("10", { selector: "dd" })).toBeVisible();
    await expect(
      canvas.getAllByText(/Personal %|web\.userTrends\.personalPercentage/)
        .length,
    ).toBeGreaterThan(0);
    await expect(
      canvas.getAllByText(/Community %|web\.userTrends\.communityPercentage/)
        .length,
    ).toBeGreaterThan(0);
    await expect(
      canvas.getAllByRole("link", {
        name: /View products|web\.trends\.viewProducts/,
      }).length,
    ).toBeGreaterThan(0);
  },
};

/** Empty private collection state. */
export const Empty: Story = {
  args: { collectionCount: 1, items: [], onSearchChange: fn(), search: {} },
};

/** Base private owned-item fixture. */
const baseItem: UserCollectionItem = {
  approvalStatus: "approved",
  bearing: null,
  bearingOverride: null,
  canAdminister: false,
  canEdit: true,
  collectionId: 1,
  collectionIsPrivate: true,
  collectionItemId: 1,
  collectionName: "Daily carry",
  compatibleButtonId: null,
  compatibleButtonName: null,
  description: null,
  descriptionOverride: null,
  displayName: "Product 1",
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
  isPrivate: true,
  makerId: 100,
  makerName: "Maker 1",
  makerSlug: "maker-1",
  makerUrl: null,
  materials: [{ id: 300, name: "Titanium", slug: "titanium", specific: null }],
  name: "Product 1",
  ownerClerkId: "user_storybook",
  ownerImageUrl: null,
  ownerIsProfilePublic: true,
  ownerUserId: 1,
  ownerUsername: "collector",
  productId: 200,
  productImages: [],
  productSlug: "product-1",
  productTypeId: 1,
  productTypeName: "Slider",
  productTypeSlug: "slider",
  sourceProductFinishOptionId: null,
};

/** Ten distinct physical items exercise top-eight-plus-Other chart behavior. */
const items = Array.from(
  { length: 10 },
  (_, index): UserCollectionItem => ({
    ...baseItem,
    collectionId: index < 5 ? 1 : 2,
    collectionItemId: index + 1,
    displayName: `Product ${index + 1}`,
    makerId: 100 + index,
    makerName: `Maker ${index + 1}`,
    makerSlug: `maker-${index + 1}`,
    name: `Product ${index + 1}`,
    productId: 200 + index,
    productSlug: `product-${index + 1}`,
  }),
);

/** Thresholded and rounded community generations paired with the story data. */
const communityTrends: CommunityTrendsSource = {
  collectionItems: {
    generatedAt: new Date("2026-10-14T12:00:00.000Z"),
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
  makerProducts: {
    generatedAt: new Date("2026-10-14T12:00:00.000Z"),
    hasSuppressedValues: true,
    makerValues: [
      {
        collectorCount: 10,
        itemCount: 15,
        makerId: 100,
        makerName: "Maker 1",
        makerSlug: "maker-1",
        materialId: null,
        materialSpecificId: null,
        productId: null,
        productName: null,
        productSlug: null,
        productTypeId: null,
        productTypeSlug: null,
      },
    ],
    productValues: [
      {
        collectorCount: 10,
        itemCount: 15,
        makerId: 100,
        makerName: "Maker 1",
        makerSlug: "maker-1",
        materialId: null,
        materialSpecificId: null,
        productId: 200,
        productName: "Product 1",
        productSlug: "product-1",
        productTypeId: null,
        productTypeSlug: "slider",
      },
    ],
    stale: false,
  },
  materials: {
    collectorValues: [],
    generatedAt: new Date("2026-10-14T12:00:00.000Z"),
    hasSuppressedValues: true,
    itemValues: [
      {
        count: 15,
        isSpecificBreakdown: false,
        materialId: 300,
        materialName: "Titanium",
        materialSlug: "titanium",
        materialSpecificId: null,
        materialSpecificName: null,
        materialSpecificSlug: null,
        productTypeId: null,
      },
    ],
    stale: false,
  },
};
