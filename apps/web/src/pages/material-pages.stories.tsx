import type { PublicMaterial } from "@package/services";
import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";
import { mockStoryAuth, StoryProviders } from "../../.storybook/story-fixtures";
import {
  MaterialDetailPage,
  MaterialResultPage,
  MaterialsPage,
} from "./material-pages";

/** Public material fixture shared by directory and detail stories. */
const aluminum: PublicMaterial = {
  specific: null,
  specifics: [],
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

/** Exact-specific context on the shared material detail page, with empty states. */
export const EmptySpecific: Story = {
  /**
   * Renders a directly accessible empty alloy or grade.
   *
   * @returns Shared detail layout in exact-specific context.
   */
  render: () => (
    <MaterialDetailPage
      material={{
        ...aluminum,
        productCount: 0,
        collectionItemCount: 0,
        specific: {
          id: 2000,
          materialId: aluminum.id,
          name: "Aluminum 6061",
          slug: "6061",
          description: null,
        },
      }}
      productsPage={1}
      collectionItemsPage={1}
      onProductsPageChange={fn()}
      onCollectionItemsPageChange={fn()}
    />
  ),
  /**
   * Verifies specific breadcrumbs and independent empty relations.
   *
   * @param context - Rendered story context.
   * @param context.canvasElement - Accessible story canvas.
   */
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Aluminum 6061")).toBeVisible();
    await expect(
      canvas.getByRole("link", { name: "Aluminum" }),
    ).toHaveAttribute("href", expect.stringContaining("/materials/aluminum"));
    await expect(
      canvas.getByText("No products use this alloy or grade yet."),
    ).toBeVisible();
    await expect(
      canvas.getByText("No collection items use this alloy or grade yet."),
    ).toBeVisible();
    await expect(
      canvas.getByText("No images have been added for this alloy or grade."),
    ).toBeVisible();
  },
};

/**
 * Renders two controlled material relation lists for pagination interactions.
 *
 * @returns Independent product and collection-item pagination in the browser.
 */
function IndependentPaginationFixture() {
  const [productsPage, setProductsPage] = useState(1);
  const [collectionItemsPage, setCollectionItemsPage] = useState(2);
  const items = Array.from({ length: 41 }, (_, index) => index + 1);
  return (
    <main className="grid gap-6 p-4">
      <h1>Material pagination</h1>
      <section aria-label="Product results">
        <MaterialResultPage
          ariaLabel="Product pages"
          items={items}
          requestedPage={productsPage}
          onPageChange={setProductsPage}
        >
          {(page) => (
            <ul>
              {page.map((id) => (
                <li key={id}>{id}</li>
              ))}
            </ul>
          )}
        </MaterialResultPage>
      </section>
      <section aria-label="Collection results">
        <MaterialResultPage
          ariaLabel="Collection pages"
          items={items}
          requestedPage={collectionItemsPage}
          onPageChange={setCollectionItemsPage}
        >
          {(page) => (
            <ul>
              {page.map((id) => (
                <li key={id}>{id}</li>
              ))}
            </ul>
          )}
        </MaterialResultPage>
      </section>
    </main>
  );
}

/** Both relation lists retain their page when the other pager changes. */
export const IndependentPagination: Story = {
  render: IndependentPaginationFixture,
  /**
   * Advances each pager separately and verifies the other list is unchanged.
   *
   * @param context - Rendered story context.
   * @param context.canvasElement - Accessible story canvas.
   */
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const products = within(
      canvas.getByRole("region", { name: "Product results" }),
    );
    const collections = within(
      canvas.getByRole("region", { name: "Collection results" }),
    );
    const initialCollections = collections.getByRole("status").textContent;
    const initialCollectionItems = collections.getByRole("list").textContent;
    const initialProductItems = products.getByRole("list").textContent;
    await userEvent.click(products.getByRole("button", { name: "Next page" }));
    await expect(products.getByRole("status")).toHaveTextContent("Page 2");
    await expect(products.getByRole("list")).not.toHaveTextContent(
      initialProductItems ?? "",
    );
    await expect(collections.getByRole("list")).toHaveTextContent(
      initialCollectionItems ?? "",
    );
    await expect(collections.getByRole("status")).toHaveTextContent(
      initialCollections ?? "",
    );
    await userEvent.click(
      collections.getByRole("button", { name: "Next page" }),
    );
    await expect(collections.getByRole("status")).toHaveTextContent("Page 3");
    await expect(collections.getByRole("list")).not.toHaveTextContent(
      initialCollectionItems ?? "",
    );
    await expect(products.getByRole("status")).toHaveTextContent("Page 2");
  },
};
