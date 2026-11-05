import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { useForm, useStore } from "@tanstack/react-form";
import React from "react";
import { expect, fireEvent, waitFor, within } from "storybook/test";
import type { CatalogOptions } from "@/lib/catalog-api";
import { useCatalogCopy } from "@/lib/catalog-copy";
import { mockStoryRole, StoryProviders } from "../../.storybook/story-fixtures";
import { MaterialAssignmentsEditor, ProductEditor } from "./catalog-form-pages";
import { productFixture } from "./catalog-test-fixtures";

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
 * Receives lookup creation through the existing shared-control contract.
 * @param state - Current fixture lookups.
 * @param event - Pure lookup replacement or updater.
 * @returns Updated fixture lookups.
 */
function storyOptionsReducer(
  state: CatalogOptions,
  event: {
    /** Lookup creation updated available choices. */
    type: "lookupsChanged";
    /** Existing shared callback payload. */
    update: React.SetStateAction<CatalogOptions>;
  },
): CatalogOptions {
  return typeof event.update === "function"
    ? event.update(state)
    : event.update;
}

/**
 * Hosts the controlled editor with caller-provided material combinations.
 *
 * @param props - Story fixture properties.
 * @param props.initialValue - Initial controlled material combinations.
 * @returns Interactive material-combination editor fixture.
 */
function MaterialAssignmentsStory({
  singleAssignment = false,
  initialValue = [
    {
      weight: { unit: "g", value: "" },
      materials: [
        { materialId: 1000, materialSpecificId: null },
        { materialId: 1001, materialSpecificId: 2000 },
      ],
    },
  ],
}: {
  /** Whether this caller accepts only one material option. */
  singleAssignment?: boolean;
  /** Initial controlled material combinations. */
  initialValue?: Parameters<typeof MaterialAssignmentsEditor>[0]["value"];
}) {
  const t = useCatalogCopy();
  const form = useForm({ defaultValues: { assignments: initialValue } });
  const value = useStore(form.store, (state) => state.values.assignments);
  const [catalogOptions, dispatchOptions] = React.useReducer(
    storyOptionsReducer,
    options,
  );
  return (
    <MaterialAssignmentsEditor
      onChange={(value) => form.setFieldValue("assignments", value)}
      onOptionsChange={(update) =>
        dispatchOptions({ type: "lookupsChanged", update })
      }
      options={catalogOptions}
      singleAssignment={singleAssignment}
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
    const edit = canvas.getByRole("button", {
      name: "Edit material combination",
    });
    await userEvent.click(edit);
    const page = within(canvasElement.ownerDocument.body);
    const dialog = await page.findByRole("dialog", { name: "Material option" });
    await expect(dialog).toBeVisible();
    await expect(dialog.tagName).toBe("DIALOG");
    await expect(page.getByRole("button", { name: "Save" })).toBeEnabled();
    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    await expect(
      page.queryByRole("dialog", { name: "Material option" }),
    ).not.toBeInTheDocument();
    await waitFor(() => expect(edit).toHaveFocus());
  },
};

/** One add action begins one component and expands within the same editor. */
export const AddFlows: Story = {
  args: { initialValue: [] },
  /**
   * Opens one material option and explicitly adds its second component.
   * @param context - Story interaction context.
   */
  play: async ({ canvas, canvasElement, userEvent }) => {
    const page = within(canvasElement.ownerDocument.body);
    await expect(
      canvas.queryByRole("button", { name: "Add material combination" }),
    ).not.toBeInTheDocument();
    await expect(
      canvas.getByRole("button", { name: "Add to material list" }),
    ).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Add material option" }),
    );
    const dialog = await page.findByRole("dialog", { name: "Material option" });
    await expect(
      within(dialog).getByRole("combobox", { name: "Material 1" }),
    ).toBeVisible();
    await expect(
      within(dialog).queryByRole("combobox", { name: "Material 2" }),
    ).not.toBeInTheDocument();
    await userEvent.click(
      within(dialog).getByRole("button", {
        name: "Add another material to this option",
      }),
    );
    await expect(
      within(dialog).getByRole("combobox", { name: "Material 2" }),
    ).toBeVisible();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Cancel" }),
    );
  },
};

