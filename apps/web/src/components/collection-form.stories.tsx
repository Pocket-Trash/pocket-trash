import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, fn } from "storybook/test";
import { StoryProviders } from "../../.storybook/story-fixtures";
import { CollectionForm } from "./collection-form";

const copy = {
  browse: "Browse",
  cover: "Images",
  description: "Description",
  descriptionPlaceholder: "Describe this collection",
  imageHelp: "Choose up to ten images. The first image is the cover.",
  imageTypes: "Allowed image types: JPEG, PNG, WebP, and AVIF.",
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
/** Collection form story type. */
type Story = StoryObj<typeof meta>;

/** Empty private collection form story. */
export const NewPrivate: Story = {};

/** Populated public collection form story. */
export const EditPublic: Story = {
  args: {
    initialValue: {
      description: "Everyday carry spinners.",
      isPrivate: false,
      name: "Daily Carry",
    },
  },
  /**
   * Verifies initial description and visibility values.
   *
   * @param context - Story interaction context.
   * @returns A promise that resolves after assertions complete.
   */
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByRole("textbox", { name: "Description" }),
    ).toHaveTextContent("Everyday carry spinners.");
    await expect(canvas.getAllByText("3 / 200 words")[0]).toBeVisible();
    await expect(canvas.getByRole("switch", { name: "Public" })).toBeChecked();
  },
};

/** Immediate Markdown submission story. */
export const Submit: Story = {
  /**
   * Verifies the current Source value is submitted immediately.
   *
   * @param context - Story interaction context.
   * @returns A promise that resolves after assertions complete.
   */
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.type(
      canvas.getByRole("textbox", { name: "Name" }),
      "Daily Carry",
    );
    await userEvent.click(canvas.getByRole("button", { name: "Source" }));
    await userEvent.type(
      canvas.getByRole("textbox", { name: "Description" }),
      "Current **description**",
    );
    await userEvent.click(canvas.getByRole("button", { name: "Save" }));
    await expect(args.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ description: "Current **description**" }),
      [],
    );
  },
};

/** Warning description count story. */
export const DescriptionWarning: Story = {
  args: {
    initialValue: {
      description: Array.from({ length: 180 }, () => "word").join(" "),
      isPrivate: true,
      name: "Warning",
    },
  },
  /**
   * Verifies warning styling begins at 180 words.
   *
   * @param context - Story interaction context.
   * @returns A promise that resolves after assertions complete.
   */
  play: async ({ canvas }) => {
    await expect(canvas.getAllByText(/180 \/ 200 words/u)[0]).toHaveClass(
      "text-primary",
    );
    await expect(canvas.getByRole("button", { name: "Save" })).toBeEnabled();
  },
};

/** Exact description limit story. */
export const DescriptionLimitReached: Story = {
  args: {
    initialValue: {
      description: Array.from({ length: 200 }, () => "word").join(" "),
      isPrivate: true,
      name: "At Limit",
    },
  },
  /**
   * Verifies exactly 200 words remain valid with limit styling.
   *
   * @param context - Story interaction context.
   * @returns A promise that resolves after assertions complete.
   */
  play: async ({ canvas }) => {
    await expect(canvas.getAllByText(/200 \/ 200 words/u)[0]).toHaveClass(
      "text-destructive",
    );
    await expect(canvas.getByRole("button", { name: "Save" })).toBeEnabled();
  },
};

/** Over-limit description story. */
export const DescriptionOverLimit: Story = {
  args: {
    initialValue: {
      description: "",
      isPrivate: true,
      name: "Over Limit",
    },
  },
  /**
   * Verifies over-limit content remains visible and blocks submission.
   *
   * @param context - Story interaction context.
   * @returns A promise that resolves after assertions complete.
   */
  play: async ({ canvas, userEvent }) => {
    const overLimit = Array.from({ length: 201 }, () => "word").join(" ");
    await userEvent.click(canvas.getByRole("button", { name: "Source" }));
    const description = canvas.getByRole("textbox", { name: "Description" });
    await userEvent.click(description);
    await userEvent.paste(overLimit);
    await expect(description).toHaveAttribute("aria-invalid", "true");
    await expect(description).toHaveValue(overLimit);
    await expect(canvas.getAllByText(/201 \/ 200 words/u)[0]).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Save" })).toBeDisabled();
  },
};

/** Disabled collection form story. */
export const Disabled: Story = {
  args: {
    disabled: true,
    initialValue: {
      description: "Saved description",
      isPrivate: true,
      name: "Saved collection",
    },
  },
  /**
   * Verifies form controls stay disabled while saving.
   *
   * @param context - Story interaction context.
   * @returns A promise that resolves after assertions complete.
   */
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("textbox", { name: "Name" })).toBeDisabled();
    await expect(canvas.getByRole("button", { name: "Save" })).toBeDisabled();
  },
};

/** Server error collection form story. */
export const Error: Story = {
  args: { error: "The collection could not be saved." },
};

/** Multiple image submission story. */
export const MultipleImages: Story = {
  /**
   * Verifies all selected images reach submission.
   *
   * @param context - Story interaction context.
   * @returns A promise that resolves after assertions complete.
   */
  play: async ({ args, canvas, userEvent }) => {
    const images = [
      new File(["one"], "one.png", { type: "image/png" }),
      new File(["two"], "two.png", { type: "image/png" }),
    ];
    await userEvent.type(
      canvas.getByRole("textbox", { name: "Name" }),
      "Daily Carry",
    );
    await userEvent.upload(canvas.getByLabelText("Images"), images);
    await userEvent.click(canvas.getByRole("button", { name: "Save" }));
    await expect(args.onSubmit).toHaveBeenCalledWith(
      expect.any(Object),
      images,
    );
  },
};
