import type {
  CatalogImage,
  CatalogProduct,
  CatalogProductTypeSummary,
  PublicCollectionOwner,
  PublicMakerDetail,
  UserCollectionItem,
  UserCollectionSummary,
} from "@package/services";
import { formatTranslation } from "@pocket-trash/localizations";
import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { getHelpDocument } from "@/lib/help-content";
import { mockStoryAuth, StoryProviders } from "../../.storybook/story-fixtures";
import {
  CatalogApprovalControls,
  CollectionItemDetailPage,
  CollectionPage,
  HomePage,
  ProductDetailPage,
  ProductsPage,
  PublicCollectionPage,
  PublicCollectionsPage,
  UserCollectionsPage,
} from "./catalog-pages";
import { HelpIndexPage, HelpTopicPage } from "./help-pages";
import { MakerDetailPage } from "./maker-detail-page";
import { UserIndexPage } from "./user-index-page";

/** Product image used by catalog page stories. */
const productImage = image(1000, "one.webp", "product-images/one.webp");
/** Collection image used by catalog page stories. */
const collectionImage = image(
  1001,
  "thirteen.webp",
  "collection-images/thirteen.webp",
);

/** Catalog product shared by the stories. */
const product: CatalogProduct = {
  approvalStatus: "approved",
  bearing: "R188 hybrid ceramic",
  buttonDiameter: null,
  clickCount: null,
  canAdminister: false,
  canEdit: false,
  compatibleButtonId: null,
  compatibleButtonName: null,
  createdAt: new Date("2026-01-01"),
  description: "A **compact** spinner.",
  diameter: { unit: "mm", value: "50.8" },
  finishOptions: [
    {
      colorEffect: null,
      colors: [{ hex: "#2563eb", id: 1000, name: "Blue", slug: "blue" }],
      finishes: [{ id: 1000, name: "Anodized", slug: "anodized" }],
      id: 1000,
      pattern: null,
    },
  ],
  id: 1000,
  imageCount: 1,
  images: [productImage],
  includedInsert: null,
  includedPlate: null,
  isAdminPrivate: false,
  isPrivate: false,
  length: null,
  makerId: 1000,
  makerName: "KAP EDC",
  makerSlug: "kap-edc",
  makerProductUrl: "https://www.kapedc.com/products/katla",
  makerProductUrlValid: true,
  makerUrl: "https://www.kapedc.com",
  magnetLayout: null,
  usesInserts: null,
  materials: [
    {
      assignmentId: 1000,
      specific: null,
      id: 1000,
      name: "Titanium",
      slug: "titanium",
    },
  ],
  name: "Katla",
  ownerClerkId: "user_storybook",
  productTypeId: 1000,
  productTypeName: "Spinner",
  productTypeSlug: "spinner",
  slug: "katla",
  spinDiameter: { unit: "mm", value: "55" },
  thickness: { unit: "mm", value: "12.7" },
  thicknessWithButton: null,
  updatedAt: new Date("2026-01-02"),
  weight: { unit: "g", value: "90" },
  width: null,
};

/** Slider catalog fixture covering capability and reviewed relationships. */
const slider: CatalogProduct = {
  ...product,
  bearing: null,
  buttonDiameter: null,
  clickCount: 3,
  diameter: null,
  id: 2000,
  includedInsert: null,
  includedPlate: {
    id: 2200,
    name: "Matched plates",
    productTypeSlug: "slider-plate",
    slug: "matched-plates",
  },
  length: { unit: "mm", value: "52" },
  magnetLayout: "2x4",
  usesInserts: false,
  name: "Rail Slider",
  productTypeId: 2000,
  productTypeName: "Slider",
  productTypeSlug: "slider",
  slug: "rail-slider",
  spinDiameter: null,
  thickness: { unit: "mm", value: "12" },
  weight: { unit: "g", value: "96" },
  width: { unit: "mm", value: "24" },
};

