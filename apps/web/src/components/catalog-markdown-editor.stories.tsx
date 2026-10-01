import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, fn } from "storybook/test";
import { StoryProviders } from "../../.storybook/story-fixtures";
import { CatalogMarkdownEditor } from "./catalog-markdown-editor";

/** Storybook metadata for catalog description Markdown fields. */
const meta = {
  args: {
    help: "Format product descriptions with Markdown.",
    id: "catalog-description",
    label: "Description",
    onChange: fn(),
    onLoadingChange: fn(),
  },
  component: CatalogMarkdownEditor,
  decorators: [
    (Story) => (
      <StoryProviders>
        <div className="w-[min(48rem,calc(100vw-2rem))]">
          <Story />
        </div>
      </StoryProviders>
    ),
  ],
  title: "Components/CatalogMarkdownEditor",
} satisfies Meta<typeof CatalogMarkdownEditor>;

export default meta;
/** Catalog Markdown editor story type. */
type Story = StoryObj<typeof meta>;

/** Product description integration story. */
export const ProductDescription: Story = {
  args: { defaultValue: "A **formatted** product description." },
  /**
   * Verifies catalog help and character counting.
   *
   * @param context - Story interaction context.
   * @returns A promise that resolves after assertions complete.
   */
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByRole("textbox", { name: "Description" }),
    ).toBeVisible();
    await expect(
      canvas.getByText("Format product descriptions with Markdown."),
    ).toBeVisible();
    await expect(
      canvas.getByText(/\/ 5,000 characters/u, { selector: "p" }),
    ).toBeVisible();
  },
};

/** Collection-item description warning story. */
export const CollectionItemWarning: Story = {
  args: {
    defaultValue: "x".repeat(4800),
    help: "Override this collection item's product description.",
  },
  /**
   * Verifies the warning threshold uses non-color text and styling.
   *
   * @param context - Story interaction context.
   * @returns A promise that resolves after assertions complete.
   */
  play: async ({ canvas }) => {
    const counter = canvas.getByText(/4,800 \/ 5,000 characters/u, {
      selector: "p",
    });
    await expect(counter).toHaveTextContent("approaching limit");
    await expect(counter).toHaveClass("text-primary");
  },
};

/** Exact catalog description limit story. */
export const ExactLimit: Story = {
  args: { defaultValue: "x".repeat(5000) },
  /**
   * Verifies the exact limit remains valid while showing the limit state.
   *
   * @param context - Story interaction context.
   * @returns A promise that resolves after assertions complete.
   */
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Source" }));
    const editor = canvas.getByRole("textbox", { name: "Description" });
    const counter = canvas.getByText(/5,000 \/ 5,000 characters/u, {
      selector: "p",
    });
    await expect(editor).not.toHaveAttribute("aria-invalid");
    await expect(counter).toHaveTextContent("limit reached");
    await expect(counter).toHaveClass("text-destructive");
  },
};

/** Over-limit catalog description story. */
export const OverLimit: Story = {
  args: { defaultValue: "x".repeat(5001) },
  /**
   * Verifies over-limit content remains intact and invalid.
   *
   * @param context - Story interaction context.
   * @returns A promise that resolves after assertions complete.
   */
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Source" }));
    const editor = canvas.getByRole("textbox", {
      name: "Description",
    }) as HTMLTextAreaElement;
    await expect(editor.value).toHaveLength(5001);
    await expect(editor).toHaveAttribute("aria-invalid", "true");
    await expect(
      canvas.getByText(/1 over limit/u, { selector: "p" }),
    ).toBeVisible();
  },
};

/** Disabled catalog description story. */
export const Disabled: Story = {
  args: { defaultValue: "Editing is unavailable.", disabled: true },
};

/** Server-error catalog description story. */
export const ServerError: Story = {
  args: { error: "The description could not be saved." },
};
