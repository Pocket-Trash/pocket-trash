import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { useReducer } from "react";
import { expect, mocked, within } from "storybook/test";
import { listResourceCategories } from "@/lib/resources";
import { ResourceCategoryInput } from "./resource-category-input";

/**
 * Category search results shared by the input stories.
 */
const categories = [
  { id: 1, name: "3D printing", slug: "3d-printing" },
  { id: 2, name: "Documentation", slug: "documentation" },
  { id: 3, name: "Templates", slug: "templates" },
];

/**
 * Configures Storybook coverage for the resource category input examples.
 */
const meta = {
  args: {
    label: "Categories",
    noResultsLabel: "No categories found",
    /**
     * Leaves selection state unchanged in static stories.
     *
     * @returns `undefined` because static stories do not persist selection.
     */
    onChange: () => undefined,
    placeholder: "Search categories",
    /**
     * Builds an accessible category-removal label.
     *
     * @param category - Category being removed.
     * @returns The accessible removal label.
     */
    removeLabel: (category) => `Remove ${category}`,
    selected: [],
  },
  /**
   * Resets category search to the shared results before each story.
   */
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
/**
 * Storybook story contract for the resource category input examples.
 */
type Story = StoryObj<typeof meta>;

/**
 * Defines the empty resource category input story.
 */
export const Empty: Story = {};

/**
 * Defines the selected resource category input story.
 */
export const Selected: Story = {
  args: { selected: ["3D printing", "Templates"] },
};

/**
 * Defines the disabled resource category input story.
 */
export const Disabled: Story = {
  args: { disabled: true, selected: ["3D printing"] },
};

/**
 * Defines the add and remove resource category input story.
 */
export const AddAndRemove: Story = {
  /**
   * Renders the resource category input story example.
   *
   * @param args - Current Storybook story arguments.
   * @returns The rendered story example.
   */
  render: (args) => <CategoryInputExample {...args} />,
  /**
   * Exercises the resource category input story interaction and assertions.
   *
   * @param context - Storybook interaction context.
   * @param context.canvas - Queries scoped to the rendered story canvas.
   * @param context.canvasElement - Rendered Storybook canvas element.
   * @param context.userEvent - Storybook interaction driver.
   * @returns A promise that resolves after the story assertions complete.
   * @rejects When a Storybook interaction or assertion fails.
   */
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
    await userEvent.click(
      canvas.getByRole("combobox", { name: "Search categories" }),
    );
    await page.findByRole("option", { name: "3D printing" });
    await userEvent.keyboard("{ArrowDown}{Enter}");
    await expect(
      canvas.getByRole("button", { name: "Remove 3D printing" }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("combobox", { name: "Search categories" }),
    ).toHaveFocus();
  },
};

/**
 * Renders the category input example UI.
 *
 * @param args - Current Storybook story arguments.
 * @returns The rendered category input example UI.
 */
function CategoryInputExample(
  args: React.ComponentProps<typeof ResourceCategoryInput>,
) {
  const [selected, dispatch] = useReducer(
    (
      _selected: string[],
      event: {
        /** User changed the selected category names. */
        type: "selectionChanged";
        /** Next category selection. */
        categories: string[];
      },
    ) => event.categories,
    [],
  );
  return (
    <ResourceCategoryInput
      {...args}
      onChange={(categories) =>
        dispatch({ type: "selectionChanged", categories })
      }
      selected={selected}
    />
  );
}
