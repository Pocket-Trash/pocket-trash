import type { CatalogImage, CatalogProduct } from "@package/services";
import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { ProductCard } from "./product-card";

const product: CatalogProduct = {
  buttonDiameterMm: null,
  canAdminister: false,
  canEdit: true,
  compatibleButtonId: null,
  compatibleButtonName: null,
  createdAt: new Date("2026-01-01"),
  diameterMm: "50.8",
  finishOptions: [
    {
      colorEffect: null,
      colors: [],
      finishes: [
        { id: 1000, name: "Machine finished", slug: "machine-finished" },
      ],
      id: 1000,
    },
  ],
  id: 1000,
  imageCount: 0,
  images: [],
  isAdminPrivate: false,
  isPrivate: false,
  lengthMm: null,
  makerId: 1000,
  makerName: "KAP EDC",
  makerUrl: "https://www.kapedc.com",
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
  thicknessMm: "12.7",
  thicknessWithButtonMm: null,
  updatedAt: new Date("2026-01-02"),
  weightG: "90",
  widthMm: null,
};

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
type Story = StoryObj<typeof meta>;

export const WithoutImage: Story = {};

export const WithImage: Story = {
  args: {
    imageCountLabel: "Images: 1",
    product: { ...product, imageCount: 1, images: [image] },
  },
};
