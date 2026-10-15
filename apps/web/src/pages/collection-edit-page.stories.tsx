import type {
  CatalogProduct,
  UserCollectionItem,
  UserCollectionSummary,
} from "@package/services";
import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, within } from "storybook/test";
import { mockStoryAuth, StoryProviders } from "../../.storybook/story-fixtures";
import { CollectionEditPage } from "./catalog-form-pages";

/** Material shared by the slider assembly story fixtures. */
const material = {
  specific: null,
  id: 1000,
  name: "Titanium",
  slug: "titanium",
};

/**
 * Creates a compact catalog product for an assembly member.
 *
 * @param id - Product identifier.
 * @param name - Product display name.
 * @param productTypeSlug - Slider subtype slug.
 * @returns A catalog-product story fixture.
 */
function product(
  id: number,
  name: string,
  productTypeSlug: "slider" | "slider-insert" | "slider-plate",
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
    finishOptions: [],
    id,
    imageCount: 0,
    images: [],
    includedInsert: null,
    includedPlate: null,
    isAdminPrivate: false,
    isPrivate: false,
    length: null,
    usesInserts: productTypeSlug === "slider" ? true : null,
    makerId: 1000,
    makerName: "Assembly maker",
    makerSlug: "assembly-maker",
    makerProductUrl: null,
    makerProductUrlValid: true,
    makerUrl: null,
    magnetLayout: productTypeSlug === "slider" ? "2x4" : null,
    materials: [{ assignmentId: 1000, materials: [material], weight: null }],
    name,
    refillModel: null,
    refillOfferings: [],
    ownerClerkId: "user_storybook",
    productTypeId: id,
    productTypeName:
      productTypeSlug === "slider"
        ? "Slider"
        : productTypeSlug === "slider-plate"
          ? "Slider plate"
          : "Slider insert",
    productTypeSlug,
    slug: name.toLowerCase().replaceAll(" ", "-"),
    spinDiameter: null,
    thickness: null,
    thicknessWithButton: null,
    updatedAt: new Date(0),
    weight: null,
    width: null,
  };
}

/** Slider catalog product used by the edit page. */
const slider = product(2000, "Assembly slider", "slider");
/** Plate catalog product used by the edit page. */
const plate = product(2001, "Assembly plate", "slider-plate");
/** Insert catalog product used by the edit page. */
const insert = product(2002, "Assembly insert", "slider-insert");
/** Insert catalog product used by the setup editor story. */

/**
 * Creates one owned assembly item.
 *
 * @param collectionItemId - Collection-item identifier.
 * @param catalogProduct - Source catalog product.
 * @param displayName - Optional collection display name.
 * @returns An owned collection-item story fixture.
 */
function item(
  collectionItemId: number,
  catalogProduct: CatalogProduct,
  displayName = catalogProduct.name,
): UserCollectionItem {
  return {
    approvalStatus: "approved",
    bearing: null,
    bearingOverride: null,
    canAdminister: false,
    canEdit: true,
    collectionId: 3000,
    collectionIsPrivate: false,
    collectionItemId,
    collectionName: "Daily carry",
    compatibleButtonId: null,
    compatibleButtonName: null,
    description: null,
    descriptionOverride: null,
    displayName,
    finishOption: null,
    effectiveSliderSetup: null,
    imageCount: 0,
    images: [],
    installedButtonId: null,
    installedInsertId: null,
    installedOnSliderId: null,
    installedPlateId: null,
    includedInsert: null,
    includedPlate: null,
    isAdminPrivate: false,
    isOwner: true,
    isPrivate: false,
    makerId: catalogProduct.makerId,
    makerName: catalogProduct.makerName,
    makerSlug: catalogProduct.makerSlug,
    makerUrl: null,
    materials: [material],
    name: catalogProduct.name,
    ownerClerkId: "user_storybook",
    ownerUserId: 1000,
    ownerImageUrl: null,
    ownerUsername: "collector",
    productId: catalogProduct.id,
    productImages: [],
    productSlug: catalogProduct.slug,
    productTypeId: catalogProduct.productTypeId,
    productTypeName: catalogProduct.productTypeName,
    productTypeSlug: catalogProduct.productTypeSlug,
    sourceProductFinishOptionId: null,
  };
}

