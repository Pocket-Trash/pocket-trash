import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { CollectionCard } from "./collection-card";

const collection = {
  coverImage: null,
  coverImages: [],
  createdAt: new Date("2026-01-01"),
  description: "Everyday carry spinners and buttons.",
  id: 1000,
  isAdminPrivate: false,
  isPrivate: true,
  itemCount: 12,
  name: "Daily Carry",
  ownerUserId: 1000,
  updatedAt: new Date("2026-01-02"),
};

const meta = {
  component: CollectionCard,
  args: {
    collection,
    coverAlt: "Cover for Daily Carry",
    itemCountLabel: "Collection items: 12",
    privateLabel: "Private",
  },
} satisfies Meta<typeof CollectionCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Private: Story = {};

export const Public: Story = {
  args: { collection: { ...collection, isPrivate: false } },
};

export const Empty: Story = {
  args: {
    collection: { ...collection, description: null, itemCount: 0 },
    itemCountLabel: "Collection items: 0",
  },
};
