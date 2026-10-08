import type { TranslationKey } from "@pocket-trash/localizations";
import type { Meta, StoryObj } from "@storybook/tanstack-react";
import * as React from "react";
import { SliderMagnetConfigurationEditor } from "./slider-magnet-configuration-editor";

/** Minimal English copy used by the isolated editor story. */
const labels: Partial<Record<TranslationKey, string>> = {
  "web.slider.magnet.configuration": "Magnet configuration",
  "web.slider.magnet.grade": "Magnet grade",
  "web.slider.magnet.halfA": "Side A",
  "web.slider.magnet.halfB": "Side B",
  "web.slider.magnet.state.empty": "Empty",
};

/** Storybook metadata for the reusable magnet configuration editor. */
const meta = {
  component: SliderMagnetConfigurationEditor,
  title: "Catalog/SliderMagnetConfigurationEditor",
} satisfies Meta<typeof SliderMagnetConfigurationEditor>;

export default meta;
/** Story type derived from the editor metadata. */
type Story = StoryObj<typeof meta>;

/** Interactive default slider configuration editor. */
export const Default: Story = {
  args: {
    layout: "2x4",
    /**
     * Story action placeholder overridden by the controlled render.
     *
     * @returns Nothing.
     */
    onChange: () => undefined,
    /**
     * Resolves the minimal story copy without an application provider.
     *
     * @param key - Requested localization key.
     * @returns Story label or readable fallback.
     */
    t: (key) => labels[key] ?? key.split(".").at(-1) ?? key,
    value: {
      sideA: ["N48", "N52", "N52", "N48", "N48", "N52", "N52", "N48"],
      sideB: null,
    },
  },
  /**
   * Renders a controlled interactive editor.
   *
   * @param args - Story arguments.
   * @returns Interactive editor story.
   */
  render: function Render(args) {
    const [value, setValue] = React.useState(args.value);
    return (
      <SliderMagnetConfigurationEditor
        {...args}
        onChange={setValue}
        value={value}
      />
    );
  },
};