/** User collection shared by the stories. */
const collection: UserCollectionSummary = {
  coverImage: collectionImage,
  coverImages: [collectionImage],
  createdAt: new Date("2026-01-01"),
  description: "Everyday carry spinners and buttons.",
  id: 1000,
  isAdminPrivate: false,
  isPrivate: false,
  itemCount: 1,
  name: "Daily Carry",
  ownerUserId: 1000,
  updatedAt: new Date("2026-01-02"),
};

/** Collection item shared by the stories. */
const item: UserCollectionItem = {
  approvalStatus: "approved",
  bearing: "R188 full ceramic",
  bearingOverride: "R188 full ceramic",
  canAdminister: false,
  canEdit: false,
  collectionId: collection.id,
  collectionIsPrivate: false,
  collectionItemId: 1000,
  collectionName: collection.name,
  compatibleButtonId: null,
  compatibleButtonName: null,
  displayName: "My Katla",
  description: "My **daily carry** spinner.",
  descriptionOverride: "My **daily carry** spinner.",
  finishOption: product.finishOptions[0] ?? null,
  effectiveSliderSetup: null,
  imageCount: 1,
  images: [collectionImage],
  installedButtonId: 1001,
  installedInsertId: null,
  installedOnSliderId: null,
  installedPlateId: null,
  includedInsert: null,
  includedPlate: null,
  isAdminPrivate: false,
  isPrivate: false,
  makerId: product.makerId,
  makerName: product.makerName,
  makerSlug: product.makerSlug,
  makerUrl: product.makerUrl,
  material: product.materials[0] ?? null,
  name: product.name,
  ownerClerkId: "user_storybook",
  ownerImageUrl: null,
  ownerUsername: "royanger",
  ownerUserId: collection.ownerUserId,
  productId: product.id,
  productSlug: product.slug,
  productImages: product.images,
  productTypeName: product.productTypeName,
  productTypeSlug: "spinner",
  sourceProductFinishOptionId: product.finishOptions[0]?.id ?? null,
};

/** Installed spinner button used by the detail story. */
const installedButton: UserCollectionItem = {
  ...item,
  collectionItemId: 1001,
  displayName: "Purple Katla Button",
  installedButtonId: null,
  name: "Katla SC Button",
  productId: 1001,
  productSlug: "katla-sc-button",
  productTypeName: "Spinner Button",
  productTypeSlug: "spinner-button",
};

/** Public collection owner shared by the stories. */
const owner: PublicCollectionOwner = {
  imageUrl: null,
  collections: [collection],
  itemCount: 1,
  items: [item],
  userId: collection.ownerUserId,
  username: "royanger",
};

/** Public maker detail shared by the story. */
const maker: PublicMakerDetail = {
  collectionItems: [item],
  description: "KAP EDC makes **precision-machined** everyday carry products.",
  id: product.makerId,
  images: [productImage],
  name: product.makerName,
  products: [product],
  rootUrl: product.makerUrl,
  slug: product.makerSlug,
};

/** Image guide document rendered by the help topic story. */
const imageGuide = getHelpDocument("en-US", "image-size-and-resolution-guide");
if (!imageGuide) throw new Error("The image guide story fixture is missing.");

/** Catalog page Storybook configuration. */
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
  title: "Pages",
} satisfies Meta;

export default meta;
/** A catalog page story. */
type Story = StoryObj<typeof meta>;

/** Public maker detail page story. */
export const MakerDetail: Story = {
  /**
   * Renders the public maker detail story.
   *
   * @returns A maker profile with related catalog content.
   */
  render: () => (
    <MakerDetailPage
      collectionItemsPage={0}
      maker={maker}
      onCollectionItemsPageChange={fn()}
      onProductsPageChange={fn()}
      productsPage={0}
    />
  ),
};

