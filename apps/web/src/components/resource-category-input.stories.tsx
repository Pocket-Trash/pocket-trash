import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { useState } from "react";
import { expect, mocked, within } from "storybook/test";
import { listResourceCategories } from "@/lib/resources";
import { ResourceCategoryInput } from "./resource-category-input";

const categories = [
  { id: 1, name: "3D printing", slug: "3d-printing" },
  { id: 2, name: "Documentation", slug: "documentation" },
  { id: 3, name: "Templates", slug: "templates" },
];

const meta = {
  args: {
    label: "Categories",
    noResultsLabel: "No categories found",
    onChange: () => undefined,
    placeholder: "Search categories",
    removeLabel: (category) => `Remove ${category}`,
    selected: [],
  },
  beforeEach: () => {
    mocked(listResourceCategories).mockResolvedValue(categories);
  },
  component: ResourceCategoryInput,
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
  title: "Components/ResourceCategoryInput",
} satisfies Meta<typeof ResourceCategoryInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const Selected: Story = {
  args: { selected: ["3D printing", "Templates"] },
};

export const Disabled: Story = {
  args: { disabled: true, selected: ["3D printing"] },
};

export const AddAndRemove: Story = {
  render: (args) => <CategoryInputExample {...args} />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(
      canvas.getByRole("combobox", { name: "Search categories" }),
    );
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      await page.findByRole("option", { name: "Documentation" }),
    );
    await expect(canvas.getByText("Documentation")).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Remove Documentation" }),
    );
    await expect(canvas.queryByText("Documentation")).toBeNull();
  },
};

function CategoryInputExample(
  args: React.ComponentProps<typeof ResourceCategoryInput>,
) {
  const [selected, setSelected] = useState<string[]>([]);
  return (
    <ResourceCategoryInput
      {...args}
      onChange={setSelected}
      selected={selected}
    />
  );
}
