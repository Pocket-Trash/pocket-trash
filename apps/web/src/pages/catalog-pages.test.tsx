import type { CatalogProduct, PublicCollectionOwner } from "@package/services";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  CollectionItemDetailPage,
  CollectionPage,
  ProductDetailPage,
  PublicCollectionsPage,
  UserCollectionsPage,
} from "./catalog-pages";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    params = {},
    to,
  }: {
    children: React.ReactNode;
    params?: Record<string, number | string>;
    to: string;
  }) => {
    const href = Object.entries(params).reduce(
      (path, [key, value]) => path.replace(`$${key}`, String(value)),
      to,
    );
    return <a href={href}>{children}</a>;
  },
}));

vi.mock("@/components/app-shell", () => ({
  AppShell: ({
    breadcrumbItems = [],
    children,
    headerActions,
    title,
  }: {
    breadcrumbItems?: Array<{ label: string }>;
    children: React.ReactNode;
    headerActions?: React.ReactNode;
    title: string;
  }) => (
    <div
      data-breadcrumbs={[
        ...breadcrumbItems.map(({ label }) => label),
        title,
      ].join(" > ")}
    >
      {headerActions}
      {children}
    </div>
  ),
}));

vi.mock("@/providers/locale-provider", () => ({
  useLocale: () => ({ locale: "en-US" }),
}));

const owners = [
  {
    collections: [
      {
        canAdminister: true,
        canEdit: true,
        coverImage: null,
        coverImages: [],
        createdAt: new Date("2026-09-01"),
        description: null,
        id: 1000,
        isAdminPrivate: false,
        isPrivate: false,
        isOwner: true,
        itemCount: 1,
        name: "Daily Carry",
        ownerUserId: 1002,
        updatedAt: new Date("2026-09-02"),
      },
      {
        coverImage: null,
        coverImages: [],
        createdAt: new Date("2026-09-03"),
        description: null,
        id: 1001,
        isAdminPrivate: false,
        isPrivate: true,
        itemCount: 0,
        name: "Private collection",
        ownerUserId: 1002,
        updatedAt: new Date("2026-09-04"),
      },
    ],
    itemCount: 1,
    items: [
      {
        canAdminister: false,
        canEdit: false,
        collectionId: 1000,
        collectionIsPrivate: false,
        collectionItemId: 2000,
        collectionName: "Daily Carry",
        displayName: "My Catla",
        finishOption: null,
        imageCount: 0,
        images: [],
        installedButtonId: null,
        isAdminPrivate: false,
        isPrivate: false,
        makerId: 1,
        makerName: "KAP EDC",
        makerUrl: null,
        material: null,
        name: "Catla",
        ownerClerkId: "user_1002",
        ownerUsername: "royanger",
        ownerUserId: 1002,
        productId: 1,
        productSlug: "catla",
        productImages: [],
        productTypeName: "Spinner",
        productTypeSlug: "spinner",
        sourceProductFinishOptionId: null,
      },
    ],
    userId: 1002,
    username: "royanger",
  },
] satisfies PublicCollectionOwner[];

const product: CatalogProduct = {
  buttonDiameterMm: null,
  canAdminister: false,
  canEdit: false,
  compatibleButtonId: null,
  compatibleButtonName: null,
  createdAt: new Date(0),
  diameterMm: null,
  finishOptions: [],
  id: 1,
  imageCount: 0,
  images: [],
  isAdminPrivate: false,
  isPrivate: false,
  lengthMm: null,
  makerId: 1,
  makerName: "KAP EDC",
  makerUrl: "https://www.kapedc.com",
  materials: [],
  name: "Catla",
  ownerClerkId: "user_1002",
  productTypeId: 1,
  productTypeName: "Spinner",
  productTypeSlug: "spinner",
  slug: "catla",
  thicknessMm: null,
  thicknessWithButtonMm: null,
  updatedAt: new Date(0),
  weightG: null,
  widthMm: null,
};

describe("PublicCollectionsPage", () => {
  it("links public collection cards directly to their collection", () => {
    const html = renderToStaticMarkup(
      <PublicCollectionsPage owners={owners} />,
    );

    expect(html).toContain('href="/collections/1002/1000"');
    expect(html).not.toContain('href="/collections/1002"');
    expect(html).not.toContain("Private collection");
  });
});

describe("UserCollectionsPage", () => {
  it("nests collections under the user breadcrumb", () => {
    const html = renderToStaticMarkup(
      <UserCollectionsPage collections={[]} items={[]} />,
    );

    expect(html).toContain('data-breadcrumbs="User &gt; Collections"');
  });
});

describe("CollectionPage", () => {
  it("shows owner controls on the public collection view", () => {
    const collection = owners[0]?.collections[0];
    if (!collection) throw new Error("Collection fixture is required.");

    const html = renderToStaticMarkup(
      <CollectionPage
        collection={collection}
        items={owners[0]?.items ?? []}
        ownerUsername="royanger"
      />,
    );

    expect(html).toContain("Edit");
    expect(html).toContain("Public");
    expect(html.indexOf("Edit")).toBeLessThan(html.indexOf("Public"));
  });
});

describe("ProductDetailPage", () => {
  it("links each matching collection and collection item", () => {
    const item = owners[0]?.items[0];
    if (!item) throw new Error("Collection item fixture is required.");

    const html = renderToStaticMarkup(
      <ProductDetailPage collectionItems={[item]} product={product} />,
    );

    expect(html).toContain('class="grid gap-3 lg:grid-cols-2"');
    expect(html).toContain('href="/collections/1002/1000"');
    expect(html).toContain('href="/collections/1002/1000/2000"');
    expect(html).toContain('href="https://www.kapedc.com"');
  });
});

describe("CollectionItemDetailPage", () => {
  it("uses the display name while retaining product details", () => {
    const item = owners[0]?.items[0];
    if (!item) throw new Error("Collection item fixture is required.");

    const html = renderToStaticMarkup(<CollectionItemDetailPage item={item} />);

    expect(html).toContain("My Catla");
    expect(html).toContain("Catla");
    expect(html).toContain('href="/products/spinner/catla"');
  });
});
