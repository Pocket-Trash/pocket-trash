import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect } from "storybook/test";
import { StoryProviders } from "../../.storybook/story-fixtures";
import { ResourceCard, type ResourceCardItem } from "./resource-card";

/**
 * Public single-file resource shared by the card stories.
 */
const resource = {
  canEdit: false,
  categories: [{ id: 1, name: "3D printing", slug: "3d-printing" }],
  coverImageUrl:
    "https://cdn.pocket-trash.app/assets/resosurces.webp?width=640",
  createdAt: new Date("2026-09-16T12:00:00Z"),
  currentVersion: {
    fileCount: 1,
    fileId: 10,
    fileName: "spinner.stl",
    id: 20,
    version: 1,
  },
  downloadCount: 24,
  id: 1000,
  isPrivate: false,
  name: "Spinner model",
  privateReason: null,
  uploaderUsername: "roy",
} satisfies ResourceCardItem;

/**
 * Configures Storybook coverage for the resource card examples.
 */
const meta = {
  args: { resource },
  component: ResourceCard,
  decorators: [
    (Story) => (
      <StoryProviders>
        <div className="w-80">
          <Story />
        </div>
      </StoryProviders>
    ),
  ],
  title: "Components/ResourceCard",
} satisfies Meta<typeof ResourceCard>;

export default meta;
/**
 * Storybook story contract for the resource card examples.
 */
type Story = StoryObj<typeof meta>;

/**
 * Defines the directory resource card story.
 */
export const Directory: Story = {
  /**
   * Exercises the resource card story interaction and assertions.
   *
   * @param context - Storybook interaction context.
   * @param context.canvas - Queries scoped to the rendered story canvas.
   * @returns A promise that resolves after the story assertions complete.
   * @rejects When a Storybook interaction or assertion fails.
   */
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("heading", { name: "Spinner model" }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: "Download" }),
    ).toBeVisible();
  },
};

/**
 * Defines the editable resource card story.
 */
export const Editable: Story = {
  args: { resource: { ...resource, canEdit: true } },
};

/**
 * Defines the multi file resource card story.
 */
export const MultiFile: Story = {
  args: {
    resource: {
      ...resource,
      currentVersion: { ...resource.currentVersion, fileCount: 2 },
    },
  },
  /**
   * Exercises the resource card story interaction and assertions.
   *
   * @param context - Storybook interaction context.
   * @param context.canvas - Queries scoped to the rendered story canvas.
   * @returns A promise that resolves after the story assertions complete.
   * @rejects When a Storybook interaction or assertion fails.
   */
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("button", { name: "Download" }),
    ).toBeVisible();
  },
};

/**
 * Defines the private without cover resource card story.
 */
export const PrivateWithoutCover: Story = {
  args: {
    resource: {
      ...resource,
      coverImageUrl: null,
      currentVersion: { ...resource.currentVersion, fileName: "guide.pdf" },
      isPrivate: true,
      privateReason: "Needs review",
    },
  },
};

/**
 * Defines the owned resource card story.
 */
export const Owned: Story = {
  args: { mode: "owned" },
};
