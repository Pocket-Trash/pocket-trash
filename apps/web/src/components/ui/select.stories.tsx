import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, waitFor, within } from "storybook/test";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";

const meta = {
  component: Select,
  title: "UI/Select",
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {
  render: () => (
    <Select defaultValue="material">
      <SelectTrigger aria-label="Sort">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="material">Material</SelectItem>
        <SelectItem value="maker">Maker</SelectItem>
        <SelectItem value="year">Year</SelectItem>
      </SelectContent>
    </Select>
  ),
};

export const Open: Story = {
  render: () => (
    <Select defaultValue="material" open>
      <SelectTrigger aria-label="Sort">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="material">Material</SelectItem>
        <SelectItem value="maker">Maker</SelectItem>
        <SelectItem value="year">Year</SelectItem>
      </SelectContent>
    </Select>
  ),
};

export const Selection: Story = {
  render: () => (
    <Select defaultValue="material">
      <SelectTrigger aria-label="Sort">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="material">Material</SelectItem>
        <SelectItem value="maker">Maker</SelectItem>
        <SelectItem value="year">Year</SelectItem>
      </SelectContent>
    </Select>
  ),
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole("combobox", { name: "Sort" }));

    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(await page.findByRole("option", { name: "Maker" }));
    await expect(canvas.getByText("maker")).toBeVisible();
    await waitFor(() => {
      expect(page.queryByRole("listbox")).toBeNull();
    });
  },
};
