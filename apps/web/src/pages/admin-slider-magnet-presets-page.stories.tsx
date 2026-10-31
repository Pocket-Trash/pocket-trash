import type { SliderMagnetPreset } from "@package/services";
import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, mocked, waitFor } from "storybook/test";
import { uniformMagnetConfiguration } from "@/components/slider-magnet-configuration-editor";
import { updateSliderMagnetPreset } from "@/lib/catalog-api";
import { mockStoryRole, StoryProviders } from "../../.storybook/story-fixtures";
import { AdminSliderMagnetPresetsPage } from "./admin-slider-magnet-presets-page";

/** Existing reusable configuration shared by the edit interaction. */
const preset: SliderMagnetPreset = {
  id: 99,
  name: "Preset",
  magnetLayout: "2x4",
  configuration: uniformMagnetConfiguration("2x4", "N52"),
};
/** Preset administration setup with isolated server mutation mocks. */
const meta = {
  component: AdminSliderMagnetPresetsPage,
  /** Configures an administrator and the expected updated preset result. */
  beforeEach: () => {
    mockStoryRole("admin");
    mocked(updateSliderMagnetPreset).mockResolvedValue({
      ok: true,
      preset: { ...preset, name: "Updated preset" },
    });
  },
  decorators: [
    (Story) => (
      <StoryProviders>
        <Story />
      </StoryProviders>
    ),
  ],
  title: "Components/AdminSliderMagnetPresetsPage",
} satisfies Meta<typeof AdminSliderMagnetPresetsPage>;
export default meta;
/** Preset administration story contract. */
type Story = StoryObj<typeof meta>;
/** Blank creation controls with no reusable presets. */
export const Empty: Story = { args: { initialPresets: [] } };
/** Existing preset selection, editing, save, and return to create mode. */
export const Edit: Story = {
  args: { initialPresets: [preset] },
  /**
   * Exercises existing-preset editing through the installed configuration controls.
   * @param context - Story interaction context.
   * @returns Completion after canonical update and reset are verified.
   */
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Edit" }));
    const name = canvas.getByRole("textbox", { name: "Name" });
    await expect(name).toHaveValue("Preset");
    await userEvent.clear(name);
    await userEvent.type(name, "Updated preset");
    await userEvent.click(canvas.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(updateSliderMagnetPreset).toHaveBeenCalledWith({
        data: {
          presetId: 99,
          name: "Updated preset",
          magnetLayout: "2x4",
          configuration: preset.configuration,
        },
      }),
    );
    await expect(
      canvas.getByRole("heading", { name: "Updated preset" }),
    ).toBeVisible();
    await expect(name).toHaveValue("");
  },
};
