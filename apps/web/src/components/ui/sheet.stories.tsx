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
type Story = StoryObj<typeof meta>;

export const Right: Story = {
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

export const Left: Story = {
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

export const Dismiss: Story = {
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