/** Installed plate item. */
const installedPlate = {
  ...item(4001, plate, "Installed plate"),
  installedOnSliderId: 4000,
};
/** Installed insert item. */
const installedInsert = {
  ...item(4002, insert, "Installed insert"),
  installedOnSliderId: 4000,
};
/** Available replacement plate. */
const sparePlate = item(4003, plate, "Spare plate");
/** Plate installed on a different slider and therefore unavailable. */
const busyPlate = {
  ...item(4004, plate, "Busy plate"),
  installedOnSliderId: 4999,
};
/** Parent slider item with a complete installed assembly. */
const sliderItem = {
  ...item(4000, slider),
  installedInsertId: installedInsert.collectionItemId,
  installedPlateId: installedPlate.collectionItemId,
  ownershipPeriods: [
    {
      effectiveEndDate: "2025-06-01",
      effectiveStartDate: "2025-01-15",
      endedRecordedAt: new Date("2025-06-02T12:00:00Z"),
      entryReason: "purchase" as const,
      exitReason: "sale" as const,
      id: 5000,
      startDateImputed: false,
      startedRecordedAt: new Date("2025-01-16T12:00:00Z"),
      updatedAt: new Date("2025-06-02T12:00:00Z"),
    },
    {
      effectiveEndDate: null,
      effectiveStartDate: "2025-09-10",
      endedRecordedAt: null,
      entryReason: "trade" as const,
      exitReason: null,
      id: 5001,
      startDateImputed: false,
      startedRecordedAt: new Date("2025-09-11T12:00:00Z"),
      updatedAt: new Date("2025-09-11T12:00:00Z"),
    },
  ],
};

/** Destination collection offered by the edit page. */
const collection: UserCollectionSummary = {
  coverImage: null,
  coverImages: [],
  createdAt: new Date(0),
  description: null,
  id: 3000,
  isAdminPrivate: false,
  isPrivate: false,
  itemCount: 5,
  name: "Daily carry",
  ownerUserId: 1000,
  summary: null,
  updatedAt: new Date(0),
};

/** Slider assembly edit page configuration. */
const meta = {
  args: {
    buttonProducts: [],
    collections: [collection],
    item: sliderItem,
    options: {
      colorEffects: [],
      colors: [],
      finishes: [],
      makers: [],
      mechanisms: [],
      materials: [material],
      patterns: [],
      productTypes: [],
      relationshipProducts: [slider, plate, insert],
      spinnerButtons: [],
    },
    ownedButtons: [],
    ownedSliderComponents: [
      installedPlate,
      installedInsert,
      sparePlate,
      busyPlate,
    ],
    product: slider,
  },
  beforeEach: mockStoryAuth,
  component: CollectionEditPage,
  decorators: [
    (Story) => (
      <StoryProviders>
        <Story />
      </StoryProviders>
    ),
  ],
  parameters: { layout: "fullscreen" },
  title: "Components/CollectionEditPage",
} satisfies Meta<typeof CollectionEditPage>;

export default meta;
/** Slider assembly edit story contract. */
type Story = StoryObj<typeof meta>;

/** Installed insert-driven assembly with replacement choices. */
export const InstalledSliderAssembly: Story = {
  /**
   * Verifies installed state restoration and exclusion of components installed elsewhere.
   *
   * @param context - Story interaction context.
   * @param context.canvas - Rendered story queries.
   * @param context.canvasElement - Story canvas root.
   * @param context.userEvent - Browser interaction driver.
   * @returns A promise that resolves after the selector assertions pass.
   */
  play: async ({ canvas, canvasElement, userEvent }) => {
    const historySelector = canvas.getByRole("combobox", {
      name: /ownership history|web\.collections\.lifecycle\.title/iu,
    });
    await userEvent.click(historySelector);
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      await page.findByRole("option", { name: "2025-01-15 – 2025-06-01" }),
    );
    await expect(
      canvas.getByLabelText(
        /^(acquisition date|web\.collections\.lifecycle\.acquisitionDate)$/iu,
      ),
    ).toHaveValue("2025-01-15");
    const plateSelector = canvas.getByRole("combobox", {
      name: /installed plate|web\.slider\.component\.installedPlate/iu,
    });
    await expect(plateSelector).toHaveValue("Installed plate");
    await userEvent.click(plateSelector);
    await expect(
      await page.findByRole("option", { name: "Spare plate" }),
    ).toBeVisible();
    await expect(
      page.queryByRole("option", { name: "Busy plate" }),
    ).not.toBeInTheDocument();
    await userEvent.click(page.getByRole("option", { name: "Spare plate" }));
    await expect(plateSelector).toHaveValue("Spare plate");
  },
};