/** Collection page story. */
export const Collection: Story = {
  /**
   * Renders the collection page story.
   * @returns A collection page fixture.
   */
  render: () => (
    <CollectionPage
      collection={collection}
      items={[item]}
      onFiltersChange={fn()}
      ownerImageUrl={
        new URL("/images/tmp/7887468134587-1.jpg", window.location.origin).href
      }
      ownerUsername={owner.username}
    />
  ),
  /**
   * Verifies the picture is in the details card and breadcrumbs remain text-only.
   *
   * @param context - Story canvas.
   * @param context.canvasElement - Rendered story container.
   * @returns Completion after avatar placement assertions.
   */
  play: async ({ canvasElement }) => {
    const heading = within(canvasElement).getByRole("heading", {
      name: collection.name,
      level: 2,
    });
    await waitFor(() =>
      expect(heading.parentElement?.querySelector("img")).toBeVisible(),
    );
    expect(
      heading.parentElement?.querySelector('[data-slot="avatar"]'),
    ).toHaveAttribute("data-size", "lg");
    expect(
      canvasElement.querySelector('header nav [data-slot="avatar"]'),
    ).toBeNull();
  },
};

/** Collection item page story. */
export const CollectionItem: Story = {
  /**
   * Renders the collection item story.
   * @returns A collection item fixture.
   */
  render: () => (
    <CollectionItemDetailPage installedButton={installedButton} item={item} />
  ),
};

/** Standalone body-hosted slider item with live read-only catalog setup. */
export const StandaloneSliderCollectionItem: Story = {
  /**
   * Renders the standalone slider collection-item story.
   * @returns A slider item and its live catalog facts.
   */
  render: () => (
    <CollectionItemDetailPage
      item={{
        ...item,
        bearing: null,
        bearingOverride: null,
        displayName: "My Rail Slider",
        installedButtonId: null,
        name: slider.name,
        productId: slider.id,
        productSlug: slider.slug,
        productTypeName: slider.productTypeName,
        productTypeSlug: "slider",
      }}
      product={slider}
    />
  ),
};

/** Home page story. */
export const Home: Story = {
  /**
   * Renders the home page story.
   * @returns The home page.
   */
  render: () => <HomePage />,
};

/** Help index page story. */
export const Help: Story = {
  /**
   * Renders the help index story.
   * @returns Every published help topic.
   */
  render: () => (
    <HelpIndexPage
      documents={[
        "how-to-use-markdown",
        "image-size-and-resolution-guide",
      ].flatMap((slug) => {
        const document = getHelpDocument("en-US", slug);
        return document ? [document] : [];
      })}
    />
  ),
};

/** Help topic page story. */
export const HelpTopic: Story = {
  /**
   * Renders the help topic story.
   * @returns The image guide fixture.
   */
  render: () => (
    <HelpTopicPage
      dateLabel={formatTranslation("web.help.datePublished")}
      dateModifiedLabel={formatTranslation("web.help.dateModified")}
      document={imageGuide}
      helpTitle={formatTranslation("web.navigation.help")}
    />
  ),
};

/** Product detail page story. */
export const ProductDetail: Story = {
  /**
   * Renders the product detail story.
   * @returns A product detail fixture.
   */
  render: () => (
    <ProductDetailPage collectionItems={[item]} product={product} />
  ),
};

/** Slider product detail with explicit capability and reviewed relationships. */
export const SliderProductDetail: Story = {
  /**
   * Renders the slider detail story.
   * @returns A slider catalog detail fixture.
   */
  render: () => <ProductDetailPage product={slider} />,
};

/** Approval-decision spy returning the approved state for story interactions. */
const decideApproval = fn(async () => "approved" as const);

/** Product approval state and interaction story. */
export const ProductApproval: Story = {
  /**
   * Exercises each approval state and one successful decision.
   *
   * @param root0 - Storybook play context.
   * @param root0.canvasElement - Rendered story root element.
   */
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(
      canvas.getAllByLabelText("Decision reason")[0] as HTMLTextAreaElement,
      "Ready for the catalog",
    );
    await userEvent.click(
      canvas.getByRole("button", { name: "Approve product" }),
    );
    await expect(decideApproval).toHaveBeenCalledWith({
      action: "approve",
      reason: "Ready for the catalog",
    });
  },
  /**
   * Renders every approval state.
   * @returns Product approval controls for visual review.
   */
  render: () => (
    <main className="grid max-w-3xl gap-6 p-6">
      <CatalogApprovalControls
        initialStatus="pending"
        onDecide={decideApproval}
      />
      <CatalogApprovalControls
        initialStatus="approved"
        onDecide={async () => "pending"}
      />
      <CatalogApprovalControls
        initialStatus="rejected"
        onDecide={async () => "pending"}
      />
    </main>
  ),
};

