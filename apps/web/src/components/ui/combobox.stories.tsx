import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { useState } from "react";
import { expect, fn, waitFor, within } from "storybook/test";
import {
  CatalogCombobox,
  CatalogMultiCombobox,
  type ComboboxOption,
} from "./combobox";

/**
 * Shared selected catalog option used by combobox stories.
 */
const bronze = { id: 1, name: "Bronze" };
/**
 * Catalog options displayed by combobox stories.
 */
const options: ComboboxOption[] = [
  bronze,
  { id: 2, name: "Titanium" },
  { id: 3, name: "Zirconium" },
];

/**
 * Configures Storybook coverage for the combobox examples.
 */
const meta = {
  args: {
    ariaLabel: "Material",
    items: options,
    onValueChange: fn(),
    placeholder: "Select a material",
    removeLabel: "Remove",
    value: null,
  },
  component: CatalogCombobox,
  decorators: [
    (Story) => (
      <div className="w-72">
        <Story />
      </div>
    ),
  ],
  title: "UI/Combobox",
} satisfies Meta<typeof CatalogCombobox>;

export default meta;
/**
 * Storybook story contract for the combobox examples.
 */
type Story = StoryObj<typeof meta>;

/**
 * Shows the combobox empty example.
 */
export const Empty: Story = {};

/**
 * Shows the combobox selected with pill example.
 */
export const SelectedWithPill: Story = {
  args: { showSelectedPill: true, value: options[0] },
};

/**
 * Shows the combobox single selection example.
 */
export const SingleSelection: Story = {
  /**
   * Renders the combobox single selection example.
   *
   * @param args - Current Storybook story arguments.
   * @returns The rendered story example.
   */
  render: (args) => <SingleCombobox {...args} />,
  /**
   * Exercises the combobox single selection interaction and assertions.
   *
   * @param context - Storybook interaction context.
   * @param context.canvas - Queries scoped to the rendered story canvas.
   * @param context.canvasElement - Rendered Storybook canvas element.
   * @param context.userEvent - Storybook interaction driver.
   */
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole("combobox", { name: "Material" }));
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      await page.findByRole("option", { name: "Titanium" }),
    );

    await expect(canvas.getByDisplayValue("Titanium")).toBeVisible();
    await waitFor(() => expect(page.queryByRole("listbox")).toBeNull());
  },
};

/**
 * Shows the combobox multiple selection example.
 */
export const MultipleSelection: Story = {
  /**
   * Renders the combobox multiple selection example.
   *
   * @returns The rendered story example.
   */
  render: () => <MultiCombobox />,
  /**
   * Exercises the combobox multiple selection interaction and assertions.
   *
   * @param context - Storybook interaction context.
   * @param context.canvas - Queries scoped to the rendered story canvas.
   * @param context.canvasElement - Rendered Storybook canvas element.
   * @param context.userEvent - Storybook interaction driver.
   */
  play: async ({ canvas, canvasElement, userEvent }) => {
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole("combobox", { name: "Materials" }));
    await userEvent.click(
      await page.findByRole("option", { name: "Titanium" }),
    );

    await expect(
      canvas.getByRole("button", { name: "Remove: Titanium" }),
    ).toBeVisible();
    await waitFor(() => expect(page.queryByRole("listbox")).toBeNull());
    await userEvent.click(
      canvas.getByRole("button", { name: "Remove: Titanium" }),
    );
    await expect(
      canvas.queryByRole("button", { name: "Remove: Titanium" }),
    ).toBeNull();
  },
};

/**
 * Renders a stateful single-select combobox story example.
 *
 * @param props - Single combobox properties.
 * @returns The rendered single combobox UI.
 */
function SingleCombobox(props: React.ComponentProps<typeof CatalogCombobox>) {
  const [value, setValue] = useState<ComboboxOption | null>(null);
  return (
    <CatalogCombobox
      {...props}
      onValueChange={setValue}
      showSelectedPill
      value={value}
    />
  );
}

/**
 * Renders a stateful multi-select combobox story example.
 *
 * @returns The rendered multi combobox UI.
 */
function MultiCombobox() {
  const [value, setValue] = useState<ComboboxOption[]>([bronze]);
  return (
    <CatalogMultiCombobox
      ariaLabel="Materials"
      items={options}
      onValueChange={setValue}
      placeholder="Select materials"
      removeLabel="Remove"
      value={value}
    />
  );
}
