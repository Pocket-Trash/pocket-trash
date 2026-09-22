import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect } from "storybook/test";
import { StoryProviders } from "../../.storybook/story-fixtures";
import { ResourceCard, type ResourceCardItem } from "./resource-card";

const resource = {
  canEdit: false,
  categories: [{ id: 1, name: "3D printing", slug: "3d-printing" }],
  coverImageUrl: "/images/navigation/resources.webp",
  createdAt: new Date("2026-09-16T12:00:00Z"),
  currentVersion: { fileId: 10, fileName: "spinner.stl", id: 20 },
  downloadCount: 24,
  id: 1000,
  isPrivate: false,
  name: "Spinner model",
  privateReason: null,
  uploaderClerkId: "user_123",
} satisfies ResourceCardItem;

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
type Story = StoryObj<typeof meta>;

export const Directory: Story = {
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("heading", { name: "Spinner model" }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: "Download" }),
    ).toBeVisible();
  },
};

export const Editable: Story = {
  args: { resource: { ...resource, canEdit: true } },
};

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

export const Owned: Story = {
  args: { mode: "owned" },
};
