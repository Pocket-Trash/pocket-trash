import type { Meta, StoryObj } from "@storybook/tanstack-react";
import * as React from "react";
import { expect } from "storybook/test";
import type { CatalogOptions, ProductFormInput } from "@/lib/catalog-api";
import { FinishOptionsEditor } from "./catalog-form-pages";

/** Catalog choices used by the appearance-editor story. */
const catalogOptions: CatalogOptions = {
  colorEffects: [
    { id: 1000, name: "Solid", slug: "solid" },
    { id: 1001, name: "Fade", slug: "fade" },
  ],
  colors: [{ id: 1000, name: "Black", slug: "black" }],
  finishes: [{ id: 1000, name: "Stonewashed", slug: "stonewashed" }],
  makers: [],
  materials: [],
  patterns: [{ id: 1000, name: "Honeycomb", slug: "honeycomb" }],
  productTypes: [],
  spinnerButtons: [],
};

/**
 * Renders the controlled appearance editor for Storybook interactions.
 *
 * @returns The interactive appearance editor fixture.
 */
function InteractiveAppearanceEditor() {
  const [options, setOptions] = React.useState(catalogOptions);
  const [value, setValue] = React.useState<ProductFormInput["finishOptions"]>([
    {
      colorEffectId: null,
      colorEffectSlug: null,
      colorIds: [],
      finishIds: [],
      patternId: 1000,
    },
  ]);

  return (
    <div className="max-w-2xl p-6">
      <FinishOptionsEditor
        onChange={setValue}
        onOptionsChange={setOptions}
        options={options}
        t={(key) => key}
        value={value}
      />
    </div>
  );
}

/** Appearance editor stories with accessibility checks enabled globally. */
const meta = {
  args: {
    /**
     * Ignores uncontrolled story changes.
     *
     * @returns Nothing.
     */
    onChange: () => undefined,
    /**
     * Ignores uncontrolled catalog-option changes.
     *
     * @returns Nothing.
     */
    onOptionsChange: () => undefined,
    options: catalogOptions,
    /**
     * Returns translation keys for deterministic story labels.
     *
     * @param key - Requested translation key.
     * @returns The unchanged translation key.
     */
    t: (key) => key,
    value: [],
  },
  component: FinishOptionsEditor,
  parameters: { layout: "fullscreen" },
  /**
   * Renders the stateful interaction fixture.
   *
   * @returns The interactive appearance editor.
   */
  render: () => <InteractiveAppearanceEditor />,
  title: "Components/FinishOptionsEditor",
} satisfies Meta<typeof FinishOptionsEditor>;

export default meta;
/** Appearance editor story contract. */
type Story = StoryObj<typeof meta>;

/** Pattern-only appearance with removable and restorable editor state. */
export const PatternOnly: Story = {
  /**
   * Verifies that an appearance may consist only of one reusable pattern.
   *
   * @param context - Story interaction context.
   * @param context.canvas - Rendered story queries.
   * @param context.userEvent - Browser interaction driver.
   * @returns A promise that resolves after editor interactions pass.
   */
  play: async ({ canvas, userEvent }) => {
    await expect(
      canvas.getByRole("combobox", {
        name: "web.slider.appearance.pattern",
      }),
    ).toHaveValue("Honeycomb");
    await userEvent.click(
      canvas.getByRole("button", { name: "web.action.removeFinishOption" }),
    );
    await expect(
      canvas.queryByRole("combobox", {
        name: "web.slider.appearance.pattern",
      }),
    ).toBeNull();

    await userEvent.click(
      canvas.getByRole("button", { name: "web.action.addFinishOption" }),
    );
    await expect(
      canvas.getByRole("combobox", {
        name: "web.slider.appearance.pattern",
      }),
    ).toHaveValue("");
  },
};
