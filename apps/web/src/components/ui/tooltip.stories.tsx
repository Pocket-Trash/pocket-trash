import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, within } from "storybook/test";
import { Button } from "./button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./tooltip";

/**
 * Configures Storybook coverage for the tooltip examples.
 */
const meta = {
  component: Tooltip,
  title: "UI/Tooltip",
} satisfies Meta<typeof Tooltip>;

export default meta;
/**
 * Storybook story contract for the tooltip examples.
 */
type Story = StoryObj<typeof meta>;

/**
 * Shows the tooltip open example.
 */
export const Open: Story = {
  /**
   * Renders the tooltip open example.
   *
   * @returns The rendered story example.
   */
  render: () => (
    <TooltipProvider>
      <Tooltip open>
        <TooltipTrigger render={<Button variant="outline" />}>
          Hover
        </TooltipTrigger>
        <TooltipContent>More detail</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ),
};

/**
 * Shows the tooltip hover example.
 */
export const Hover: Story = {
  /**
   * Renders the tooltip hover example.
   *
   * @returns The rendered story example.
   */
  render: () => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger render={<Button variant="outline" />}>
          Hover
        </TooltipTrigger>
        <TooltipContent>More detail</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ),
  /**
   * Exercises the tooltip hover interaction and assertions.
   *
   * @param context - Storybook interaction context.
   * @param context.canvas - Queries scoped to the rendered story canvas.
   * @param context.canvasElement - Rendered Storybook canvas element.
   * @param context.userEvent - Storybook interaction driver.
   */
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.hover(canvas.getByRole("button", { name: "Hover" }));

    const page = within(canvasElement.ownerDocument.body);
    await expect(await page.findByText("More detail")).toBeVisible();
  },
};
