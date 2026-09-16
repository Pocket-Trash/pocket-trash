import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, fn } from "storybook/test";
import { withThemePanels } from "../../../.storybook/theme-panels";
import { ToggleGroup, ToggleGroupItem } from "./toggle-group";

const meta = {
  component: ToggleGroup,
  title: "UI/ToggleGroup",
} satisfies Meta<typeof ToggleGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Single: Story = {
  decorators: [withThemePanels],
  render: () => (
    <ToggleGroup defaultValue="light">
      <ToggleGroupItem aria-label="Light" value="light">
        Light
      </ToggleGroupItem>
      <ToggleGroupItem aria-label="Dark" value="dark">
        Dark
      </ToggleGroupItem>
      <ToggleGroupItem aria-label="System" value="system">
        System
      </ToggleGroupItem>
    </ToggleGroup>
  ),
};

export const Multiple: Story = {
  decorators: [withThemePanels],
  render: () => (
    <ToggleGroup defaultValue={["small", "metal"]} type="multiple">
      <ToggleGroupItem aria-label="Small" value="small">
        Small
      </ToggleGroupItem>
      <ToggleGroupItem aria-label="Metal" value="metal">
        Metal
      </ToggleGroupItem>
      <ToggleGroupItem aria-label="Clip" value="clip">
        Clip
      </ToggleGroupItem>
    </ToggleGroup>
  ),
};

export const Selection: Story = {
  render: (args) => (
    <ToggleGroup {...args}>
      <ToggleGroupItem aria-label="Grid" value="grid">
        Grid
      </ToggleGroupItem>
      <ToggleGroupItem aria-label="List" value="list">
        List
      </ToggleGroupItem>
    </ToggleGroup>
  ),
  args: { onValueChange: fn() },
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "List" }));
    await expect(args.onValueChange).toHaveBeenCalledWith("list");
  },
};
