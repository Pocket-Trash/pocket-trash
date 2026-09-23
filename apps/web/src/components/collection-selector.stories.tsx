import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, fn } from "storybook/test";
import { CollectionSelector } from "./collection-selector";

const collections = [
  {
    coverImage: null,
    coverImages: [],
    createdAt: new Date("2026-01-01"),
    description: null,
    id: 1000,
    isAdminPrivate: false,
    isPrivate: true,
    itemCount: 3,
    name: "Daily Carry",
    ownerUserId: 1000,
    updatedAt: new Date("2026-01-01"),
  },
];

const meta = {
  component: CollectionSelector,
  args: {
    addLabel: "Add new collection",
    collections,
    label: "Collection",
    onAdd: fn(),
    onChange: fn(),
    placeholder: "Select a collection",
    selectedId: null,
  },
  title: "Components/CollectionSelector",
} satisfies Meta<typeof CollectionSelector>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = { args: { collections: [] } };

export const Selected: Story = { args: { selectedId: 1000 } };

export const AddNew: Story = {
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole("button", { name: args.addLabel }));
    await expect(args.onAdd).toHaveBeenCalledOnce();
  },
};
