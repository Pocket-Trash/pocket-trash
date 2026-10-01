import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, waitFor, within } from "storybook/test";
import type { UserSettingsState } from "@/lib/user-settings";
import { LocaleProvider } from "@/providers/locale-provider";
import { Button } from "./button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./sheet";

/**
 * Localized settings displayed by sheet stories.
 */
const settings: UserSettingsState = {
  hasSavedSettings: true,
  settings: {
    currencyCode: "USD",
    dimensionUnit: "in",
    locale: "en-US",
    theme: "system",
    weightUnit: "g",
  },
};

/**
 * Configures Storybook coverage for the sheet examples.
 */
const meta: Meta<typeof Sheet> = {
  component: Sheet,
  decorators: [
    (Story) => (
      <LocaleProvider initialSettingsState={settings}>
        <Story />
      </LocaleProvider>
    ),
  ],
  title: "UI/Sheet",
};

export default meta;
/**
 * Storybook story contract for the sheet examples.
 */
type Story = StoryObj<typeof meta>;

/**
 * Shows the sheet right example.
 */
export const Right: Story = {
  /**
   * Renders the sheet right example.
   *
   * @returns The rendered story example.
   */
  render: () => (
    <Sheet open>
      <SheetTrigger render={<Button variant="outline" />}>Open</SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Settings</SheetTitle>
          <SheetDescription>
            Adjust archive display preferences.
          </SheetDescription>
        </SheetHeader>
      </SheetContent>
    </Sheet>
  ),
};

/**
 * Shows the sheet left example.
 */
export const Left: Story = {
  /**
   * Renders the sheet left example.
   *
   * @returns The rendered story example.
   */
  render: () => (
    <Sheet open>
      <SheetContent side="left">
        <SheetHeader>
          <SheetTitle>Filters</SheetTitle>
          <SheetDescription>Adjust visible archive filters.</SheetDescription>
        </SheetHeader>
      </SheetContent>
    </Sheet>
  ),
};

/**
 * Shows the sheet dismiss example.
 */
export const Dismiss: Story = {
  /**
   * Renders the sheet dismiss example.
   *
   * @returns The rendered story example.
   */
  render: () => (
    <Sheet>
      <SheetTrigger render={<Button variant="outline" />}>Open</SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Settings</SheetTitle>
          <SheetDescription>
            Adjust archive display preferences.
          </SheetDescription>
        </SheetHeader>
      </SheetContent>
    </Sheet>
  ),
  /**
   * Exercises the sheet dismiss interaction and assertions.
   *
   * @param context - Storybook interaction context.
   * @param context.canvas - Queries scoped to the rendered story canvas.
   * @param context.canvasElement - Rendered Storybook canvas element.
   * @param context.userEvent - Storybook interaction driver.
   */
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Open" }));

    const page = within(canvasElement.ownerDocument.body);
    await expect(await page.findByText("Settings")).toBeVisible();
    await userEvent.click(await page.findByRole("button", { name: "Close" }));
    await waitFor(() => {
      expect(
        canvasElement.ownerDocument.body.querySelector(
          "[data-base-ui-focus-guard]",
        ),
      ).toBeNull();
    });
  },
};
