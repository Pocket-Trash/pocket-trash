import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, fn } from "storybook/test";
import { withThemePanels } from "../../../.storybook/theme-panels";
import { Input } from "./input";

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
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  decorators: [withThemePanels],
};

export const Disabled: Story = {
  args: { disabled: true, placeholder: "Disabled" },
  decorators: [withThemePanels],
};

export const Types: Story = {
  decorators: [withThemePanels],
  render: () => (
    <div className="grid w-64 gap-3">
      <Input aria-label="Text" placeholder="Text" type="text" />
      <Input aria-label="Number" placeholder="Number" type="number" />
      <Input aria-label="Email" placeholder="Email" type="email" />
    </div>
  ),
};

export const Typing: Story = {
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.type(
      canvas.getByRole("textbox", { name: "Search" }),
      "pen",
    );
    await expect(args.onChange).toHaveBeenCalled();
  },
};
