import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, fn, waitFor, within } from "storybook/test";
import { withThemePanels } from "../../.storybook/theme-panels";
import { LanguageSelect } from "./language-select";

const meta = {
  args: { locale: "en-US", onLocaleChange: fn() },
  component: LanguageSelect,
  decorators: [
    (Story) => (
      <div className="w-64">
        <Story />
      </div>
    ),
  ],
  title: "Components/LanguageSelect",
} satisfies Meta<typeof LanguageSelect>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  decorators: [withThemePanels],
};

export const ChooseLanguage: Story = {
  play: async ({ args, canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole("combobox"));
    await userEvent.click(
      await within(canvasElement.ownerDocument.body).findByRole("option", {
        name: "Spanish (Mexico)",
      }),
    );
    await expect(args.onLocaleChange).toHaveBeenCalledWith("es-MX");
    await waitFor(() => {
      expect(
        canvasElement.ownerDocument.body.querySelector(
          "[data-base-ui-focus-guard]",
        ),
      ).toBeNull();
    });
  },
};
