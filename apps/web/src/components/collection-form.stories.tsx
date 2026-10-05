import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, fn } from "storybook/test";
import { StoryProviders } from "../../.storybook/story-fixtures";
import { CollectionForm } from "./collection-form";

/**
 * Localized labels shared by the collection form stories.
 */
const copy = {
  browse: "Browse",
  cancel: "Cancel",
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
  summary: "Summary",
  summaryPlaceholder: "Summarize this collection",
};

/**
 * Configures Storybook coverage for the collection form examples.
 */
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
/**
 * Storybook story contract for the collection form examples.
 */
type Story = StoryObj<typeof meta>;

/**
 * Defines the new private collection form story.
 */
export const NewPrivate: Story = {};

/**
 * Defines the edit public collection form story.
 */
export const EditPublic: Story = {
  args: {
    initialValue: {
      description: "Everyday carry spinners.",
      isPrivate: false,
      name: "Daily Carry",
      summary: "Favourite everyday carry pieces.",
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
    await expect(canvas.getAllByText("24 / 5,000 characters")[0]).toBeVisible();
    await expect(canvas.getByRole("switch", { name: "Public" })).toBeChecked();
  },
};

/** Defines the responsive two-column edit form. */
export const SplitLargeScreen: Story = {
  args: {
    initialValue: {
      description: "Everyday carry spinners.",
      isPrivate: false,
      name: "Daily Carry",
      summary: "",
    },
    onCancel: fn(),
    splitOnLargeScreens: true,
  },
  parameters: { layout: "fullscreen" },
  /**
   * Verifies the edit form exposes both bottom-row actions.
   *
   * @param context - Story interaction context.
   * @param context.args - Current story arguments.
   * @param context.canvas - Queries scoped to the rendered story canvas.
   * @param context.userEvent - Storybook interaction driver.
   * @returns A promise that resolves after assertions complete.
   */
  play: async ({ args, canvas, userEvent }) => {
    await expect(canvas.getByRole("button", { name: "Save" })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Cancel" }));
    await expect(args.onCancel).toHaveBeenCalledOnce();
  },
};

/**
 * Defines the submit collection form story.
 */
export const Submit: Story = {
  /**
   * Exercises the collection form story interaction and assertions.
   *
   * @param context - Storybook interaction context.
   * @param context.args - Current Storybook story arguments.
   * @param context.canvas - Queries scoped to the rendered story canvas.
   * @param context.userEvent - Storybook interaction driver.
   */
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.type(
      canvas.getByRole("textbox", { name: "Name" }),
      "Daily Carry",
    );
    await userEvent.type(
      canvas.getByRole("textbox", { name: "Summary" }),
      "Favourite pieces",
    );
    await userEvent.click(canvas.getByRole("button", { name: "Source" }));
    await userEvent.type(
      canvas.getByRole("textbox", { name: "Description" }),
      "Current **description**",
    );
    await userEvent.click(canvas.getByRole("button", { name: "Save" }));
    await expect(args.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        description: "Current **description**",
        summary: "Favourite pieces",
      }),
      [],
    );
  },
};

/** Warning description count story. */
export const DescriptionWarning: Story = {
  args: {
    initialValue: {
      description: "d".repeat(4800),
      isPrivate: true,
      name: "Warning",
      summary: "",
    },
  },
  /**
   * Verifies warning styling begins at 4,800 characters.
   *
   * @param context - Story interaction context.
   * @returns A promise that resolves after assertions complete.
   */
  play: async ({ canvas }) => {
    await expect(
      canvas.getAllByText(/4,800 \/ 5,000 characters/u)[0],
    ).toHaveClass("text-primary");
    await expect(canvas.getByRole("button", { name: "Save" })).toBeEnabled();
  },
};

/** Exact description limit story. */
export const DescriptionLimitReached: Story = {
  args: {
    initialValue: {
      description: "d".repeat(5000),
      isPrivate: true,
      name: "At Limit",
      summary: "",
    },
  },
  /**
   * Verifies exactly 5,000 characters remain valid with limit styling.
   *
   * @param context - Story interaction context.
   * @returns A promise that resolves after assertions complete.
   */
  play: async ({ canvas }) => {
    await expect(
      canvas.getAllByText(/5,000 \/ 5,000 characters/u)[0],
    ).toHaveClass("text-destructive");
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
      summary: "",
    },
  },
  /**
   * Verifies over-limit content remains visible and blocks submission.
   *
   * @param context - Story interaction context.
   * @returns A promise that resolves after assertions complete.
   */
  play: async ({ canvas, userEvent }) => {
    const overLimit = "d".repeat(5001);
    await userEvent.click(canvas.getByRole("button", { name: "Source" }));
    const description = canvas.getByRole("textbox", { name: "Description" });
    await userEvent.click(description);
    await userEvent.paste(overLimit);
    await expect(description).toHaveAttribute("aria-invalid", "true");
    await expect(description).toHaveValue(overLimit);
    await expect(
      canvas.getAllByText(/5,001 \/ 5,000 characters/u)[0],
    ).toBeVisible();
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
      summary: "Saved summary",
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

/**
 * Defines the multiple images collection form story.
 */
export const MultipleImages: Story = {
  /**
   * Exercises the collection form story interaction and assertions.
   *
   * @param context - Storybook interaction context.
   * @param context.args - Current Storybook story arguments.
   * @param context.canvas - Queries scoped to the rendered story canvas.
   * @param context.userEvent - Storybook interaction driver.
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
