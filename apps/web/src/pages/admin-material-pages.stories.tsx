import type { AdminMaterial } from "@package/services";
import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, userEvent, within } from "storybook/test";
import { mockStoryRole, StoryProviders } from "../../.storybook/story-fixtures";
import {
  AdminMaterialFormPage,
  AdminMaterialsPage,
} from "./admin-material-pages";

/** Representative material with active and archived images. */
const carbonFiber: AdminMaterial = {
  specifics: [],
  description: "A woven carbon composite.",
  id: 1,
  images: [
    {
      contentType: "image/webp",
      createdAt: new Date("2026-10-01T12:00:00Z"),
      deletedAt: null,
      deletedByClerkId: null,
      deletedByRole: null,
      fileName: "carbon-fiber.webp",
      id: 11,
      objectPath: "images/materials/1/carbon-fiber.webp",
      position: 0,
      size: 1024,
      url: "https://placehold.co/640x480/webp?text=Carbon+Fiber",
    },
    {
      contentType: "image/webp",
      createdAt: new Date("2026-10-01T12:05:00Z"),
      deletedAt: new Date("2026-10-02T12:00:00Z"),
      deletedByClerkId: "story-user",
      deletedByRole: "admin",
      fileName: "carbon-weave.webp",
      id: 12,
      objectPath: "images/materials/1/carbon-weave.webp",
      position: 1,
      size: 2048,
      url: "https://placehold.co/640x480/webp?text=Carbon+Weave",
    },
  ],
  name: "Carbon Fiber",
  slug: "carbon-fiber",
};

/** Material administration story configuration. */
const meta = {
  /**
   * Configures product-administrator authorization.
   *
   * @returns Nothing.
   */
  beforeEach: () => mockStoryRole("admin"),
  component: AdminMaterialsPage,
  decorators: [
    (Story) => (
      <StoryProviders>
        <Story />
      </StoryProviders>
    ),
  ],
  parameters: { layout: "fullscreen" },
  title: "Pages/AdminMaterials",
} satisfies Meta<typeof AdminMaterialsPage>;

export default meta;
/** A material administration story. */
type Story = StoryObj<typeof meta>;

/** Populated material administration list. */
export const Directory: Story = {
  args: { materials: [carbonFiber] },
  /**
   * Verifies the primary list actions.
   *
   * @param root0 - Story interaction context.
   * @param root0.canvas - Rendered story canvas.
   * @returns A promise that resolves after the assertions complete.
   */
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("link", { name: "Add material" }),
    ).toHaveAttribute("href", "/admin/materials/add");
    const item = within(canvas.getByRole("listitem"));
    await expect(item.getByText("Carbon Fiber")).toBeVisible();
    await expect(item.getByRole("link", { name: "Edit" })).toHaveAttribute(
      "href",
      "/admin/materials/1/edit",
    );
  },
};

/** Empty material administration list. */
export const Empty: Story = {
  args: { materials: [] },
  /**
   * Verifies the localized empty state.
   *
   * @param root0 - Story interaction context.
   * @param root0.canvas - Rendered story canvas.
   * @returns A promise that resolves after the assertion completes.
   */
  play: async ({ canvas }) => {
    await expect(canvas.getByText("No materials found.")).toBeVisible();
  },
};

/** New-material editor. */
export const Add: Story = {
  args: { materials: [] },
  /**
   * Renders the new-material editor.
   *
   * @returns The new-material editor.
   */
  render: () => <AdminMaterialFormPage />,
  /**
   * Verifies the create form's core fields.
   *
   * @param root0 - Story interaction context.
   * @param root0.canvas - Rendered story canvas.
   * @returns A promise that resolves after the assertions complete.
   */
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("textbox", { name: "Name" })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Save" })).toBeDisabled();
  },
};

/** Existing-material editor with active and archived images. */
export const Edit: Story = {
  args: { materials: [] },
  /**
   * Renders the existing-material editor.
   *
   * @returns The existing-material editor.
   */
  render: () => <AdminMaterialFormPage initialMaterial={carbonFiber} />,
  /**
   * Verifies stable slug and image lifecycle controls.
   *
   * @param root0 - Story interaction context.
   * @param root0.canvas - Rendered story canvas.
   * @returns A promise that resolves after the assertions complete.
   */
  play: async ({ canvas }) => {
    await expect(canvas.getByDisplayValue("carbon-fiber")).toHaveAttribute(
      "readonly",
    );
    await expect(
      canvas.getByRole("button", { name: "Delete image" }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: "Restore image" }),
    ).toBeVisible();
  },
};

/** Scoped gallery and specific editing retain their general-material context. */
export const Specifics: Story = {
  args: { materials: [] },
  /**
   * Renders the scoped material editor.
   * @returns An editor with general and grade-scoped images.
   */
  render: () => (
    <AdminMaterialFormPage
      initialMaterial={{
        ...carbonFiber,
        specifics: [
          {
            id: 21,
            materialId: 1,
            name: "Woven",
            slug: "woven",
            description: null,
          },
        ],
        images: carbonFiber.images.map((image) => ({
          ...image,
          materialSpecificId: image.id === 12 ? 21 : null,
        })),
      }}
    />
  ),
  /**
   * Checks slug access and the add-specific editor's immutable context.
   * @param root0 - Story interaction context.
   * @param root0.canvas - Rendered story canvas.
   * @returns Completion after scoped editor assertions.
   */
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("checkbox", { name: "Update slug" }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("heading", { name: "General" }),
    ).toBeVisible();
    await expect(canvas.getByRole("heading", { name: "Woven" })).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Add alloy or grade" }),
    );
    await expect(
      canvas.getByRole("textbox", { name: "Alloy or grade name" }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("textbox", { name: "Materials" }),
    ).toHaveAttribute("readonly");
  },
};
