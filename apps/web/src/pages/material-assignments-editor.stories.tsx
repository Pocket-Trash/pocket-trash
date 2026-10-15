import type { Meta, StoryObj } from "@storybook/tanstack-react";
import * as React from "react";
import { expect, waitFor, within } from "storybook/test";
import type { CatalogOptions, ProductFormValue } from "@/lib/catalog-api";
import { useCatalogCopy } from "@/lib/catalog-copy";
import { StoryProviders } from "../../.storybook/story-fixtures";
import { MaterialAssignmentsEditor } from "./catalog-form-pages";

/** Minimal canonical choices used by the material-combination story. */
const options: CatalogOptions = {
  colorEffects: [],
  colors: [],
  finishes: [],
  makers: [],
  materialSpecifics: [
    {
      description: null,
      id: 2000,
      materialId: 1001,
      name: "M390",
      slug: "m390",
    },
  ],
  materials: [
    { id: 1000, name: "Titanium", slug: "titanium" },
    { id: 1001, name: "Steel", slug: "steel" },
  ],
  mechanisms: [],
  patterns: [],
  productTypes: [],
  relationshipProducts: [],
  spinnerButtons: [],
};

/**
 * Hosts the controlled editor with caller-provided material combinations.
 *
 * @param props - Story fixture properties.
 * @param props.initialValue - Initial controlled material combinations.
 * @returns Interactive material-combination editor fixture.
 */
function MaterialAssignmentsStory({
  initialValue = [
    {
      materials: [
        { materialId: 1000, materialSpecificId: null },
        { materialId: 1001, materialSpecificId: 2000 },
      ],
    },
  ],
}: {
  /** Initial controlled material combinations. */
  initialValue?: ProductFormValue["materialAssignments"];
}) {
  const t = useCatalogCopy();
  const [value, setValue] =
    React.useState<ProductFormValue["materialAssignments"]>(initialValue);
  const [catalogOptions, setCatalogOptions] = React.useState(options);
  return (
    <MaterialAssignmentsEditor
      onChange={setValue}
      onOptionsChange={setCatalogOptions}
      options={catalogOptions}
      singleAssignment={false}
      t={t}
      value={value}
    />
  );
}

/** Configures Storybook coverage for material-combination editing. */
const meta = {
  component: MaterialAssignmentsStory,
  decorators: [
    (Story) => (
      <StoryProviders>
        <div className="w-[40rem] max-w-full">
          <Story />
        </div>
      </StoryProviders>
    ),
  ],
  title: "Components/MaterialAssignmentsEditor",
} satisfies Meta<typeof MaterialAssignmentsStory>;

export default meta;
/** Material-combination story contract. */
type Story = StoryObj<typeof meta>;

/** Shows and exercises an existing multi-material assignment. */
export const MultipleMaterials: Story = {
  /**
   * Opens the editor and verifies its accessible modal controls.
   *
   * @param context - Storybook interaction context.
   * @param context.canvas - Queries scoped to the rendered story.
   * @param context.canvasElement - Story root used to reach the dialog surface.
   * @param context.userEvent - Storybook interaction driver.
   */
  play: async ({ canvas, canvasElement, userEvent }) => {
    await expect(canvas.getByText("Titanium + M390")).toBeVisible();
    const edit = canvas.getByRole("button", { name: "Edit" });
    await userEvent.click(edit);
    const page = within(canvasElement.ownerDocument.body);
    await expect(page.getByRole("dialog", { name: "Materials" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Save" })).toBeEnabled();
    await userEvent.keyboard("{Escape}");
    await expect(
      page.getByRole("dialog", { name: "Materials" }),
    ).toHaveAttribute("data-closed");
    await waitFor(() => expect(edit).toHaveFocus());
  },
};

/** Opens simple and advanced add flows with one and two component rows. */
export const AddFlows: Story = {
  args: { initialValue: [] },
  /**
   * Verifies simple and advanced add actions seed the intended row counts.
   *
   * @param context - Storybook interaction context.
   * @param context.canvas - Queries scoped to the rendered story.
   * @param context.canvasElement - Story root used to reach the sheet surface.
   * @param context.userEvent - Storybook interaction driver.
   */
  play: async ({ canvas, canvasElement, userEvent }) => {
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      canvas.getByRole("button", { name: "Select a material" }),
    );
    await expect(
      page.getAllByRole("combobox", { name: "Materials" }),
    ).toHaveLength(1);
    await userEvent.keyboard("{Escape}");
    await userEvent.click(
      canvas.getByRole("button", { name: "Select materials" }),
    );
    await expect(
      page.getAllByRole("combobox", { name: "Materials" }),
    ).toHaveLength(2);
  },
};

/** Shows duplicate component validation before saving the combination. */
export const DuplicateComponents: Story = {
  args: {
    initialValue: [
      {
        materials: [
          { materialId: 1000, materialSpecificId: null },
          { materialId: 1000, materialSpecificId: null },
        ],
      },
    ],
  },
  /**
   * Verifies duplicate pairs are explained and cannot be saved.
   *
   * @param context - Storybook interaction context.
   * @param context.canvas - Queries scoped to the rendered story.
   * @param context.canvasElement - Story root used to reach the sheet surface.
   * @param context.userEvent - Storybook interaction driver.
   */
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Edit" }));
    const page = within(canvasElement.ownerDocument.body);
    await expect(page.getByRole("alert")).toHaveTextContent(
      "This material and alloy or grade combination is already selected.",
    );
    await expect(page.getByRole("button", { name: "Save" })).toBeDisabled();
  },
};
