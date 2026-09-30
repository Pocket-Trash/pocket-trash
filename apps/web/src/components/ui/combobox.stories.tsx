import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { useState } from "react";
import { expect, fn, waitFor, within } from "storybook/test";
import {
  CatalogCombobox,
  CatalogMultiCombobox,
  type ComboboxOption,
} from "./combobox";

const bronze = { id: 1, name: "Bronze" };
const options: ComboboxOption[] = [
  bronze,
  { id: 2, name: "Titanium" },
  { id: 3, name: "Zirconium" },
];

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
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const SelectedWithPill: Story = {
  args: { showSelectedPill: true, value: options[0] },
};

export const SingleSelection: Story = {
  render: (args) => <SingleCombobox {...args} />,
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

export const MultipleSelection: Story = {
  render: () => <MultiCombobox />,
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
