import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, fn } from "storybook/test";
import { withThemePanels } from "../../../.storybook/theme-panels";
import { Input } from "./input";

/**
 * Configures Storybook coverage for the input examples.
 */
const meta = {
  args: {
    "aria-label": "Search",
    onChange: fn(),
    placeholder: "Search",
  },
  component: Input,
  title: "UI/Input",
} satisfies Meta<typeof Input>;

export default meta;
/**
 * Storybook story contract for the input examples.
 */
type Story = StoryObj<typeof meta>;

/**
 * Shows the input default example.
 */
export const Default: Story = {
  decorators: [withThemePanels],
};

/**
 * Shows the input disabled example.
 */
export const Disabled: Story = {
  args: { disabled: true, placeholder: "Disabled" },
  decorators: [withThemePanels],
};

/**
 * Shows the input read-only example.
 */
export const ReadOnly: Story = {
  args: { readOnly: true, value: "Generated value" },
  decorators: [withThemePanels],
  /**
   * Verifies read-only inputs remain focusable without accepting edits.
   *
   * @param context - Storybook interaction context.
   * @param context.canvas - Queries scoped to the rendered story canvas.
   * @param context.userEvent - Storybook interaction driver.
   */
  play: async ({ canvas, userEvent }) => {
    const input = canvas.getAllByRole("textbox", { name: "Search" }).at(0);

    await expect(input).toBeDefined();
    if (!input) return;
    await expect(input).toHaveAttribute("readonly");
    await expect(input).not.toBeDisabled();
    await userEvent.click(input);
    await expect(input).toHaveFocus();
    await userEvent.type(input, " changed");
    await expect(input).toHaveValue("Generated value");
  },
};

/**
 * Shows the input types example.
 */
export const Types: Story = {
  decorators: [withThemePanels],
  /**
   * Renders the input types example.
   *
   * @returns The rendered story example.
   */
  render: () => (
    <div className="grid w-64 gap-3">
      <Input aria-label="Text" placeholder="Text" type="text" />
      <Input aria-label="Number" placeholder="Number" type="number" />
      <Input aria-label="Email" placeholder="Email" type="email" />
    </div>
  ),
};

/**
 * Shows the input typing example.
 */
export const Typing: Story = {
  /**
   * Exercises the input typing interaction and assertions.
   *
   * @param context - Storybook interaction context.
   * @param context.args - Current Storybook story arguments.
   * @param context.canvas - Queries scoped to the rendered story canvas.
   * @param context.userEvent - Storybook interaction driver.
   */
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.type(
      canvas.getByRole("textbox", { name: "Search" }),
      "pen",
    );
    await expect(args.onChange).toHaveBeenCalled();
  },
};