/** Collection-item approval states, validation, reversal, and failure recovery. */
export const CollectionItemApproval: Story = {
  /**
   * Exercises required reasons, rejection, reversal, and a failed decision.
   *
   * @param root0 - Storybook play context.
   * @param root0.canvasElement - Rendered story root element.
   */
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const groups = canvas.getAllByRole("group", {
      name: "Collection item approval",
    });
    const pending = within(groups[0] as HTMLElement);
    await expect(
      pending.getByRole("button", { name: "Approve collection item" }),
    ).toBeDisabled();
    await userEvent.type(pending.getByLabelText("Decision reason"), "   ");
    await expect(
      pending.getByRole("button", { name: "Reject collection item" }),
    ).toBeDisabled();
    await userEvent.type(
      pending.getByLabelText("Decision reason"),
      "Needs changes",
    );
    await userEvent.click(
      pending.getByRole("button", { name: "Reject collection item" }),
    );
    await expect(pending.getByText("Rejected")).toBeVisible();
    await expect(pending.getByLabelText("Decision reason")).toHaveValue("");

    for (const group of groups.slice(1, 3)) {
      const decided = within(group);
      await userEvent.type(
        decided.getByLabelText("Decision reason"),
        "Review again",
      );
      await userEvent.click(
        decided.getByRole("button", { name: "Return to pending" }),
      );
      await expect(decided.getByText("Pending review")).toBeVisible();
    }
    const failure = within(groups[3] as HTMLElement);
    await userEvent.type(failure.getByLabelText("Decision reason"), "Ready");
    await userEvent.click(
      failure.getByRole("button", { name: "Approve collection item" }),
    );
    await expect(failure.getByRole("alert")).toBeVisible();
    await expect(failure.getByText("Pending review")).toBeVisible();
    await expect(failure.getByLabelText("Decision reason")).toHaveValue(
      "Ready",
    );
    await expect(
      failure.getByRole("button", { name: "Approve collection item" }),
    ).toBeEnabled();
  },
  /**
   * Renders collection-item approval states and a persistence failure.
   *
   * @returns Collection-item review controls for visual and accessibility checks.
   */
  render: () => (
    <main className="grid max-w-3xl gap-6 p-6">
      <CatalogApprovalControls
        target="collectionItem"
        initialStatus="pending"
        onDecide={async () => "rejected"}
      />
      <CatalogApprovalControls
        target="collectionItem"
        initialStatus="approved"
        onDecide={async () => "pending"}
      />
      <CatalogApprovalControls
        target="collectionItem"
        initialStatus="rejected"
        onDecide={async () => "pending"}
      />
      <CatalogApprovalControls
        target="collectionItem"
        initialStatus="pending"
        onDecide={async () => {
          throw new Error("Persistence failed");
        }}
      />
    </main>
  ),
};

/** Pending collection item retained in its owner's collection. */
export const PendingCollectionItem: Story = {
  /**
   * Renders the owner-facing review state without administrative controls.
   *
   * @returns A pending collection item detail page.
   */
  render: () => (
    <CollectionItemDetailPage
      item={{
        ...item,
        approvalStatus: "pending",
        canEdit: true,
        isOwner: true,
      }}
    />
  ),
};

/** Product index page story. */
export const Products: Story = {
  /**
   * Verifies that only the current responsive product page is rendered.
   *
   * @param root0 - Story interaction context.
   */
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("heading", { name: "Product 12" }),
    ).toBeVisible();
    await expect(
      canvas.queryByRole("heading", { name: "Product 13" }),
    ).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Next page" }));
    await expect(
      canvas.getByRole("heading", { name: "Product 13" }),
    ).toBeVisible();
    await expect(canvas.getByText("Page 2 of 2")).toBeVisible();
  },
  /**
   * Renders the product index story.
   * @returns The product index fixture.
   */
  render: () => (
    <ProductsPage
      onFiltersChange={fn()}
      products={Array.from({ length: 21 }, (_, index) => ({
        ...product,
        id: index + 1,
        name: `Product ${index + 1}`,
        slug: `product-${index + 1}`,
      }))}
    />
  ),
};

