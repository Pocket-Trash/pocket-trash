import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, within } from "storybook/test";
import { StoryProviders } from "../../.storybook/story-fixtures";
import { ImageGallery } from "./image-gallery";

const productImage = {
  fileName: "product.jpg",
  id: 1,
  url: "/images/navigation/q3d-seigaiha.jpg",
};
const collectionImage = {
  fileName: "collection.webp",
  id: 2,
  url: "/images/navigation/collections.webp",
};
const images = [productImage, collectionImage];

const meta = {
  args: {
    alt: "Catalog item",
    closeLabel: "Close image",
    groups: [{ images }],
    label: "Images",
    nextLabel: "Next image",
    previousLabel: "Previous image",
  },
  component: ImageGallery,
  decorators: [
    (Story) => (
      <StoryProviders>
        <div className="w-[44rem] max-w-full">
          <Story />
        </div>
      </StoryProviders>
    ),
  ],
  title: "Components/ImageGallery",
} satisfies Meta<typeof ImageGallery>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Thumbnails: Story = {};

export const Grouped: Story = {
  args: {
    groups: [
      { images: [productImage], label: "Collection images" },
      { images: [collectionImage], label: "Product images" },
    ],
  },
};

export const Empty: Story = { args: { groups: [] } };

export const LightboxNavigation: Story = {
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Images: product.jpg" }),
    );
    const dialog = within(canvasElement.ownerDocument.body).getByRole(
      "dialog",
      { name: "Images" },
    );
    await expect(dialog).toBeVisible();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Next image" }),
    );
    await expect(within(dialog).getByRole("img")).toHaveAttribute(
      "src",
      collectionImage.url,
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Close image" }),
    );
    await expect(dialog).not.toBeVisible();
  },
};
