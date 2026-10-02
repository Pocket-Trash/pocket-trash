import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, fn, waitFor, within } from "storybook/test";
import { withThemePanels } from "../../.storybook/theme-panels";
import { LanguageSelect } from "./language-select";

/**
 * Configures Storybook coverage for the language select examples.
 */
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
/**
 * Storybook story contract for the language select examples.
 */
type Story = StoryObj<typeof meta>;

/**
 * Defines the default language select story.
 */
export const Default: Story = {
  decorators: [withThemePanels],
};

/**
 * Defines the choose language language select story.
 */
export const ChooseLanguage: Story = {
  /**
   * Exercises the language select story interaction and assertions.
   *
   * @param context - Storybook play context.
   * @param context.args - Current Storybook story arguments.
   * @param context.canvas - Queries scoped to the rendered story canvas.
   * @param context.canvasElement - Rendered Storybook canvas element.
   * @param context.userEvent - Storybook interaction driver.
   * @returns A promise that resolves after the interaction assertions pass.
   * @rejects {Error} If a user interaction or assertion fails.
   */
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
