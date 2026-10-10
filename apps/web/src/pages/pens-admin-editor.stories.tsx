import type { CatalogProduct } from "@package/services";
import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect } from "storybook/test";
import type { CatalogOptions } from "@/lib/catalog-api";
import { StoryProviders } from "../../.storybook/story-fixtures";
import { PensAdminEditor } from "./catalog-form-pages";

/** Configurable Pen fixture with an earlier material prerequisite. */
const product: CatalogProduct = {
  aliases: ["Saga Pen"],
  approvalStatus: "approved",
  bearing: null,
  buttonDiameter: null,
  canAdminister: true,
  canEdit: true,
  clickCount: null,
  compatibleButtonId: null,
  compatibleButtonName: null,
  compatiblePens: [],
  configurationSlots: [
    {
      choices: [
        {
          availableWhen: [],
          finishOptionId: null,
          id: 1010,
          label: "Titanium",
          position: 0,
          productMaterialId: 1001,
        },
      ],
      id: 1000,
      labelFallback: "Material",
      labelKey: "catalog.configurationSlots.material",
      position: 0,
      required: true,
      slotKindId: 1000,
      slotKindSlug: "material",
    },
    {
      choices: [
        {
          availableWhen: [[1010]],
          finishOptionId: 1002,
          id: 1011,
          label: "Caramel PVD",
          position: 0,
        },
      ],
      id: 1001,
      labelFallback: "Appearance",
      labelKey: "catalog.configurationSlots.appearance",
      position: 1,
      required: true,
      slotKindId: 1001,
      slotKindSlug: "appearance",
    },
  ],
  createdAt: new Date(0),
  description: null,
  diameter: null,
  finishOptions: [],
  imageCount: 0,
  images: [],
  includedInsert: null,
  includedPlate: null,
  id: 1000,
  isAdminPrivate: false,
  isOwner: false,
  isPrivate: false,
  length: null,
  makerId: 1000,
  makerName: "Grimsmo",
  makerProductUrl: null,
  makerProductUrlValid: true,
  makerSlug: "grimsmo",
  makerUrl: null,
  magnetLayout: null,
  materials: [
    {
      assignmentId: 1001,
      id: 1001,
      name: "Titanium",
      slug: "titanium",
      specific: null,
    },
  ],
  name: "Saga",
  ownerClerkId: null,
  productTypeId: 1000,
  productTypeName: "Pen",
  productTypeSlug: "pen",
  refillModel: null,
  refillOfferings: [],
  slug: "saga",
  spinDiameter: null,
  thickness: null,
  thicknessWithButton: null,
  updatedAt: new Date(0),
  usesInserts: null,
  weight: null,
  width: null,
};

/** Pens administration lookup fixtures. */
const options: CatalogOptions = {
  colorEffects: [],
  colors: [],
  finishes: [],
  makers: [],
  materials: [],
  mechanisms: [],
  patterns: [],
  pensAdminOptions: {
    compatibilityEvidence: [],
    compatibilityGroupConcepts: [],
    compatibilityGroups: [],
    inkColors: [],
    markets: [{ id: 1000, name: "Global", slug: "GLOBAL" }],
    offerings: [],
    slotKinds: [
      { id: 1000, name: "Material", slug: "material" },
      { id: 1001, name: "Appearance", slug: "appearance" },
    ],
    sourceEvidence: [],
    tipStyles: [],
  },
  productTypes: [],
  relationshipProducts: [],
  spinnerButtons: [],
};

/** Storybook metadata for the Pens administration editor. */
const meta = {
  args: { options, product },
  component: PensAdminEditor,
  decorators: [
    (Story) => (
      <StoryProviders>
        <Story />
      </StoryProviders>
    ),
  ],
  parameters: { layout: "padded" },
  title: "Components/PensAdminEditor",
} satisfies Meta<typeof PensAdminEditor>;

export default meta;
/** Story type derived from the Pens administration metadata. */
type Story = StoryObj<typeof meta>;

/** Availability rules expose only choices from earlier slots. */
export const AvailabilityRule: Story = {
  /**
   * Verifies that rule requirements are limited to earlier slots.
   *
   * @param root0 - Story interaction context.
   * @param root0.canvas - Rendered story canvas.
   * @param root0.userEvent - Browser interaction helper.
   * @returns A promise that resolves after the assertions complete.
   */
  play: async ({ canvas, userEvent }) => {
    await userEvent.selectOptions(
      canvas.getByRole("combobox", { name: "web.pens.admin.actionLabel" }),
      "configuration-rule",
    );
    await userEvent.selectOptions(
      canvas.getByRole("combobox", { name: "web.pens.admin.targetChoice" }),
      "1011",
    );
    const requirements = canvas.getByRole("listbox", {
      name: "web.pens.admin.availableWhenAnd",
    });
    await expect(requirements).toHaveTextContent("Material: Titanium");
    await expect(requirements).not.toHaveTextContent("Caramel PVD");
    await userEvent.selectOptions(requirements, "1010");
    await expect(
      canvas
        .getAllByText(/web\.pens\.admin\.availableWhen/)
        .find(({ tagName }) => tagName === "P"),
    ).toHaveTextContent("Material: Titanium");
  },
};
