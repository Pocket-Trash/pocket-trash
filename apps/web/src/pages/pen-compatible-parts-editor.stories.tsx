import type { CatalogProduct } from "@package/services";
import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, waitFor, within } from "storybook/test";
import type { CatalogOptions } from "@/lib/catalog-api";
import { mockStoryRole, StoryProviders } from "../../.storybook/story-fixtures";
import { ProductEditor } from "./catalog-form-pages";

/**
 * Creates a compact Pen or Pen-part fixture for relationship stories.
 *
 * @param id - Stable product identifier.
 * @param name - Product display name.
 * @param productTypeSlug - Canonical Pen or part type.
 * @returns Complete catalog product fixture.
 */
function product(
  id: number,
  name: string,
  productTypeSlug: "pen" | "pen-clip" | "pen-tip",
): CatalogProduct {
  return {
    aliases: [],
    approvalStatus: "approved",
    bearing: null,
    buttonDiameter: null,
    canAdminister: false,
    canEdit: true,
    clickCount: null,
    compatibleButtonId: null,
    compatibleButtonName: null,
    compatiblePens: [],
    compatibleParts: [],
    createdAt: new Date(0),
    description: null,
    diameter: null,
    finishOptions: [],
    imageCount: 0,
    images: [],
    includedInsert: null,
    includedPlate: null,
    isAdminPrivate: false,
    isOwner: true,
    isPrivate: false,
    id,
    length: null,
    makerId: 1000,
    makerName: "Test Maker",
    productLinks: [],
    makerSlug: "test-maker",
    makerUrl: null,
    magnetLayout: null,
    materials: [
      {
        assignmentId: 1000 + id,
        weight: null,
        materials: [
          {
            id: 1000,
            name: "Titanium",
            slug: "titanium",
            specific: null,
          },
        ],
      },
    ],
    name,
    ownerClerkId: "user_test",
    productTypeId: id,
    productTypeName: productTypeSlug,
    productTypeSlug,
    refillCompatibility: [],
    refillModel: null,
    refillOfferings: [],
    slug: name.toLowerCase().replaceAll(" ", "-"),
    spinDiameter: null,
    thickness: null,
    thicknessWithButton: null,
    updatedAt: new Date(0),
    usesInserts: null,
    weight: null,
    width: null,
  };
}

/** Selectable Pen-tip fixture. */
const tip = product(1001, "Fine Tip", "pen-tip");
/** Selectable Pen-clip fixture. */
const clip = product(1002, "Machined Clip", "pen-clip");
/** Existing Pen with selections in two roles. */
const pen = {
  ...product(1000, "Test Pen", "pen"),
  interchangeableParts: {
    tip: true,
    clip: true,
    topCap: false,
    actuator: false,
    mechanism: false,
  },
  compatibleParts: [tip, clip].map(
    ({ id, name, productTypeName, productTypeSlug, slug }) => ({
      id,
      name,
      productTypeName,
      productTypeSlug,
      slug,
    }),
  ),
};
/** Catalog lookups required by the complete product editor. */
const options: CatalogOptions = {
  colorEffects: [],
  colors: [],
  finishes: [],
  makers: [
    {
      description: null,
      id: 1000,
      images: [],
      name: "Test Maker",
      rootUrl: null,
      slug: "test-maker",
    },
  ],
  materials: [
    {
      id: 1000,
      name: "Titanium",
      slug: "titanium",
    },
  ],
  mechanisms: [],
  patterns: [],
  productTypes: [],
  relationshipProducts: [tip, clip],
  spinnerButtons: [],
};

/** Storybook metadata for Pen compatible-part editing. */
const meta = {
  args: {
    initialProduct: pen,
    options,
    productTypeSlug: "pen",
  },
  component: ProductEditor,
  /**
   * Configures a signed-in editor before each story.
   *
   * @returns Completion after installing the Clerk mocks.
   */
  beforeEach: () => mockStoryRole("editor"),
  decorators: [
    (Story) => (
      <StoryProviders>
        <Story />
      </StoryProviders>
    ),
  ],
  parameters: { layout: "padded" },
  title: "Components/PenCompatiblePartsEditor",
} satisfies Meta<typeof ProductEditor>;

export default meta;
/** Story type derived from the compatible-part editor metadata. */
type Story = StoryObj<typeof meta>;

/** Shows multiple selected part roles and removable selections. */
export const ExistingSelections: Story = {
  /**
   * Removes one selection while leaving the other role intact.
   *
   * @param root0 - Story interaction context.
   */
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.getByText("Fine Tip")).toBeVisible();
    await expect(canvas.getByText("Machined Clip")).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Remove Fine Tip" }),
    );
    await expect(canvas.queryByText("Fine Tip")).not.toBeInTheDocument();
  },
};

