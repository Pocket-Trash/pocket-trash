import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, waitFor, within } from "storybook/test";
import { Button } from "./button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "./dropdown-menu";

/**
 * Configures Storybook coverage for the dropdown menu examples.
 */
const meta = {
  component: DropdownMenu,
  title: "UI/DropdownMenu",
} satisfies Meta<typeof DropdownMenu>;

export default meta;
/**
 * Storybook story contract for the dropdown menu examples.
 */
type Story = StoryObj<typeof meta>;

/**
 * Shows the dropdown menu closed example.
 */
export const Closed: Story = {
  /**
   * Renders the dropdown menu closed example.
   *
   * @returns The rendered story example.
   */
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" />}>
        Actions
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem>Archive</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};

/**
 * Shows the dropdown menu open example.
 */
export const Open: Story = {
  /**
   * Renders the dropdown menu open example.
   *
   * @returns The rendered story example.
   */
  render: () => (
    <DropdownMenu open>
      <DropdownMenuTrigger render={<Button variant="outline" />}>
        Actions
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuGroup>
          <DropdownMenuLabel>Options</DropdownMenuLabel>
          <DropdownMenuItem>
            Archive
            <DropdownMenuShortcut>⌘A</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuCheckboxItem checked>Tracked</DropdownMenuCheckboxItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value="maker">
          <DropdownMenuRadioItem value="maker">Maker</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="year">Year</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuItem variant="destructive">Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};

/**
 * Shows the dropdown menu keyboard dismiss example.
 */
export const KeyboardDismiss: Story = {
  /**
   * Renders the dropdown menu keyboard dismiss example.
   *
   * @returns The rendered story example.
   */
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" />}>
        Actions
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem>Archive</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
  /**
   * Exercises the dropdown menu keyboard dismiss interaction and assertions.
   *
   * @param context - Storybook interaction context.
   * @param context.canvas - Queries scoped to the rendered story canvas.
   * @param context.canvasElement - Rendered Storybook canvas element.
   * @param context.userEvent - Storybook interaction driver.
   */
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Actions" }));

    const page = canvasElement.ownerDocument.body;
    await expect(
      await within(page).findByRole("menuitem", { name: "Archive" }),
    ).toBeVisible();

    await userEvent.keyboard("{Escape}");
    await waitFor(() => {
      expect(
        within(page).queryByRole("menuitem", { name: "Archive" }),
      ).toBeNull();
    });
  },
};
