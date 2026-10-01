import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { Plus } from "lucide-react";
import { expect, fn } from "storybook/test";
import { withThemePanels } from "../../../.storybook/theme-panels";
import { Button } from "./button";

/**
 * Configures Storybook coverage for the button examples.
 */
const meta = {
  args: {
    children: "Button",
    onClick: fn(),
  },
  argTypes: {
    size: {
      control: "select",
      options: ["default", "sm", "lg", "icon"],
    },
    variant: {
      control: "select",
      options: [
        "default",
        "destructive",
        "outline",
        "secondary",
        "ghost",
        "link",
      ],
    },
  },
  component: Button,
  title: "UI/Button",
} satisfies Meta<typeof Button>;

export default meta;
/**
 * Storybook story contract for the button examples.
 */
type Story = StoryObj<typeof meta>;

/**
 * Shows the button default example.
 */
export const Default: Story = {
  /**
   * Exercises the button default interaction and assertions.
   *
   * @param context - Storybook interaction context.
   * @param context.args - Current Storybook story arguments.
   * @param context.canvas - Queries scoped to the rendered story canvas.
   * @param context.userEvent - Storybook interaction driver.
   */
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Button" }));
    await expect(args.onClick).toHaveBeenCalledOnce();
  },
};

/**
 * Shows the button destructive example.
 */
export const Destructive: Story = {
  args: { variant: "destructive" },
  decorators: [withThemePanels],
};
/**
 * Shows the button outline example.
 */
export const Outline: Story = {
  args: { variant: "outline" },
  decorators: [withThemePanels],
};
/**
 * Shows the button secondary example.
 */
export const Secondary: Story = {
  args: { variant: "secondary" },
  decorators: [withThemePanels],
};
/**
 * Shows the button ghost example.
 */
export const Ghost: Story = {
  args: { variant: "ghost" },
  decorators: [withThemePanels],
};
/**
 * Shows the button link example.
 */
export const Link: Story = {
  args: { variant: "link" },
  decorators: [withThemePanels],
};
/**
 * Shows the button small example.
 */
export const Small: Story = {
  args: { size: "sm" },
  decorators: [withThemePanels],
};
/**
 * Shows the button large example.
 */
export const Large: Story = {
  args: { size: "lg" },
  decorators: [withThemePanels],
};
/**
 * Shows the button icon example.
 */
export const Icon: Story = {
  args: { "aria-label": "Add item", children: <Plus />, size: "icon" },
  /**
   * Exercises the button icon interaction and assertions.
   *
   * @param context - Storybook interaction context.
   * @param context.canvas - Queries scoped to the rendered story canvas.
   */
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("button", { name: "Add item" }),
    ).toBeVisible();
  },
};
/**
 * Shows the button disabled example.
 */
export const Disabled: Story = {
  args: { disabled: true },
  /**
   * Exercises the button disabled interaction and assertions.
   *
   * @param context - Storybook interaction context.
   * @param context.canvas - Queries scoped to the rendered story canvas.
   */
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: "Button" })).toBeDisabled();
  },
};
