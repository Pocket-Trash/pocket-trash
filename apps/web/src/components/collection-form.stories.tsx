import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, fn } from "storybook/test";
import { StoryProviders } from "../../.storybook/story-fixtures";
import { CollectionForm } from "./collection-form";

const copy = {
  browse: "Browse",
  cover: "Cover image",
  description: "Description",
  descriptionPlaceholder: "Describe this collection",
  imageHelp: "Choose an optional cover image.",
  imageTypes: "Allowed image types: JPEG, PNG, and WebP.",
  name: "Name",
  namePlaceholder: "Collection name",
  public: "Public",
  removeFile: "Remove file",
  submit: "Save",
};

const meta = {
  component: CollectionForm,
  args: { copy, onSubmit: fn() },
  decorators: [
    (Story) => (
      <StoryProviders>
        <Story />
      </StoryProviders>
    ),
  ],
  title: "Components/CollectionForm",
} satisfies Meta<typeof CollectionForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NewPrivate: Story = {};

export const EditPublic: Story = {
  args: {
    initialValue: {
      description: "Everyday carry spinners.",
      isPrivate: false,
      name: "Daily Carry",
    },
  },
};

export const Submit: Story = {
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.type(
      canvas.getByRole("textbox", { name: "Name" }),
      "Daily Carry",
    );
    await userEvent.click(canvas.getByRole("button", { name: "Save" }));
    await expect(args.onSubmit).toHaveBeenCalled();
  },
};
