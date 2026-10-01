import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, waitFor, within } from "storybook/test";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";

/**
 * Configures Storybook coverage for the select examples.
 */
const meta = {
  component: Select,
  title: "UI/Select",
} satisfies Meta<typeof Select>;

export default meta;
/**
 * Storybook story contract for the select examples.
 */
type Story = StoryObj<typeof meta>;

/**
 * Shows the select closed example.
 */
export const Closed: Story = {
  /**
   * Renders the select closed example.
   *
   * @returns The rendered story example.
   */
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

/**
 * Shows the select open example.
 */
export const Open: Story = {
  /**
   * Renders the select open example.
   *
   * @returns The rendered story example.
   */
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

/**
 * Shows the select selection example.
 */
export const Selection: Story = {
  /**
   * Renders the select selection example.
   *
   * @returns The rendered story example.
   */
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
  /**
   * Exercises the select selection interaction and assertions.
   *
   * @param context - Storybook interaction context.
   * @param context.canvas - Queries scoped to the rendered story canvas.
   * @param context.canvasElement - Rendered Storybook canvas element.
   * @param context.userEvent - Storybook interaction driver.
   */
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
