import type { CatalogImage, CatalogProduct } from "@package/services";
import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { ProductCard } from "./product-card";

/**
 * Catalog product fixture without images.
 */
const product: CatalogProduct = {
  approvalStatus: "approved",
  bearing: null,
  buttonDiameter: null,
  clickCount: null,
  canAdminister: false,
  canEdit: true,
  compatibleButtonId: null,
  compatibleButtonName: null,
  createdAt: new Date("2026-01-01"),
  description: null,
  diameter: { unit: "mm", value: "50.8" },
  finishOptions: [
    {
      colorEffect: null,
      colors: [],
      finishes: [
        { id: 1000, name: "Machine finished", slug: "machine-finished" },
      ],
      id: 1000,
      pattern: null,
    },
  ],
  id: 1000,
  imageCount: 0,
  images: [],
  includedInsert: null,
  includedPlate: null,
  isAdminPrivate: false,
  isPrivate: false,
  length: null,
  makerId: 1000,
  makerName: "KAP EDC",
  makerSlug: "kap-edc",
  makerProductUrl: null,
  makerProductUrlValid: true,
  makerUrl: "https://www.kapedc.com",
  magnetLayout: null,
  usesInserts: null,
  materials: [
    { id: 1000, name: "Bronze", slug: "bronze" },
    { id: 1001, name: "Titanium", slug: "titanium" },
  ],
  name: "Katla",
  ownerClerkId: "user_storybook",
  productTypeId: 1000,
  productTypeName: "Spinner",
  productTypeSlug: "spinner",
  slug: "katla",
  spinDiameter: null,
  thickness: { unit: "mm", value: "12.7" },
  thicknessWithButton: null,
  updatedAt: new Date("2026-01-02"),
  weight: { unit: "g", value: "90" },
  width: null,
};

/**
 * Active catalog image fixture added by the image story.
 */
const image: CatalogImage = {
  contentType: "image/webp",
  createdAt: new Date("2026-01-01"),
  deletedAt: null,
  deletedByClerkId: null,
  deletedByRole: null,
  fileName: "one.webp",
  id: 1000,
  objectPath: "assets/storybook/product-images/one.webp",
  position: 0,
  size: 1024,
  url: "https://cdn.pocket-trash.app/assets/storybook/product-images/one.webp",
};

/**
 * Configures Storybook coverage for the product card examples.
 */
const meta = {
  args: {
    finishOptionCountLabel: "Finish options: 1",
    imageAlt: "Katla product image",
    imageCountLabel: "Images: 0",
    materialCountLabel: "Materials: 2",
    privateLabel: "Private",
    product,
  },
  component: ProductCard,
  decorators: [
    (Story) => (
      <div className="w-96 max-w-full">
        <Story />
      </div>
    ),
  ],
  title: "Components/ProductCard",
} satisfies Meta<typeof ProductCard>;

export default meta;
/**
 * Storybook story contract for the product card examples.
 */
type Story = StoryObj<typeof meta>;

/**
 * Defines the without image product card story.
 */
export const WithoutImage: Story = {};

/**
 * Defines the with image product card story.
 */
export const WithImage: Story = {
  args: {
    imageCountLabel: "Images: 1",
    product: { ...product, imageCount: 1, images: [image] },
  },
};
