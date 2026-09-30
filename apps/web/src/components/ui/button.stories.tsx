import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { Plus } from "lucide-react";
import { expect, fn } from "storybook/test";
import { withThemePanels } from "../../../.storybook/theme-panels";
import { Button } from "./button";

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
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Button" }));
    await expect(args.onClick).toHaveBeenCalledOnce();
  },
};

export const Destructive: Story = {
  args: { variant: "destructive" },
  decorators: [withThemePanels],
};
export const Outline: Story = {
  args: { variant: "outline" },
  decorators: [withThemePanels],
};
export const Secondary: Story = {
  args: { variant: "secondary" },
  decorators: [withThemePanels],
};
export const Ghost: Story = {
  args: { variant: "ghost" },
  decorators: [withThemePanels],
};
export const Link: Story = {
  args: { variant: "link" },
  decorators: [withThemePanels],
};
export const Small: Story = {
  args: { size: "sm" },
  decorators: [withThemePanels],
};
export const Large: Story = {
  args: { size: "lg" },
  decorators: [withThemePanels],
};
export const Icon: Story = {
  args: { "aria-label": "Add item", children: <Plus />, size: "icon" },
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("button", { name: "Add item" }),
    ).toBeVisible();
  },
};
export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: "Button" })).toBeDisabled();
  },
};
