import type { CatalogImage, UserCollectionSummary } from "@package/services";
import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, within } from "storybook/test";
import { CollectionGallery } from "./collection-gallery";

const cover = image(1000, "thirteen.webp", 0, "collection-images");
const gallery = ["one", "eleven", "five", "four", "nine", "seven", "six"].map(
  (name, index) =>
    image(1001 + index, `${name}.webp`, index + 1, "product-images"),
);
const collection: UserCollectionSummary = {
  coverImage: cover,
  coverImages: [cover, ...gallery],
  createdAt: new Date("2026-01-01"),
  description: "Everyday carry spinners and buttons.",
  id: 1000,
  isAdminPrivate: false,
  isPrivate: false,
  itemCount: 8,
  name: "Daily Carry",
  ownerUserId: 1000,
  updatedAt: new Date("2026-01-02"),
};

const meta = {
  args: {
    collection,
    copy: {
      closeImage: "Close image",
      gallery: "Gallery",
      imageAlt: "Daily Carry collection image",
      itemCount: "Collection items: 8",
      nextImage: "Next image",
      nextPage: "Next page",
      owner: "Owner: royanger",
      pageStatus: (page, pageCount) => `Page ${page} of ${pageCount}`,
      previousImage: "Previous image",
      previousPage: "Previous page",
      visibility: "Public",
    },
  },
  component: CollectionGallery,
  parameters: { layout: "fullscreen" },
  title: "Components/CollectionGallery",
} satisfies Meta<typeof CollectionGallery>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MultiPage: Story = {
  play: async ({ canvas, canvasElement, userEvent }) => {
    await expect(canvas.getByText("Page 1 of 2")).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: "Previous page" }),
    ).toBeDisabled();
    await expect(
      canvas.queryByRole("button", { name: "Gallery: one.webp" }),
    ).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Next page" }));
    await expect(canvas.getByText("Page 2 of 2")).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: "Next page" }),
    ).toBeDisabled();
    await userEvent.click(
      canvas.getByRole("button", { name: "Gallery: one.webp" }),
    );
    const dialog = within(canvasElement.ownerDocument.body).getByRole(
      "dialog",
      { name: "Gallery" },
    );
    await expect(within(dialog).getByRole("img")).toHaveAttribute(
      "src",
      gallery[0]?.url,
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Next image" }),
    );
    await expect(within(dialog).getByRole("img")).toHaveAttribute(
      "src",
      cover.url,
    );
  },
};

export const SinglePage: Story = {
  args: {
    collection: {
      ...collection,
      coverImages: [cover, ...gallery.slice(0, 2)],
    },
  },
  play: async ({ canvas }) => {
    await expect(
      canvas.queryByRole("button", { name: "Next page" }),
    ).not.toBeInTheDocument();
  },
};

export const EmptyGallery: Story = {
  args: {
    collection: { ...collection, coverImage: null, coverImages: [] },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Daily Carry")).toBeVisible();
    await expect(canvas.queryByText("Gallery")).not.toBeInTheDocument();
  },
};

export const Mobile: Story = {
  globals: { viewport: "mobile1" },
};

function image(
  id: number,
  fileName: string,
  position: number,
  folder: string,
): CatalogImage {
  return {
    contentType: "image/webp",
    createdAt: new Date("2026-01-01"),
    deletedAt: null,
    deletedByClerkId: null,
    deletedByRole: null,
    fileName,
    id,
    objectPath: `collections/1000/${fileName}`,
    position,
    size: 1024,
    url: `https://cdn.pocket-trash.app/assets/storybook/${folder}/${fileName}`,
  };
}
