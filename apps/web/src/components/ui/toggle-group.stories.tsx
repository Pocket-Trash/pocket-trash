import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, fn } from "storybook/test";
import { withThemePanels } from "../../../.storybook/theme-panels";
import { ToggleGroup, ToggleGroupItem } from "./toggle-group";

/**
 * Configures Storybook coverage for the toggle group examples.
 */
const meta = {
  component: ToggleGroup,
  title: "UI/ToggleGroup",
} satisfies Meta<typeof ToggleGroup>;

export default meta;
/**
 * Storybook story contract for the toggle group examples.
 */
type Story = StoryObj<typeof meta>;

/**
 * Shows the toggle group single example.
 */
export const Single: Story = {
  decorators: [withThemePanels],
  /**
   * Renders the toggle group single example.
   *
   * @returns The rendered story example.
   */
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

/**
 * Shows the toggle group multiple example.
 */
export const Multiple: Story = {
  decorators: [withThemePanels],
  /**
   * Renders the toggle group multiple example.
   *
   * @returns The rendered story example.
   */
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

/**
 * Shows the toggle group selection example.
 */
export const Selection: Story = {
  /**
   * Renders the toggle group selection example.
   *
   * @param args - Current Storybook story arguments.
   * @returns The rendered story example.
   */
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
  /**
   * Exercises the toggle group selection interaction and assertions.
   *
   * @param context - Storybook interaction context.
   * @param context.args - Current Storybook story arguments.
   * @param context.canvas - Queries scoped to the rendered story canvas.
   * @param context.userEvent - Storybook interaction driver.
   */
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "List" }));
    await expect(args.onValueChange).toHaveBeenCalledWith("list");
  },
};
