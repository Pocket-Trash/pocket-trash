import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, within } from "storybook/test";
import { Button } from "./button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./tooltip";

const meta = {
  component: Tooltip,
  title: "UI/Tooltip",
} satisfies Meta<typeof Tooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {
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

export const Hover: Story = {
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
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.hover(canvas.getByRole("button", { name: "Hover" }));

    const page = within(canvasElement.ownerDocument.body);
    await expect(await page.findByText("More detail")).toBeVisible();
  },
};
