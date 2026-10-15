import type { CatalogProduct } from "@package/services";
import type { Meta, StoryObj } from "@storybook/tanstack-react";
import type { CatalogOptions } from "@/lib/catalog-api";
import { StoryProviders } from "../../.storybook/story-fixtures";
import { PensAdminEditor } from "./catalog-form-pages";

/** Pen fixture for refill administration. */
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
  compatibleParts: [],
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
    compatibilityAssertions: [],
    compatibilityGroupConcepts: [],
    compatibilityGroups: [],
    compatibilityMemberships: [],
    inkColors: [],
    offerings: [],
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

/** Default Pens administration editor. */
export const Default: Story = {};