/** Product-type directory with primary and accessory groups. */
export const ProductDirectory: Story = {
  /**
   * Verifies the directory destinations and group ordering.
   *
   * @param context - Story interaction context.
   * @returns A promise that resolves after the assertions complete.
   */
  play: async ({ canvas }) => {
    const links = within(canvas.getByRole("main")).getAllByRole("link");
    await expect(links[0]).toHaveAttribute("href", "/products?view=all");
    await expect(links[1]).toHaveAttribute(
      "href",
      "/products?type=slider&view=all",
    );
    await expect(links[3]).toHaveAttribute(
      "href",
      "/products?type=slider-plate&view=all",
    );
  },
  /**
   * Renders the product-type directory fixture.
   *
   * @returns The product-type directory fixture.
   */
  render: () => {
    const productTypes: CatalogProductTypeSummary[] = [
      {
        id: 1,
        isPartOrAccessory: false,
        name: "Spinner",
        slug: "spinner",
      },
      {
        id: 2,
        isPartOrAccessory: false,
        name: "Slider",
        slug: "slider",
      },
      {
        id: 3,
        isPartOrAccessory: true,
        name: "Slider Plate",
        slug: "slider-plate",
      },
    ];
    return (
      <ProductsPage
        productTypes={productTypes}
        products={productTypes.map((type, index) => ({
          ...product,
          id: index + 1,
          name: type.name,
          productTypeId: type.id,
          productTypeName: type.name,
          productTypeSlug: type.slug as CatalogProduct["productTypeSlug"],
          slug: type.slug,
        }))}
        view="directory"
      />
    );
  },
};

/** Public collection page story. */
export const PublicCollection: Story = {
  /**
   * Renders the public collection story.
   * @returns A public collection fixture.
   */
  render: () => <PublicCollectionPage owner={owner} />,
};

/** Public collections page story. */
export const PublicCollections: Story = {
  /**
   * Verifies that public collection cards use responsive pagination.
   *
   * @param root0 - Story interaction context.
   */
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("heading", { name: "Collection 12" }),
    ).toBeVisible();
    await expect(
      canvas.queryByRole("heading", { name: "Collection 13" }),
    ).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Next page" }));
    await expect(
      canvas.getByRole("heading", { name: "Collection 13" }),
    ).toBeVisible();
  },
  /**
   * Renders the public collections story.
   * @returns Public collection fixtures.
   */
  render: () => (
    <PublicCollectionsPage
      onFiltersChange={fn()}
      owners={[
        {
          ...owner,
          collections: Array.from({ length: 17 }, (_, index) => ({
            ...collection,
            id: index + 1,
            name: `Collection ${index + 1}`,
            updatedAt: new Date(2026, 0, 17 - index),
          })),
        },
      ]}
    />
  ),
};

/** User collections page story. */
export const UserCollections: Story = {
  /**
   * Renders the user collections story.
   * @returns User collection fixtures.
   */
  render: () => (
    <UserCollectionsPage
      collections={[collection]}
      items={[item]}
      onFiltersChange={fn()}
    />
  ),
};

/** User index page story. */
export const User: Story = {
  /**
   * Renders the user index story.
   * @returns The user index fixture.
   */
  render: () => <UserIndexPage hasFeedback />,
};

/**
 * Creates a catalog image story fixture.
 *
 * @param id - Image identifier.
 * @param fileName - Image file name.
 * @param path - CDN path below the storybook asset prefix.
 * @returns The catalog image fixture.
 */
function image(id: number, fileName: string, path: string): CatalogImage {
  return {
    contentType: "image/webp",
    createdAt: new Date("2026-01-01"),
    deletedAt: null,
    deletedByClerkId: null,
    deletedByRole: null,
    fileName,
    id,
    objectPath: `assets/storybook/${path}`,
    position: 0,
    size: 1024,
    url: `https://cdn.pocket-trash.app/assets/storybook/${path}`,
  };
}
