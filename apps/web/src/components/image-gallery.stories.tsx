import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, within } from "storybook/test";
import { StoryProviders } from "../../.storybook/story-fixtures";
import { ImageGallery } from "./image-gallery";

/**
 * Product image fixtures shared by the gallery stories.
 */
const productImages = [
  image(1, "one.webp", "product-images"),
  image(2, "eleven.webp", "product-images"),
  image(3, "five.webp", "product-images"),
  image(4, "four.webp", "product-images"),
  image(5, "nine.webp", "product-images"),
  image(6, "seven.webp", "product-images"),
  image(7, "six.webp", "product-images"),
  image(8, "ten.webp", "product-images"),
  image(9, "three.webp", "product-images"),
  image(10, "twelve.webp", "product-images"),
];
/**
 * Collection image fixtures shared by the gallery stories.
 */
const collectionImages = [
  image(101, "thirteen.webp", "collection-images"),
  image(102, "two.webp", "collection-images"),
];
/**
 * First product image used by lightbox assertions.
 */
const firstProductImage = productImages[0];
/**
 * Second product image used by lightbox assertions.
 */
const secondProductImage = productImages[1];
if (!firstProductImage || !secondProductImage) {
  throw new Error("Image gallery stories require product images.");
}

/**
 * Configures Storybook coverage for the image gallery examples.
 */
const meta = {
  args: {
    alt: "Catalog item",
    closeLabel: "Close image",
    groups: [{ images: productImages }],
    label: "Images",
    nextLabel: "Next image",
    previousLabel: "Previous image",
  },
  component: ImageGallery,
  decorators: [
    (Story) => (
      <StoryProviders>
        <div className="w-[68rem] max-w-full">
          <Story />
        </div>
      </StoryProviders>
    ),
  ],
  title: "Components/ImageGallery",
} satisfies Meta<typeof ImageGallery>;

export default meta;
/**
 * Storybook story contract for the image gallery examples.
 */
type Story = StoryObj<typeof meta>;

/**
 * Defines the thumbnails image gallery story.
 */
export const Thumbnails: Story = {};

/**
 * Defines the grouped image gallery story.
 */
export const Grouped: Story = {
  args: {
    groups: [
      { images: collectionImages, label: "Collection images" },
      { images: productImages, label: "Product images" },
    ],
  },
};

/**
 * Defines the grouped collection only image gallery story.
 */
export const GroupedCollectionOnly: Story = {
  args: {
    groups: [{ images: collectionImages, label: "Collection images" }],
  },
};

/**
 * Defines the grouped product only image gallery story.
 */
export const GroupedProductOnly: Story = {
  args: {
    groups: [{ images: productImages, label: "Product images" }],
  },
};

/**
 * Defines the empty image gallery story.
 */
export const Empty: Story = { args: { groups: [] } };

/**
 * Defines the lightbox navigation image gallery story.
 */
export const LightboxNavigation: Story = {
  /**
   * Exercises the image gallery story interaction and assertions.
   *
   * @param context - Storybook interaction context.
   * @param context.canvas - Queries scoped to the rendered story canvas.
   * @param context.canvasElement - Rendered Storybook canvas element.
   * @param context.userEvent - Storybook interaction driver.
   */
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(
      canvas.getByRole("button", {
        name: `Images: ${firstProductImage.fileName}`,
      }),
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
      secondProductImage.url,
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Close image" }),
    );
    await expect(dialog).not.toBeVisible();
  },
};

/**
 * Creates a gallery image fixture.
 *
 * @param id - Stable image identifier.
 * @param fileName - Stored file name.
 * @param folder - Storybook asset folder.
 * @returns A gallery image fixture.
 */
function image(id: number, fileName: string, folder: string) {
  return {
    fileName,
    id,
    url: `https://cdn.pocket-trash.app/assets/storybook/${folder}/${fileName}`,
  };
}
