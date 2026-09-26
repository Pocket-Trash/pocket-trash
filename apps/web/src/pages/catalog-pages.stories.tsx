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

export const Collection: Story = {
  render: () => (
    <CollectionPage
      collection={collection}
      items={[item]}
      onFiltersChange={fn()}
      ownerUsername={owner.username}
    />
  ),
};

export const CollectionItem: Story = {
  render: () => (
    <CollectionItemDetailPage installedButton={installedButton} item={item} />
  ),
};

export const Home: Story = { render: () => <HomePage /> };

export const Help: Story = {
  render: () => <HelpIndexPage guideTitle={imageGuide.metadata.title} />,
};

export const HelpTopic: Story = {
  render: () => (
    <HelpTopicPage
      dateLabel={formatTranslation("web.help.datePublished")}
      dateModifiedLabel={formatTranslation("web.help.dateModified")}
      document={imageGuide}
      helpTitle={formatTranslation("web.navigation.help")}
    />
  ),
};

export const ProductDetail: Story = {
  render: () => (
    <ProductDetailPage collectionItems={[item]} product={product} />
  ),
};

export const Products: Story = {
  render: () => <ProductsPage onFiltersChange={fn()} products={[product]} />,
};

export const PublicCollection: Story = {
  render: () => <PublicCollectionPage owner={owner} />,
};

export const PublicCollections: Story = {
  render: () => (
    <PublicCollectionsPage onFiltersChange={fn()} owners={[owner]} />
  ),
};

export const UserCollections: Story = {
  render: () => (
    <UserCollectionsPage
      collections={[collection]}
      items={[item]}
      onFiltersChange={fn()}
    />
  ),
};

export const User: Story = { render: () => <UserIndexPage /> };

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
