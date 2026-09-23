import type { CatalogImage, UserCollectionSummary } from "@package/services";
import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { CollectionCard } from "./collection-card";

const coverImage: CatalogImage = {
  contentType: "image/webp",
  createdAt: new Date("2026-01-01"),
  deletedAt: null,
  deletedByClerkId: null,
  deletedByRole: null,
  fileName: "thirteen.webp",
  id: 1000,
  objectPath: "assets/storybook/collection-images/thirteen.webp",
  position: 0,
  size: 1024,
  url: "https://cdn.pocket-trash.app/assets/storybook/collection-images/thirteen.webp",
};

const collection: UserCollectionSummary = {
  coverImage: null,
  coverImages: [],
  createdAt: new Date("2026-01-01"),
  description: "Everyday carry spinners and buttons.",
  id: 1000,
  isAdminPrivate: false,
  isPrivate: false,
  itemCount: 12,
  name: "Daily Carry",
  ownerUserId: 1000,
  updatedAt: new Date("2026-01-02"),
};

const meta = {
  args: {
    collection,
    coverAlt: "Cover for Daily Carry",
    itemCountLabel: "Collection items: 12",
    ownerName: "royanger",
    privateLabel: "Private",
  },
  component: CollectionCard,
  decorators: [
    (Story) => (
      <div className="w-96 max-w-full">
        <Story />
      </div>
    ),
  ],
  title: "Components/CollectionCard",
} satisfies Meta<typeof CollectionCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithoutImage: Story = {};

export const WithImage: Story = {
  args: {
    collection: {
      ...collection,
      coverImage,
      coverImages: [coverImage],
    },
  },
};