/** Shows duplicate component validation before saving the combination. */
export const DuplicateComponents: Story = {
  args: {
    initialValue: [
      {
        weight: { unit: "g", value: "" },
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
    await userEvent.click(
      canvas.getByRole("button", { name: "Edit material combination" }),
    );
    const page = within(canvasElement.ownerDocument.body);
    await expect(page.getByRole("alert")).toHaveTextContent(
      "Each material can appear only once in a combination.",
    );
    await expect(page.getByRole("button", { name: "Save" })).toBeDisabled();
  },
};

/** Grades are explicit and a changed parent clears its incompatible grade. */
export const GradeStates: Story = {
  /**
   * Checks the noninteractive no-grade state and clears a grade across parent changes.
   * @param context - Story interaction context.
   */
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Edit material combination" }),
    );
    const dialog = await within(canvasElement.ownerDocument.body).findByRole(
      "dialog",
      { name: "Material option" },
    );
    const modal = within(dialog);
    await expect(
      modal.getByText("No alloys or grades are listed for this material."),
    ).toBeVisible();
    await expect(
      modal.queryByRole("combobox", {
        name: "Alloy or grade (optional) for material 1",
      }),
    ).not.toBeInTheDocument();
    const parent = modal.getByRole("combobox", { name: "Material 2" });
    await userEvent.click(parent);
    await userEvent.clear(parent);
    await userEvent.type(parent, "Titanium");
    await expect(
      await modal.findByRole("listbox", { name: "Material 2" }),
    ).toBeVisible();
    await userEvent.keyboard("{ArrowDown}{Enter}");
    await expect(
      modal.queryByRole("combobox", {
        name: "Alloy or grade (optional) for material 2",
      }),
    ).not.toBeInTheDocument();
    await userEvent.click(parent);
    await userEvent.clear(parent);
    await userEvent.type(parent, "Steel");
    await userEvent.keyboard("{ArrowDown}{Enter}");
    await expect(
      modal.getByRole("combobox", {
        name: "Alloy or grade (optional) for material 2",
      }),
    ).toHaveValue("");
    await expect(
      modal.getByRole("combobox", {
        name: "Alloy or grade (optional) for material 2",
      }),
    ).toHaveAttribute("placeholder", "Not specified");
    await userEvent.click(modal.getByRole("button", { name: "Save" }));
    await expect(canvas.getByText("Titanium + Steel")).toBeVisible();
  },
};

/** Adding one option and canceling later edits leaves the saved draft unchanged. */
export const AddAndCancel: Story = {
  args: { initialValue: [] },
  /**
   * Saves one material option, then discards a different material in the editor.
   * @param context - Story interaction context.
   */
  play: async ({ canvas, canvasElement, userEvent }) => {
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      canvas.getByRole("button", { name: "Add material option" }),
    );
    let dialog = await page.findByRole("dialog", { name: "Material option" });
    const material = within(dialog).getByRole("combobox", {
      name: "Material 1",
    });
    await userEvent.click(material);
    await userEvent.type(material, "Titanium");
    await userEvent.keyboard("{ArrowDown}{Enter}");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await expect(canvas.getByText("Titanium")).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Edit material combination" }),
    );
    dialog = await page.findByRole("dialog", { name: "Material option" });
    const editMaterial = within(dialog).getByRole("combobox", {
      name: "Material 1",
    });
    await userEvent.click(editMaterial);
    await userEvent.clear(editMaterial);
    await userEvent.type(editMaterial, "Steel");
    await userEvent.keyboard("{ArrowDown}{Enter}");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Cancel" }),
    );
    await expect(canvas.getByText("Titanium")).toBeVisible();
    await expect(canvas.queryByText("Steel")).not.toBeInTheDocument();
  },
};

/** Icon actions explain edits/removal and preserve the reusable material list. */
export const TooltipsAndSingleOption: Story = {
  args: { singleAssignment: true },
  /**
   * Shows both icon tooltips and removes only the product option.
   * @param context - Story interaction context.
   */
  play: async ({ canvas, canvasElement, userEvent }) => {
    const page = within(canvasElement.ownerDocument.body);
    await expect(
      canvas.getByRole("button", { name: "Add material option" }),
    ).toBeDisabled();
    const edit = canvas.getByRole("button", {
      name: "Edit material combination",
    });
    await userEvent.hover(edit);
    await expect(
      await page.findByText("Edit material combination"),
    ).toBeVisible();
    await userEvent.unhover(edit);
    const remove = canvas.getByRole("button", {
      name: "Remove this material option",
    });
    await userEvent.hover(remove);
    await expect(
      await page.findByText("Remove this material option"),
    ).toBeVisible();
    await userEvent.click(remove);
    await expect(canvas.queryByText("Titanium + M390")).not.toBeInTheDocument();
    await expect(
      canvas.getByRole("button", { name: "Add material option" }),
    ).toBeEnabled();
    await userEvent.click(
      canvas.getByRole("button", { name: "Add material option" }),
    );
    const dialog = await page.findByRole("dialog", { name: "Material option" });
    await userEvent.click(
      within(dialog).getByRole("combobox", { name: "Material 1" }),
    );
    await expect(
      within(dialog).getByRole("option", { name: "Titanium" }),
    ).toBeVisible();
    await expect(
      within(dialog).getByRole("option", { name: "Steel" }),
    ).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Cancel" }),
    );
  },
};