/** Opens full inline part creation and restores focus when canceled. */
export const InlineCreationCancel: Story = {
  /**
   * Opens and cancels embedded creation, then checks focus restoration.
   *
   * @param root0 - Story interaction context.
   * @rejects When the Pen-tip creation control is absent.
   */
  play: async ({ canvas, canvasElement, userEvent }) => {
    const addTip = canvas.getByRole("button", { name: "Add pen tip" });
    if (!addTip) throw new Error("Missing Pen-tip creation control.");
    await userEvent.click(addTip);
    const page = within(canvasElement.ownerDocument.body);
    const dialog = await page.findByRole("dialog", { name: "Add pen tip" });
    await expect(dialog).toBeVisible();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Cancel" }),
    );
    await waitFor(() => expect(addTip).toHaveFocus());
  },
};

/** Requires explicit customization before disclosing a non-interchangeable role. */
export const CustomizationConfirmation: Story = {
  args: { initialProduct: undefined },
  /**
   * Verifies cancellation leaves the role unchecked and confirmation reveals its picker.
   * @param root0 - Story interaction context.
   */
  play: async ({ canvas, canvasElement, userEvent }) => {
    const page = within(canvasElement.ownerDocument.body);
    const parts = within(
      canvas.getByRole("group", { name: "Compatible parts" }),
    );
    const tips = parts.getByRole("checkbox", { name: /Pen tips/ });
    await userEvent.click(tips);
    await expect(
      page.getByRole("dialog", { name: "Confirm customization" }),
    ).toBeVisible();
    await userEvent.click(
      within(
        page.getByRole("dialog", { name: "Confirm customization" }),
      ).getByRole("button", { name: "Cancel" }),
    );
    await waitFor(() => expect(tips).toHaveFocus());
    await expect(tips).not.toBeChecked();
    await userEvent.click(tips);
    await userEvent.click(page.getByRole("button", { name: "Yes, continue" }));
    await expect(tips).toBeChecked();
    await expect(
      parts.getByRole("combobox", { name: "Pen tips" }),
    ).toBeVisible();
    const tipFact = within(canvas.getByRole("group", { name: "Tip" }));
    await expect(tipFact.getByRole("radio", { name: "No" })).toBeChecked();
  },
};

/** Confirms a new draft selection when its role changes from Yes to No. */
export const DraftBecomesCustomized: Story = {
  args: { initialProduct: undefined },
  /**
   * Keeps the Yes answer on cancel, then accepts the new customization exception.
   * @param root0 - Story interaction context.
   */
  play: async ({ canvas, canvasElement, userEvent }) => {
    const page = within(canvasElement.ownerDocument.body);
    const tipFact = within(canvas.getByRole("group", { name: "Tip" }));
    await userEvent.click(tipFact.getByRole("radio", { name: "Yes" }));
    const parts = within(
      canvas.getByRole("group", { name: "Compatible parts" }),
    );
    await userEvent.click(parts.getByRole("checkbox", { name: /Pen tips/ }));
    await userEvent.click(parts.getByRole("combobox", { name: "Pen tips" }));
    await userEvent.type(
      parts.getByRole("combobox", { name: "Pen tips" }),
      "Fine",
    );
    await userEvent.keyboard("{ArrowDown}{Enter}");
    await expect(
      parts.getByRole("button", { name: "Remove Fine Tip" }),
    ).toBeVisible();
    await userEvent.click(tipFact.getByRole("radio", { name: "No" }));
    const dialog = await page.findByRole("dialog", {
      name: "Confirm customization",
    });
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Cancel" }),
    );
    await expect(tipFact.getByRole("radio", { name: "Yes" })).toBeChecked();
    await userEvent.click(tipFact.getByRole("radio", { name: "No" }));
    await userEvent.click(page.getByRole("button", { name: "Yes, continue" }));
    await expect(tipFact.getByRole("radio", { name: "No" })).toBeChecked();
    await expect(parts.getByText("Fine Tip")).toBeVisible();
  },
};

/** One physical clip also performs the actuator role. */
const dualClip: CatalogProduct = {
  ...clip,
  penPartRoles: ["clip", "actuator"],
};
/** Multi-role compatibility fixture with both roles ordinarily interchangeable. */
const dualRolePen: CatalogProduct = {
  ...pen,
  compatibleParts: [],
  interchangeableParts: {
    tip: true,
    clip: true,
    topCap: false,
    actuator: true,
    mechanism: false,
  },
};

