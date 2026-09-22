import type { CatalogImage, UserCollectionSummary } from "@package/services";
import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, fn } from "storybook/test";
import { CollectionCoverManager } from "./collection-form";

const current = image(1000, "current.webp", 1);
const previous = image(1001, "previous.webp", 0);
const collection: UserCollectionSummary = {
  coverImage: current,
  coverImages: [current, previous],
  createdAt: new Date("2026-01-01"),
  description: null,
  id: 1000,
  isAdminPrivate: false,
  isPrivate: true,
  itemCount: 3,
  name: "Daily Carry",
  ownerUserId: 1000,
  updatedAt: new Date("2026-01-02"),
};

const meta = {
  component: CollectionCoverManager,
  args: {
    collection,
    copy: {
      clear: "Clear cover",
      clearConfirmation: "Clear the current cover?",
      current: "Current cover",
      delete: "Delete cover",
      deleteConfirmation: "Permanently delete this cover?",
      history: "Previous covers",
      select: "Use this cover",
    },
    onClear: fn(),
    onDelete: fn(),
    onSelect: fn(),
  },
  title: "Components/CollectionCoverManager",
} satisfies Meta<typeof CollectionCoverManager>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CurrentAndHistory: Story = {
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Use this cover" }),
    );
    await expect(args.onSelect).toHaveBeenCalledWith(previous);
  },
};

export const ClearedWithHistory: Story = {
  args: {
    collection: { ...collection, coverImage: null },
  },
};

export const ConfirmClear: Story = {
  beforeEach: () => {
    window.confirm = fn(() => true);
  },
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Clear cover" }));
    await expect(args.onClear).toHaveBeenCalledOnce();
  },
};

export const ConfirmDelete: Story = {
  beforeEach: () => {
    window.confirm = fn(() => true);
  },
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Delete cover" }));
    await expect(args.onDelete).toHaveBeenCalledWith(previous);
  },
};

function image(id: number, fileName: string, position: number): CatalogImage {
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
    url: `https://placehold.co/640x480/webp?text=${fileName}`,
  };
}