/** Desktop editing is centered while the mobile flow keeps the right-side sheet. */
export const CenteredDesktopModal: Story = {
  /**
   * Verifies the desktop modal is centered and restores its opener after cancellation.
   * @param context - Story interaction context.
   */
  play: async ({ canvas, canvasElement, userEvent }) => {
    const edit = canvas.getByRole("button", {
      name: "Edit material combination",
    });
    await userEvent.click(edit);
    const dialog = await within(canvasElement.ownerDocument.body).findByRole(
      "dialog",
      { name: "Material option" },
    );
    const bounds = dialog.getBoundingClientRect();
    await expect(
      Math.abs(bounds.left + bounds.width / 2 - window.innerWidth / 2),
    ).toBeLessThan(3);
    await expect(
      Math.abs(bounds.top + bounds.height / 2 - window.innerHeight / 2),
    ).toBeLessThan(3);
    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    await waitFor(() => expect(edit).toHaveFocus());
  },
};

/** Narrow layouts retain the established right sheet and avoid horizontal overflow. */
export const MobileMaterialOption: Story = {
  parameters: { viewport: { defaultViewport: "mobile1" } },
  /**
   * Opens the mobile sheet and checks its horizontal fit and dismissal.
   * @param context - Story interaction context.
   */
  play: async ({ canvas, canvasElement, userEvent }) => {
    await expect(window.innerWidth).toBeLessThanOrEqual(400);
    const edit = canvas.getByRole("button", {
      name: "Edit material combination",
    });
    await userEvent.click(edit);
    const dialog = await within(canvasElement.ownerDocument.body).findByRole(
      "dialog",
      { name: "Material option" },
    );
    await expect(dialog.tagName).not.toBe("DIALOG");
    const bounds = dialog.getBoundingClientRect();
    await expect(bounds.left).toBeGreaterThanOrEqual(0);
    await waitFor(() =>
      expect(dialog.getBoundingClientRect().right).toBeLessThanOrEqual(
        window.innerWidth,
      ),
    );
    await expect(dialog.scrollWidth).toBeLessThanOrEqual(dialog.clientWidth);
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(edit).toHaveFocus());
  },
};

/** The full product form keeps material summaries within a small phone viewport. */
export const MobileProductForm: Story = {
  parameters: { viewport: { defaultViewport: "mobile1" } },
  /**
   * Installs the editor role for the complete product form.
   * @returns Completion after installing the Clerk mocks.
   */
  beforeEach: () => mockStoryRole("editor"),
  /**
   * Renders the shared material editor inside its complete product-form caller.
   * @returns Product editing fields with a combined material option.
   */
  render: () => (
    <ProductEditor
      productTypeSlug="pen"
      options={options}
      initialProduct={{
        ...productFixture(1100, "Test Pen", "pen"),
        materials: [
          {
            assignmentId: 1,
            weight: null,
            materials: [
              { id: 1000, name: "Titanium", slug: "titanium", specific: null },
              {
                id: 1001,
                name: "Steel",
                slug: "steel",
                specific: options.materialSpecifics?.[0] ?? null,
              },
            ],
          },
        ],
      }}
    />
  ),
  /**
   * Checks the entire form rather than only the material controls for overflow.
   * @param context - Story interaction context.
   * @rejects When the product form fixture is absent.
   */
  play: async ({ canvasElement }) => {
    await expect(window.innerWidth).toBeLessThanOrEqual(400);
    const form = canvasElement.querySelector("form");
    if (!form) throw new Error("Missing product form fixture.");
    await expect(form.getBoundingClientRect().right).toBeLessThanOrEqual(
      window.innerWidth,
    );
    await expect(form.scrollWidth).toBeLessThanOrEqual(form.clientWidth);
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(
      window.innerWidth,
    );
  },
};