/** Authors an additional role while retaining the primary product type. */
export const MultipleFunctionalRoles: Story = {
  args: { initialProduct: clip, productTypeSlug: "pen-clip" },
  /**
   * Keeps the primary Clip role selected and adds Actuator with the keyboard.
   * @param root0 - Story interaction context.
   */
  play: async ({ canvas, userEvent }) => {
    const roles = within(
      canvas.getByRole("group", { name: "What does this part do?" }),
    );
    await expect(roles.getByRole("checkbox", { name: /Clip/ })).toBeChecked();
    await expect(roles.getByRole("checkbox", { name: /Clip/ })).toBeDisabled();
    const actuator = roles.getByRole("checkbox", { name: "Actuator" });
    actuator.focus();
    await userEvent.keyboard(" ");
    await expect(actuator).toBeChecked();
  },
};
/** Selecting one multi-role clip creates two synchronized appearances. */
export const RoleAwareCompatibility: Story = {
  args: {
    initialProduct: dualRolePen,
    options: { ...options, relationshipProducts: [tip, dualClip] },
  },
  /**
   * Selects a clip once, shows it in both roles, and removes its one selection.
   * @param root0 - Story interaction context.
   * @rejects When the selected clip removal control is absent.
   */
  play: async ({ canvas, userEvent }) => {
    const parts = within(
      canvas.getByRole("group", { name: "Compatible parts" }),
    );
    await userEvent.click(parts.getByRole("checkbox", { name: "Pen clips" }));
    const input = parts.getByRole("combobox", { name: "Pen clips" });
    await userEvent.click(input);
    await userEvent.type(input, "Machined");
    await userEvent.keyboard("{ArrowDown}{Enter}");
    await expect(
      parts.getByRole("combobox", {
        name: "Pen actuator (e.g. bolt pin, button)",
      }),
    ).toBeVisible();
    await expect(
      parts.getAllByRole("button", { name: "Remove Machined Clip" }),
    ).toHaveLength(2);
    const remove = parts.getAllByRole("button", {
      name: "Remove Machined Clip",
    })[0];
    if (!remove) throw new Error("Missing selected clip.");
    await userEvent.click(remove);
    await expect(parts.queryByText("Machined Clip")).not.toBeInTheDocument();
  },
};
/** A secondary non-interchangeable role still requires confirmation. */
export const SecondaryRoleCustomization: Story = {
  args: {
    initialProduct: {
      ...dualRolePen,
      interchangeableParts: {
        tip: true,
        clip: true,
        topCap: false,
        actuator: false,
        mechanism: false,
      },
    },
    options: { ...options, relationshipProducts: [dualClip] },
  },
  /**
   * Requires confirmation for Actuator even when selecting through Clips.
   * @param root0 - Story interaction context.
   */
  play: async ({ canvas, canvasElement, userEvent }) => {
    const parts = within(
      canvas.getByRole("group", { name: "Compatible parts" }),
    );
    await userEvent.click(parts.getByRole("checkbox", { name: "Pen clips" }));
    const input = parts.getByRole("combobox", { name: "Pen clips" });
    await userEvent.click(input);
    await userEvent.type(input, "Machined");
    await userEvent.keyboard("{ArrowDown}{Enter}");
    const dialog = await within(canvasElement.ownerDocument.body).findByRole(
      "dialog",
      { name: "Confirm customization" },
    );
    await expect(
      within(dialog).getByText("Actuator", { exact: true }),
    ).toBeVisible();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Yes, continue" }),
    );
    await expect(
      parts.getAllByRole("button", { name: "Remove Machined Clip" }),
    ).toHaveLength(2);
  },
};

/** Mobile authoring retains the primary role and wraps additional role controls. */
export const MobileFunctionalRoles: Story = {
  ...MultipleFunctionalRoles,
  parameters: { viewport: { defaultViewport: "mobile1" } },
  /**
   * Exercises keyboard role assignment and checks horizontal fit on a small phone.
   * @param context - Story interaction context.
   */
  play: async (context) => {
    await expect(window.innerWidth).toBeLessThanOrEqual(400);
    await MultipleFunctionalRoles.play?.(context);
    const roles = context.canvas.getByRole("group", {
      name: "What does this part do?",
    });
    await expect(roles.getBoundingClientRect().right).toBeLessThanOrEqual(
      window.innerWidth,
    );
    await expect(roles.scrollWidth).toBeLessThanOrEqual(roles.clientWidth);
  },
};
/** Mobile compatibility shows one clip in both role groups. */
export const MobileRoleCompatibility: Story = {
  ...RoleAwareCompatibility,
  parameters: { viewport: { defaultViewport: "mobile1" } },
  /**
   * Exercises synchronized selection and checks wrapping on a small phone.
   * @param context - Story interaction context.
   */
  play: async ({ canvas, userEvent }) => {
    await expect(window.innerWidth).toBeLessThanOrEqual(400);
    const parts = canvas.getByRole("group", { name: "Compatible parts" });
    const queries = within(parts);
    await userEvent.click(queries.getByRole("checkbox", { name: "Pen clips" }));
    const input = queries.getByRole("combobox", { name: "Pen clips" });
    await userEvent.click(input);
    await userEvent.type(input, "Machined");
    await userEvent.keyboard("{ArrowDown}{Enter}");
    await expect(
      queries.getAllByRole("button", { name: "Remove Machined Clip" }),
    ).toHaveLength(2);
    await expect(parts.getBoundingClientRect().right).toBeLessThanOrEqual(
      window.innerWidth,
    );
    await expect(parts.scrollWidth).toBeLessThanOrEqual(parts.clientWidth);
  },
};
