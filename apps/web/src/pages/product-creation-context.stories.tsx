import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, within } from "storybook/test";
import type { CatalogOptions } from "@/lib/catalog-api";
import { mockStoryRole, StoryProviders } from "../../.storybook/story-fixtures";
import { ProductEditor, ProductFormPage } from "./catalog-form-pages";
import { productFixture } from "./catalog-test-fixtures";

/** Available types deliberately retain their persisted names in the fixtures. */
const options: CatalogOptions = {
  colorEffects: [],
  colors: [],
  finishes: [],
  makers: [],
  materials: [],
  mechanisms: [],
  patterns: [],
  relationshipProducts: [],
  spinnerButtons: [],
  productTypes: [
    { id: 1000, slug: "pen-clip", name: "Pen clip" },
    { id: 1001, slug: "spinner", name: "Spinner" },
    { id: 1002, slug: "pen-actuator", name: "Pen Actuator" },
    { id: 1003, slug: "pen-mechanism", name: "Pen mechanism" },
  ].map((type) => ({
    ...type,
    imageAlt: "No image set",
    imageUrl: "https://cdn.pocket-trash.app/assets/static/no-image.png",
    isPartOrAccessory: type.slug !== "spinner",
  })),
};

/** Product creation keeps an explicit route type editable. */
const meta = {
  component: ProductFormPage,
  args: { options, initialProductTypeSlug: "pen-clip" },
  /**
   * Installs the editor role required by catalog authoring.
   * @returns Completion after the authentication mocks are ready.
   */
  beforeEach: () => mockStoryRole("editor"),
  decorators: [
    (Story) => (
      <StoryProviders>
        <Story />
      </StoryProviders>
    ),
  ],
  title: "Pages/ProductCreationContext",
} satisfies Meta<typeof ProductFormPage>;
export default meta;
/** Product creation context story contract. */
type Story = StoryObj<typeof meta>;

/** The chosen type can change after entering with a catalog filter. */
export const PreselectedType: Story = {
  /**
   * Changes the preselected type and verifies the complete submit wording.
   * @param context - Browser interaction context.
   */
  play: async ({ canvas, canvasElement, userEvent }) => {
    const type = canvas.getByRole("combobox", { name: "Product type" });
    await expect(type).toHaveValue("Pen clip");
    await expect(
      canvas.getByRole("button", { name: "Add pen clip" }),
    ).toBeVisible();
    await userEvent.click(type);
    await userEvent.clear(type);
    await userEvent.type(type, "Spinner");
    await userEvent.keyboard("{ArrowDown}{Enter}");
    await expect(type).toHaveValue("Spinner");
    await expect(
      canvas.getByRole("button", { name: "Add spinner" }),
    ).toBeVisible();
    await expect(
      within(canvasElement.ownerDocument.body).queryByRole("button", {
        name: "Add pen clip",
      }),
    ).not.toBeInTheDocument();
  },
};

/** Invalid or unavailable route context falls back to choosing a type. */
export const UnavailableType: Story = {
  args: { initialProductTypeSlug: "pen-tip" },
  /**
   * Verifies that an unavailable type does not create unsupported fields.
   * @param context - Browser interaction context.
   */
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("combobox", { name: "Product type" }),
    ).toHaveValue("");
    await expect(
      canvas.queryByRole("textbox", { name: "Name" }),
    ).not.toBeInTheDocument();
  },
};

/** Embedded creation and editing retain their separate action semantics. */
export const EmbeddedMechanism: Story = {
  /**
   * Renders the same editor used for inline product creation.
   * @returns Embedded mechanism creation fields.
   */
  render: () => (
    <ProductEditor
      options={options}
      productTypeSlug="pen-mechanism"
      onCreated={() => {}}
    />
  ),
  /**
   * Verifies that embedded creation identifies its product type.
   * @param context - Browser interaction context.
   */
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("button", { name: "Add pen mechanism" }),
    ).toBeVisible();
  },
};

/** Existing product saves keep their established action. */
export const EditMechanism: Story = {
  args: {
    initialProduct: productFixture(1003, "Spring mechanism", "pen-mechanism"),
  },
  /**
   * Verifies an edit never displays a create submit action.
   * @param context - Browser interaction context.
   */
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: "Save" })).toBeVisible();
    await expect(
      canvas.queryByRole("button", { name: "Add pen mechanism" }),
    ).not.toBeInTheDocument();
  },
};

/** Actuator examples remain readable in the phone type selector. */
export const MobileActuator: Story = {
  args: { initialProductTypeSlug: "pen-actuator" },
  parameters: { viewport: { defaultViewport: "mobile1" } },
  /**
   * Opens the narrow selector while preserving concise submit copy.
   * @param context - Browser interaction context.
   */
  play: async ({ canvas, canvasElement, userEvent }) => {
    await expect(window.innerWidth).toBeLessThanOrEqual(400);
    const type = canvas.getByRole("combobox", { name: "Product type" });
    await expect(type).toHaveValue("Pen actuator (e.g. bolt pin, button)");
    await expect(
      canvas.getByRole("button", { name: "Add pen actuator" }),
    ).toBeVisible();
    await userEvent.click(type);
    const list = await within(canvasElement.ownerDocument.body).findByRole(
      "listbox",
      { name: "Product type" },
    );
    await expect(
      within(list).getByRole("option", {
        name: "Pen actuator (e.g. bolt pin, button)",
      }),
    ).toBeVisible();
    await expect(list.getBoundingClientRect().right).toBeLessThanOrEqual(
      window.innerWidth,
    );
    await expect(list.scrollWidth).toBeLessThanOrEqual(list.clientWidth);
    await userEvent.keyboard("{Escape}");
  },
};
