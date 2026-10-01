import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, fn } from "storybook/test";
import { CollectionSelector } from "./collection-selector";

/**
 * Collection choices shared by the selector stories.
 */
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

/**
 * Configures Storybook coverage for the collection selector examples.
 */
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
/**
 * Storybook story contract for the collection selector examples.
 */
type Story = StoryObj<typeof meta>;

/**
 * Defines the empty collection selector story.
 */
export const Empty: Story = { args: { collections: [] } };

/**
 * Defines the selected collection selector story.
 */
export const Selected: Story = { args: { selectedId: 1000 } };

/**
 * Defines the add new collection selector story.
 */
export const AddNew: Story = {
  /**
   * Exercises the collection selector story interaction and assertions.
   *
   * @param context - Storybook interaction context.
   * @param context.canvas - Queries scoped to the rendered story canvas.
   * @param context.userEvent - Storybook interaction driver.
   * @param context.args - Current Storybook story arguments.
   */
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole("button", { name: args.addLabel }));
    await expect(args.onAdd).toHaveBeenCalledOnce();
  },
};
