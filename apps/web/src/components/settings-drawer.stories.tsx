import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, fn, within } from "storybook/test";
import { mockStoryAuth, StoryProviders } from "../../.storybook/story-fixtures";
import { SettingsDrawer, SettingsPanel } from "./settings-drawer";

const settingsArgs = {
  currency: "USD" as const,
  onCurrencyChange: fn(),
  onUnitsChange: fn(),
  onWeightChange: fn(),
  units: "in" as const,
  weight: "g" as const,
};

const meta = {
  beforeEach: mockStoryAuth,
  component: SettingsDrawer,
  decorators: [
    (Story) => (
      <StoryProviders>
        <Story />
      </StoryProviders>
    ),
  ],
  title: "Components/SettingsDrawer",
} satisfies Meta<typeof SettingsDrawer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Trigger: Story = {
  args: settingsArgs,
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Settings" }));
    await expect(
      await within(canvasElement.ownerDocument.body).findByRole("dialog"),
    ).toBeVisible();
  },
};

export const Panel: Story = {
  args: settingsArgs,
  render: (args) => (
    <div className="w-96 border border-sidebar-border bg-sidebar">
      <SettingsPanel {...args} showTheme />
    </div>
  ),
};

export const DisabledPanel: Story = {
  args: { ...settingsArgs, disabled: true },
  render: (args) => (
    <div className="w-96 border border-sidebar-border bg-sidebar">
      <SettingsPanel {...args} showTheme />
    </div>
  ),
};
