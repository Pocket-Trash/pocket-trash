import type { PublicMaterial } from "@package/services";
import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, fn, within } from "storybook/test";
import { mockStoryAuth, StoryProviders } from "../../.storybook/story-fixtures";
import { MaterialDetailPage, MaterialsPage } from "./material-pages";

/** Public material fixture shared by directory and detail stories. */
const aluminum: PublicMaterial = {
  collectionItemCount: 12,
  collectionItems: [],
  description:
    "Aluminum is a **lightweight metal** commonly used for responsive designs.",
  id: 1000,
  images: [],
  leadImage: null,
  name: "Aluminum",
  productCount: 8,
  products: [],
  slug: "aluminum",
};

/** Material page Storybook configuration. */
const meta = {
  beforeEach: mockStoryAuth,
  decorators: [
    (Story) => (
      <StoryProviders>
        <Story />
      </StoryProviders>
    ),
  ],
  parameters: { layout: "fullscreen" },
  title: "Pages/Materials",
} satisfies Meta;

export default meta;
/** Material page story. */
type Story = StoryObj<typeof meta>;

/** Directory with A-Z, Other, popular ranking, and image-placeholder states. */
export const Directory: Story = {
  /**
   * Renders the populated materials directory story.
   *
   * @returns The populated materials directory story.
   */
  render: () => (
    <MaterialsPage
      materials={[
        aluminum,
        {
          ...aluminum,
          collectionItemCount: 27,
          id: 1001,
          name: "Titanium",
          productCount: 19,
          slug: "titanium",
        },
        {
          ...aluminum,
          collectionItemCount: 2,
          id: 1002,
          name: "# Resin",
          productCount: 1,
          slug: "resin",
        },
      ]}
    />
  ),
  /**
   * Verifies the populated materials directory story.
   *
   * @param context - Story play context.
   * @param context.canvasElement - Rendered story canvas.
   */
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("heading", { name: "Popular Materials" }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("navigation", { name: "Materials A to Z" }),
    ).toBeVisible();
    await expect(
      canvas.getAllByText("No image available for Aluminum")[0],
    ).toBeVisible();
  },
};

/** Empty directory state. */
export const EmptyDirectory: Story = {
  /**
   * Renders the empty materials directory story.
   *
   * @returns The empty materials directory story.
   */
  render: () => <MaterialsPage materials={[]} />,
  /**
   * Verifies the empty materials directory story.
   *
   * @param context - Story play context.
   * @param context.canvasElement - Rendered story canvas.
   */
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText("No materials are available yet."),
    ).toBeVisible();
  },
};

/** Detail content with empty product and collection-item relation states. */
export const DetailWithEmptyRelations: Story = {
  /**
   * Renders the material detail story with empty relations.
   *
   * @returns The material detail story with empty relations.
   */
  render: () => (
    <MaterialDetailPage
      collectionItemsPage={1}
      material={aluminum}
      onCollectionItemsPageChange={fn()}
      onProductsPageChange={fn()}
      productsPage={1}
    />
  ),
  /**
   * Verifies the material detail story with empty relations.
   *
   * @param context - Story play context.
   * @param context.canvasElement - Rendered story canvas.
   */
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText("No products use this material yet."),
    ).toBeVisible();
    await expect(
      canvas.getByText("No collection items use this material yet."),
    ).toBeVisible();
  },
};
