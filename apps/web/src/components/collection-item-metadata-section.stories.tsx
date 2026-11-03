import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, fn, mocked, userEvent, within } from "storybook/test";
import { getPublicCollectionItem } from "@/lib/catalog-api";
import { StoryProviders } from "../../.storybook/story-fixtures";
import { CollectionItemMetadataSection } from "./collection-item-metadata-section";

/** Owner and public metadata detail states with application providers. */
const meta = {
  component: CollectionItemMetadataSection,
  title: "Components/CollectionItemMetadataSection",
  args: {
    isOwner: true,
    statuses: { public: ["favorite"], private: ["favorite", "grail"] },
    identity: { collectionId: 1000, collectionItemId: 1001, userId: 1000 },
    renderPublicVersion: fn(() => null),
  },
  decorators: [
    (Story) => (
      <StoryProviders>
        <Story />
      </StoryProviders>
    ),
  ],
} satisfies Meta<typeof CollectionItemMetadataSection>;
export default meta;
/** Metadata detail story contract. */
type Story = StoryObj<typeof meta>;
/** Owners see one scope at a time and duplicates stay in Public. */
export const OwnerScopes: Story = {
  /** Checks visibility of each scope's status labels.
   * @param context - Story canvas.
   */
  play: async (context) => {
    const { canvasElement } = context;
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Favorite")).toBeVisible();
    await expect(canvas.queryByText("Grail")).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: /^Private$/ }));
    await expect(canvas.getByText("Grail")).toBeVisible();
    await expect(canvas.queryByText("Favorite")).not.toBeInTheDocument();
  },
};
/** A hidden item has no anonymous public presentation; modal dismissal restores focus. */
export const PublicPreviewUnavailable: Story = {
  /** Keeps preview traffic at the mocked server boundary. */
  beforeEach: () => {
    mocked(getPublicCollectionItem).mockResolvedValue(null);
  },
  /** Exercises anonymous lookup, keyboard dismissal, and trigger focus.
   * @param context - Story canvas.
   */
  play: async (context) => {
    const { canvasElement } = context;
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: "View public version" });
    await userEvent.click(trigger);
    const modal = await canvas.findByRole("dialog", { name: "Public version" });
    await expect(modal).toBeVisible();
    await expect(
      within(modal).queryByRole("button", { name: /^Private$/ }),
    ).not.toBeInTheDocument();
    await expect(getPublicCollectionItem).toHaveBeenCalledWith({
      data: {
        collectionId: 1000,
        collectionItemId: 1001,
        userId: 1000,
        publicVersion: true,
      },
    });
    await userEvent.keyboard("{Escape}");
    await expect(modal).not.toBeVisible();
    await expect(trigger).toHaveFocus();
  },
};
/** Another viewer receives no scope or preview controls. */
export const PublicViewer: Story = {
  args: { isOwner: false, statuses: { public: ["favorite"], private: [] } },
};

/** A public paid price remains visible even when there are no status assignments. */
export const PublicPaidPrice: Story = {
  args: {
    isOwner: false,
    statuses: { public: [], private: [] },
    pricePaid: { amountMinor: 0, currencyCode: "JPY", isPublic: true },
  },
  /**
   * Checks zero-decimal JPY formatting and empty-status metadata visibility.
   * @param context - Story canvas.
   */
  play: async (context) => {
    await expect(context.canvas.getByText("Price paid")).toBeVisible();
    await expect(context.canvas.getByText("¥0")).toBeVisible();
  },
};
