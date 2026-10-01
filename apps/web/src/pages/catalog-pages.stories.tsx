import type {
  CatalogImage,
  CatalogProduct,
  PublicCollectionOwner,
  UserCollectionItem,
  UserCollectionSummary,
} from "@package/services";
import { formatTranslation } from "@pocket-trash/localizations";
import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { fn } from "storybook/test";
import { getHelpDocument } from "@/lib/help-content";
import { mockStoryAuth, StoryProviders } from "../../.storybook/story-fixtures";
import {
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
import { UserIndexPage } from "./user-index-page";

const productImage = image(1000, "one.webp", "product-images/one.webp");
const collectionImage = image(
  1001,
  "thirteen.webp",
  "collection-images/thirteen.webp",
);

const product: CatalogProduct = {
  bearing: "R188 hybrid ceramic",
  buttonDiameterMm: null,
  canAdminister: false,
  canEdit: false,
  compatibleButtonId: null,
  compatibleButtonName: null,
  createdAt: new Date("2026-01-01"),
  description: "A **compact** spinner.",
  diameterMm: "50.8",
  finishOptions: [
    {
      colorEffect: null,
      colors: [{ hex: "#2563eb", id: 1000, name: "Blue", slug: "blue" }],
      finishes: [{ id: 1000, name: "Anodized", slug: "anodized" }],
      id: 1000,
    },
  ],
  id: 1000,
  imageCount: 1,
  images: [productImage],
  isAdminPrivate: false,
  isPrivate: false,
  lengthMm: null,
  makerId: 1000,
  makerName: "KAP EDC",
  makerProductUrl: "https://www.kapedc.com/products/katla",
  makerProductUrlValid: true,
  makerUrl: "https://www.kapedc.com",
  materials: [{ id: 1000, name: "Titanium", slug: "titanium" }],
  name: "Katla",
  ownerClerkId: "user_storybook",
  productTypeId: 1000,
  productTypeName: "Spinner",
  productTypeSlug: "spinner",
  slug: "katla",
  spinDiameterMm: "55",
  thicknessMm: "12.7",
  thicknessWithButtonMm: null,
  updatedAt: new Date("2026-01-02"),
  weightG: "90",
  widthMm: null,
};

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

const item: UserCollectionItem = {
  bearing: "R188 full ceramic",
  bearingOverride: "R188 full ceramic",
  canAdminister: false,
  canEdit: false,
  collectionId: collection.id,
  collectionIsPrivate: false,
  collectionItemId: 1000,
  collectionName: collection.name,
  displayName: "My Katla",
  description: "My **daily carry** spinner.",
  descriptionOverride: "My **daily carry** spinner.",
  finishOption: product.finishOptions[0] ?? null,
  imageCount: 1,
  images: [collectionImage],
  installedButtonId: 1001,
  isAdminPrivate: false,
  isPrivate: false,
  makerId: product.makerId,
  makerName: product.makerName,
  makerUrl: product.makerUrl,
  material: product.materials[0] ?? null,
  name: product.name,
  ownerClerkId: "user_storybook",
  ownerUsername: "royanger",
  ownerUserId: collection.ownerUserId,
  productId: product.id,
  productSlug: product.slug,
  productImages: product.images,
  productTypeName: product.productTypeName,
  productTypeSlug: "spinner",
  sourceProductFinishOptionId: product.finishOptions[0]?.id ?? null,
};

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

const owner: PublicCollectionOwner = {
  collections: [collection],
  itemCount: 1,
  items: [item],
  userId: collection.ownerUserId,
  username: "royanger",
};

const imageGuide = getHelpDocument("en-US", "image-size-and-resolution-guide");
if (!imageGuide) throw new Error("The image guide story fixture is missing.");

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
type Story = StoryObj<typeof meta>;

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
      ownerUsername={owner.username}
    />
  ),
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

/** Product index page story. */
export const Products: Story = {
  /**
   * Renders the product index story.
   * @returns The product index fixture.
   */
  render: () => <ProductsPage onFiltersChange={fn()} products={[product]} />,
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
   * Renders the public collections story.
   * @returns Public collection fixtures.
   */
  render: () => (
    <PublicCollectionsPage onFiltersChange={fn()} owners={[owner]} />
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
