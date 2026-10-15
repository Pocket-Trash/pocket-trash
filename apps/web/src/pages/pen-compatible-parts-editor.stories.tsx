import type { CatalogProduct } from "@package/services";
import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, waitFor, within } from "storybook/test";
import type { CatalogOptions } from "@/lib/catalog-api";
import { mockStoryRole, StoryProviders } from "../../.storybook/story-fixtures";
import { ProductEditor } from "./catalog-form-pages";

/**
 * Creates a compact Pen or Pen-part fixture for relationship stories.
 *
 * @param id - Stable product identifier.
 * @param name - Product display name.
 * @param productTypeSlug - Canonical Pen or part type.
 * @returns Complete catalog product fixture.
 */
function product(
  id: number,
  name: string,
  productTypeSlug: "pen" | "pen-clip" | "pen-tip",
): CatalogProduct {
  return {
    aliases: [],
    approvalStatus: "approved",
    bearing: null,
    buttonDiameter: null,
    canAdminister: false,
    canEdit: true,
    clickCount: null,
    compatibleButtonId: null,
    compatibleButtonName: null,
    compatiblePens: [],
    compatibleParts: [],
    createdAt: new Date(0),
    description: null,
    diameter: null,
    finishOptions: [],
    imageCount: 0,
    images: [],
    includedInsert: null,
    includedPlate: null,
    isAdminPrivate: false,
    isOwner: true,
    isPrivate: false,
    id,
    length: null,
    makerId: 1000,
    makerName: "Test Maker",
    makerProductUrl: null,
    makerProductUrlValid: true,
    makerSlug: "test-maker",
    makerUrl: null,
    magnetLayout: null,
    materials: [
      {
        assignmentId: 1000 + id,
        id: 1000,
        name: "Titanium",
        slug: "titanium",
        specific: null,
      },
    ],
    name,
    ownerClerkId: "user_test",
    productTypeId: id,
    productTypeName: productTypeSlug,
    productTypeSlug,
    refillCompatibility: [],
    refillModel: null,
    refillOfferings: [],
    slug: name.toLowerCase().replaceAll(" ", "-"),
    spinDiameter: null,
    thickness: null,
    thicknessWithButton: null,
    updatedAt: new Date(0),
    usesInserts: null,
    weight: null,
    width: null,
  };
}

/** Selectable Pen-tip fixture. */
const tip = product(1001, "Fine Tip", "pen-tip");
/** Selectable Pen-clip fixture. */
const clip = product(1002, "Machined Clip", "pen-clip");
/** Existing Pen with selections in two roles. */
const pen = {
  ...product(1000, "Test Pen", "pen"),
  compatibleParts: [tip, clip].map(
    ({ id, name, productTypeName, productTypeSlug, slug }) => ({
      id,
      name,
      productTypeName,
      productTypeSlug,
      slug,
    }),
  ),
};
/** Catalog lookups required by the complete product editor. */
const options: CatalogOptions = {
  colorEffects: [],
  colors: [],
  finishes: [],
  makers: [
    {
      description: null,
      id: 1000,
      images: [],
      name: "Test Maker",
      rootUrl: null,
      slug: "test-maker",
    },
  ],
  materials: [
    {
      id: 1000,
      name: "Titanium",
      slug: "titanium",
    },
  ],
  mechanisms: [],
  patterns: [],
  productTypes: [],
  relationshipProducts: [tip, clip],
  spinnerButtons: [],
};

/** Storybook metadata for Pen compatible-part editing. */
const meta = {
  args: {
    initialProduct: pen,
    options,
    productTypeSlug: "pen",
  },
  component: ProductEditor,
  /**
   * Configures a signed-in editor before each story.
   *
   * @returns Completion after installing the Clerk mocks.
   */
  beforeEach: () => mockStoryRole("editor"),
  decorators: [
    (Story) => (
      <StoryProviders>
        <Story />
      </StoryProviders>
    ),
  ],
  parameters: { layout: "padded" },
  title: "Components/PenCompatiblePartsEditor",
} satisfies Meta<typeof ProductEditor>;

export default meta;
/** Story type derived from the compatible-part editor metadata. */
type Story = StoryObj<typeof meta>;

/** Shows multiple selected part roles and removable selections. */
export const ExistingSelections: Story = {
  /**
   * Removes one selection while leaving the other role intact.
   *
   * @param root0 - Story interaction context.
   */
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.getByText("Fine Tip")).toBeVisible();
    await expect(canvas.getByText("Machined Clip")).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Remove Fine Tip" }),
    );
    await expect(canvas.queryByText("Fine Tip")).not.toBeInTheDocument();
  },
};

/** Opens full inline part creation and restores focus when canceled. */
export const InlineCreationCancel: Story = {
  /**
   * Opens and cancels embedded creation, then checks focus restoration.
   *
   * @param root0 - Story interaction context.
   * @rejects When the Pen-tip creation control is absent.
   */
  play: async ({ canvas, canvasElement, userEvent }) => {
    const addButtons = canvas.getAllByRole("button", { name: "Add product" });
    const addTip = addButtons[0];
    if (!addTip) throw new Error("Missing Pen-tip creation control.");
    await userEvent.click(addTip);
    const page = within(canvasElement.ownerDocument.body);
    const dialog = await page.findByRole("dialog", { name: "Add product" });
    await expect(dialog).toBeVisible();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Cancel" }),
    );
    await waitFor(() => expect(addTip).toHaveFocus());
  },
};
