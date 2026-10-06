import type {
  CatalogImage,
  CatalogProduct,
  PublicCollectionOwner,
} from "@package/services";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ProductCard } from "@/components/product-card";
import {
  CollectionItemDetailPage,
  CollectionPage,
  getCatalogPageSize,
  HomePage,
  PaginatedCards,
  ProductDetailPage,
  ProductGrid,
  PublicCollectionsPage,
  UserCollectionsPage,
} from "./catalog-pages";

describe("HomePage", () => {
  it("renders Products, Collections, Makers, Materials, and Resources in order", () => {
    const html = renderToStaticMarkup(<HomePage />);
    const labels = [
      "Products",
      "Collections",
      "Makers",
      "Materials",
      "Resources",
    ].map((label) => html.indexOf(`>${label}<`));

    expect(labels.every((index) => index >= 0)).toBe(true);
    expect(labels).toEqual([...labels].sort((a, b) => a - b));
    expect(
      html.match(/src="[^"]*hero-cards\/products.webp[^"]*"/g),
    ).toHaveLength(3);
  });
});

vi.mock("@tanstack/react-router", () => ({
  /**
   * Returns the navigation spy used by static page tests.
   *
   * @returns Mock navigation callback.
   */
  useNavigate: () => vi.fn(),
  /**
   * Renders router links as anchors for static markup tests.
   *
   * @param props - Link properties.
   * @param props.children - Linked content.
   * @param props.params - Route parameter values.
   * @param props.to - Route destination.
   * @returns A test anchor.
   */
  Link: ({
    children,
    params = {},
    to,
  }: {
    /** Linked content. */
    children: React.ReactNode;
    /** Route parameter values. */
    params?: Record<string, number | string>;
    /** Route destination. */
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
  /**
   * Renders a minimal application shell for tests.
   *
   * @param props - Shell properties.
   * @param props.breadcrumbItems - Breadcrumb labels.
   * @param props.children - Nested page content.
   * @param props.headerActions - Header controls.
   * @param props.title - Page title.
   * @returns The test shell.
   */
  AppShell: ({
    breadcrumbItems = [],
    children,
    headerActions,
    title,
  }: {
    /** Breadcrumb labels. */
    breadcrumbItems?: Array<{
      /** Visible breadcrumb label. */
      label: string;
    }>;
    /** Nested page content. */
    children: React.ReactNode;
    /** Header controls. */
    headerActions?: React.ReactNode;
    /** Page title. */
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

vi.mock("@/components/user-page-shell", () => ({
  /**
   * Renders a minimal user shell for catalog page tests.
   *
   * @param root0 - User shell properties.
   * @param root0.breadcrumbItems - Additional breadcrumb labels.
   * @param root0.children - Nested page content.
   * @param root0.headerActions - Header controls.
   * @param root0.title - Page title.
   * @returns The test user shell.
   */
  UserPageShell: ({
    breadcrumbItems = [],
    children,
    headerActions,
    title,
  }: {
    /** Additional breadcrumb labels. */
    breadcrumbItems?: Array<{
      /** Visible breadcrumb label. */
      label: string;
    }>;
    /** Nested page content. */
    children: React.ReactNode;
    /** Header controls. */
    headerActions?: React.ReactNode;
    /** Page title. */
    title: string;
  }) => (
    <div
      data-breadcrumbs={[
        "User",
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
  /**
   * Returns the fixed test locale.
   *
   * @returns Fixed English locale state.
   */
  useLocale: () => ({ locale: "en-US" }),
}));

/** Public collection owner fixtures used by page tests. */
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
        summary: null,
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
        summary: null,
        updatedAt: new Date("2026-09-04"),
      },
    ],
    itemCount: 1,
    items: [
      {
        approvalStatus: "approved",
        bearing: null,
        bearingOverride: null,
        canAdminister: false,
        canEdit: false,
        collectionId: 1000,
        collectionIsPrivate: false,
        collectionItemId: 2000,
        collectionName: "Daily Carry",
        displayName: "My Catla",
        description: null,
        descriptionOverride: null,
        finishOption: null,
        effectiveSliderSetup: null,
        imageCount: 0,
        images: [],
        hasGrandfatheredInstallation: false,
        installedButtonId: null,
        installedInsertId: null,
        installedOnSliderId: null,
        installedPlateId: null,
        isAdminPrivate: false,
        isPrivate: false,
        makerId: 1,
        makerName: "KAP EDC",
        makerSlug: "kap-edc",
        makerUrl: null,
        material: null,
        name: "Catla",
        ownerClerkId: "user_1002",
        ownerUsername: "royanger",
        ownerUserId: 1002,
        ownedInsertSetup: null,
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

/** Catalog product fixture used by page tests. */
const product: CatalogProduct = {
  approvalStatus: "approved",
  advertisedInsertOffers: [],
  bearing: null,
  bodyHostedMagnetSetup: null,
  insertClickOptions: [],
  insertMagnetOffers: [],
  buttonDiameterMm: null,
  canAdminister: false,
  canEdit: false,
  compatibleButtonId: null,
  compatibleButtonName: null,
  compatibilityAdvisories: [],
  compatibilityFamilies: [],
  createdAt: new Date(0),
  description: null,
  diameterMm: null,
  finishOptions: [],
  id: 1,
  imageCount: 0,
  images: [],
  includedComponents: [],
  isAdminPrivate: false,
  isPrivate: false,
  lengthMm: null,
  makerId: 1,
  makerName: "KAP EDC",
  makerSlug: "kap-edc",
  makerProductUrl: null,
  makerProductUrlValid: true,
  makerUrl: "https://www.kapedc.com",
  magnetSystem: null,
  materials: [],
  name: "Catla",
  ownerClerkId: "user_1002",
  productTypeId: 1,
  productTypeName: "Spinner",
  productTypeSlug: "spinner",
  slug: "catla",
  spinDiameterMm: null,
  thicknessMm: null,
  thicknessWithButtonMm: null,
  updatedAt: new Date(0),
  weightG: null,
  weightBasis: null,
  widthMm: null,
};

describe("getCatalogPageSize", () => {
  it("matches the requested compact, regular, and wide card counts", () => {
    expect(getCatalogPageSize(402, 15)).toBe(8);
    expect(getCatalogPageSize(480, 20)).toBe(8);
    expect(getCatalogPageSize(744, 20)).toBe(12);
    expect(getCatalogPageSize(820, 15)).toBe(12);
    expect(getCatalogPageSize(1280, 15)).toBe(12);
    expect(getCatalogPageSize(1281, 15)).toBe(15);
    expect(getCatalogPageSize(1281, 20)).toBe(20);
    expect(getCatalogPageSize(1281, 16)).toBe(16);
  });

  it("renders an externally controlled page without changing shared defaults", () => {
    const html = renderToStaticMarkup(
      <PaginatedCards
        ariaLabel="Controlled cards"
        items={Array.from({ length: 14 }, (_value, index) => index + 1)}
        onPageChange={vi.fn()}
        page={1}
        widePageSize={16}
      >
        {(items) => <div>{items.join(",")}</div>}
      </PaginatedCards>,
    );

    expect(html).toContain(">13,14<");
    expect(html).not.toContain(">1,2,3,");
  });
});

describe("PublicCollectionsPage", () => {
  it("links public collection cards directly to their collection", () => {
    const html = renderToStaticMarkup(
      <PublicCollectionsPage owners={owners} />,
    );

    expect(html).toContain('href="/collections/1002/1000"');
    expect(html).not.toContain('href="/collections/1002"');
    expect(html).not.toContain("Private collection");
  });

  it("renders twelve collection cards before viewport sizing initializes", () => {
    const collection = owners[0]?.collections[0];
    const owner = owners[0];
    if (!collection || !owner) throw new Error("Owner fixtures are required.");
    const collections = Array.from({ length: 17 }, (_, index) => {
      const coverImage = collectionImage(index + 1);
      return {
        ...collection,
        coverImage,
        coverImages: [coverImage],
        id: index + 1,
        name: `Collection ${index + 1}`,
        updatedAt: new Date(2026, 0, index + 1),
      };
    });

    const html = renderToStaticMarkup(
      <PublicCollectionsPage owners={[{ ...owner, collections }]} />,
    );

    expect(html).toContain("Collection 17");
    expect(html).toContain("Collection 6");
    expect(html).not.toContain("Collection 5</h2>");
    expect(html).not.toContain("collection-5.webp");
    expect(html).toContain("width=640");
    expect(html).toContain("Page 1 of 2");
  });
});

describe("UserCollectionsPage", () => {
  it("places filters and actions above the collection cards", () => {
    const html = renderToStaticMarkup(
      <UserCollectionsPage
        collections={owners[0]?.collections ?? []}
        items={owners[0]?.items ?? []}
        onFiltersChange={vi.fn()}
      />,
    );

    expect(html).toContain('data-breadcrumbs="User &gt; Collections"');
    expect(html).not.toContain("Add to collection");
    expect(html).toContain("Add collection");
    expect(html.indexOf("<main")).toBeLessThan(html.indexOf("More filters"));
    expect(html.indexOf("More filters")).toBeLessThan(
      html.indexOf("Daily Carry"),
    );
  });

  it("shows the plain-text summary instead of the description on cards", () => {
    const collection = owners[0]?.collections[0];
    if (!collection) throw new Error("Collection fixture is required.");

    const html = renderToStaticMarkup(
      <UserCollectionsPage
        collections={[
          {
            ...collection,
            description: "DETAIL_ONLY_DESCRIPTION",
            summary: "Card summary with **literal Markdown**",
          },
        ]}
        items={[]}
      />,
    );

    expect(html).toContain("Card summary with **literal Markdown**");
    expect(html).not.toContain("DETAIL_ONLY_DESCRIPTION");
    expect(html).not.toContain("<strong>literal Markdown</strong>");
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
    expect(html).toContain('href="/collections/add"');
    expect(html).toContain("Add to collection");
    expect(html.indexOf("Edit")).toBeLessThan(html.indexOf("Public"));
    expect(html).toContain("lg:grid-cols-2");
  });

  it("places user-area filters above the collection summary", () => {
    const collection = owners[0]?.collections[0];
    if (!collection) throw new Error("Collection fixture is required.");

    const html = renderToStaticMarkup(
      <CollectionPage
        collection={collection}
        items={owners[0]?.items ?? []}
        onFiltersChange={vi.fn()}
        userArea
      />,
    );

    const content = html.slice(html.indexOf("<main"));
    expect(content.indexOf("More filters")).toBeLessThan(
      content.indexOf(collection.name),
    );
  });

  it("keeps descriptions and bearings off collection lists", () => {
    const collection = owners[0]?.collections[0];
    const item = owners[0]?.items[0];
    if (!collection || !item) throw new Error("Collection fixtures required.");

    const html = renderToStaticMarkup(
      <CollectionPage
        collection={collection}
        items={[
          {
            ...item,
            bearing: "LIST_ONLY_BEARING",
            description: "LIST_ONLY_DESCRIPTION",
          },
        ]}
        ownerUsername="royanger"
      />,
    );

    expect(html).not.toContain("LIST_ONLY_BEARING");
    expect(html).not.toContain("LIST_ONLY_DESCRIPTION");
  });

  it("shows a paginated image gallery beside the collection summary", () => {
    const collection = owners[0]?.collections[0];
    if (!collection) throw new Error("Collection fixture is required.");
    const images = Array.from({ length: 8 }, (_, index) =>
      collectionImage(index + 1),
    );

    const html = renderToStaticMarkup(
      <CollectionPage
        collection={{
          ...collection,
          coverImage: images[7] ?? null,
          coverImages: images,
          description: "A focused **collection description**.",
          summary: "CARD_ONLY_SUMMARY",
        }}
        items={owners[0]?.items ?? []}
      />,
    );

    expect(html).toContain(
      "A focused <strong>collection description</strong>.",
    );
    expect(html).not.toContain("CARD_ONLY_SUMMARY");
    expect(html).toContain('src="https://cdn.test/collection-8.webp"');
    expect(html).not.toContain('src="https://cdn.test/collection-1.webp"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("lg:grid-cols-2");
  });
});

/**
 * Creates a collection image fixture.
 *
 * @param id - Image identifier and position.
 * @returns The collection image fixture.
 */
function collectionImage(id: number): CatalogImage {
  return {
    contentType: "image/webp",
    createdAt: new Date(0),
    deletedAt: null,
    deletedByClerkId: null,
    deletedByRole: null,
    fileName: `collection-${id}.webp`,
    id,
    objectPath: `collections/1000/collection-${id}.webp`,
    position: id,
    size: 1024,
    url: `https://cdn.test/collection-${id}.webp`,
  };
}

describe("ProductCard", () => {
  it("keeps descriptions off cards", () => {
    const html = renderToStaticMarkup(
      <ProductCard
        finishOptionCountLabel="No finishes"
        imageAlt="Catla"
        imageCountLabel="No images"
        materialCountLabel="No materials"
        privateLabel="Private"
        product={{ ...product, description: "CARD_ONLY_DESCRIPTION" }}
      />,
    );

    expect(html).not.toContain("CARD_ONLY_DESCRIPTION");
  });

  it("requests a lazy card-sized image", () => {
    const html = renderToStaticMarkup(
      <ProductCard
        finishOptionCountLabel="No finishes"
        imageAlt="Catla"
        imageCountLabel="One image"
        materialCountLabel="No materials"
        privateLabel="Private"
        product={{
          ...product,
          images: [
            {
              ...collectionImage(1),
              url: "https://cdn.test/product.webp?token=signed&format=webp&quality=85",
            },
          ],
        }}
      />,
    );

    expect(html).toContain("width=640");
    expect(html).toContain('loading="lazy"');
  });
});

describe("ProductGrid", () => {
  it("renders twelve product cards before viewport sizing initializes", () => {
    const products = Array.from({ length: 21 }, (_, index) => ({
      ...product,
      id: index + 1,
      name: `Product ${index + 1}`,
      slug: `product-${index + 1}`,
    }));

    const html = renderToStaticMarkup(<ProductGrid products={products} />);

    expect(html).toContain("Product 1");
    expect(html).toContain("Product 12");
    expect(html).not.toContain("Product 13");
    expect(html).toContain("Page 1 of 2");
  });
});

describe("ProductDetailPage", () => {
  it("shows the live body-hosted setup as exact read-only catalog facts", () => {
    const html = renderToStaticMarkup(
      <ProductDetailPage
        collectionItems={[]}
        product={{
          ...product,
          bodyHostedMagnetSetup: {
            clickCount: 4,
            configuration: {
              groups: [
                {
                  diameterMm: "6.35",
                  grade: "N52",
                  key: "corners",
                  label: "Corners",
                  thicknessMm: "3.175",
                },
              ],
              label: "Medium",
              slots: [
                {
                  documentedColumn: 1,
                  documentedRow: 1,
                  groupKey: "corners",
                  half: "half-a",
                  key: "A1",
                  state: "occupied",
                },
              ],
              sourceLabel: "4-click layout",
              sourceNotes: null,
            },
            sourceNote: null,
          },
          magnetSystem: "body-hosted",
          productTypeName: "Slider",
          productTypeSlug: "slider",
        }}
      />,
    );

    expect(html).toContain("4 clicks");
    expect(html).toContain("Medium — 4-click layout");
    expect(html).toContain("6.35×3.175 mm, N52");
    expect(html).toContain("Half A A1");
    expect(html).not.toContain("Install");
    expect(html).not.toContain("Custom setup");
  });

  it("distinguishes insert offers and slider advertised defaults", () => {
    const configuration = {
      groups: [],
      label: "Medium",
      slots: [
        {
          documentedColumn: null,
          documentedRow: null,
          groupKey: null,
          half: "half-a" as const,
          key: "A1",
          state: "empty" as const,
        },
      ],
      sourceLabel: null,
      sourceNotes: null,
    };
    const html = renderToStaticMarkup(
      <ProductDetailPage
        collectionItems={[]}
        product={{
          ...product,
          advertisedInsertOffers: [
            {
              clickCount: 3,
              clickOptionId: 3000,
              configuration,
              copiedFromTemplateId: null,
              id: 4000,
              insertProductId: 2000,
              insertProductName: "Maker Insert",
              isAdvertisedDefault: true,
              isSliderAdvertisedDefault: true,
            },
          ],
          magnetSystem: "insert-driven",
          productTypeName: "Slider",
          productTypeSlug: "slider",
        }}
      />,
    );

    expect(html).toContain("Available insert setups");
    expect(html).toContain("Maker Insert: Medium");
    expect(html).toContain("Default setup");
  });

  it("limits deletion controls to owners and authorized staff", () => {
    const publicHtml = renderToStaticMarkup(
      <ProductDetailPage collectionItems={[]} product={product} />,
    );
    expect(publicHtml).not.toContain("Permanently delete product");
    for (const isOwner of [true, false]) {
      const html = renderToStaticMarkup(
        <ProductDetailPage
          collectionItems={[]}
          product={{ ...product, canEdit: true, isOwner }}
        />,
      );
      expect(html).toContain("Permanently delete product");
      expect(html.includes("<textarea")).toBe(!isOwner);
    }
  });

  it("links each matching collection and collection item", () => {
    const item = owners[0]?.items[0];
    if (!item) throw new Error("Collection item fixture is required.");

    const html = renderToStaticMarkup(
      <ProductDetailPage collectionItems={[item]} product={product} />,
    );

    expect(html).toContain('class="grid gap-3 lg:grid-cols-2"');
    expect(html).toContain('href="/collections/1002/1000"');
    expect(html).toContain('href="/collections/1002/1000/2000"');
    expect(html).toContain('href="/makers/kap-edc"');
  });

  it("renders sanitized markdown and only valid maker product links", () => {
    const sourcedProduct = {
      ...product,
      bearing: "R188",
      description: "**Fast** <script>alert('no')</script>",
      makerProductUrl: "https://www.kapedc.com/products/catla",
      spinDiameterMm: "52",
    };

    const html = renderToStaticMarkup(
      <ProductDetailPage collectionItems={[]} product={sourcedProduct} />,
    );
    const invalidHtml = renderToStaticMarkup(
      <ProductDetailPage
        collectionItems={[]}
        product={{ ...sourcedProduct, makerProductUrlValid: false }}
      />,
    );

    expect(html).toContain("<strong>Fast</strong>");
    expect(html).not.toContain("<script");
    expect(html).toContain("R188");
    expect(html).toContain("52 mm");
    expect(html).toContain('href="https://www.kapedc.com/products/catla"');
    expect(html).toContain("hover:text-primary");
    expect(html).toContain("focus-visible:ring-ring");
    expect(html).toContain("text-[13.5px] leading-[1.6]");
    expect(html).toContain("text-card-foreground");
    expect(invalidHtml).not.toContain(
      'href="https://www.kapedc.com/products/catla"',
    );
  });
});

describe("CollectionItemDetailPage", () => {
  it("shows live body-hosted slider facts as read-only details", () => {
    const item = owners[0]?.items[0];
    if (!item) throw new Error("Collection item fixture is required.");
    const slider = {
      ...product,
      bodyHostedMagnetSetup: {
        clickCount: 3,
        configuration: null,
        sourceNote: "Documented by the maker.",
      },
      magnetSystem: "body-hosted" as const,
      productTypeName: "Slider",
      productTypeSlug: "slider" as const,
      thicknessMm: "12",
      widthMm: "40",
    };
    const html = renderToStaticMarkup(
      <CollectionItemDetailPage
        item={{
          ...item,
          productTypeName: "Slider",
          productTypeSlug: "slider",
        }}
        product={slider}
      />,
    );

    expect(html).toContain("Body-hosted");
    expect(html).toContain("Magnet setup");
    expect(html).toContain("Documented by the maker.");
    expect(html).toContain("40 mm");
    expect(html).toContain("12 mm");
    expect(html).not.toContain("Build from scratch");
  });

  it("shows installed slider components and grandfathered compatibility warnings", () => {
    const item = owners[0]?.items[0];
    if (!item) throw new Error("Collection item fixture is required.");
    const slider = {
      ...product,
      magnetSystem: "insert-driven" as const,
      productTypeName: "Slider",
      productTypeSlug: "slider" as const,
    };
    const html = renderToStaticMarkup(
      <CollectionItemDetailPage
        installedInsert={{ ...item, displayName: "Installed insert" }}
        installedPlate={{ ...item, displayName: "Installed plate" }}
        item={{
          ...item,
          hasGrandfatheredInstallation: true,
          productTypeName: "Slider",
          productTypeSlug: "slider",
        }}
        product={slider}
      />,
    );

    expect(html).toContain("Installed plate");
    expect(html).toContain("Installed insert");
    expect(html).toContain(
      "This installation can remain connected, but reinstalling will use current compatibility.",
    );
  });

  it("shows an owned slider's effective setup without filling snapshot gaps", () => {
    const item = owners[0]?.items[0];
    if (!item) throw new Error("Collection item fixture is required.");
    const html = renderToStaticMarkup(
      <CollectionItemDetailPage
        item={{
          ...item,
          effectiveSliderSetup: {
            clickCount: null,
            configuration: {
              groups: [],
              label: "Owner layout",
              slots: [
                {
                  documentedColumn: null,
                  documentedRow: null,
                  groupKey: null,
                  half: "half-a",
                  key: "A1",
                  state: "unknown",
                },
              ],
              sourceLabel: null,
              sourceNotes: null,
            },
            isLiveCatalog: false,
            source: "owned-insert",
          },
          productTypeName: "Slider",
          productTypeSlug: "slider",
        }}
        product={{
          ...product,
          magnetSystem: "insert-driven",
          productTypeName: "Slider",
          productTypeSlug: "slider",
        }}
      />,
    );

    expect(html).toContain("web.slider.setup.notRecorded");
    expect(html).toContain("Owner layout");
    expect(html).toContain("web.slider.magnet.state.unknown");
  });

  it("uses an insert's live advertised default until its owner records a setup", () => {
    const item = owners[0]?.items[0];
    if (!item) throw new Error("Collection item fixture is required.");
    const configuration = {
      groups: [],
      label: "Advertised layout",
      slots: [],
      sourceLabel: null,
      sourceNotes: null,
    };
    const html = renderToStaticMarkup(
      <CollectionItemDetailPage
        item={{
          ...item,
          ownedInsertSetup: null,
          productTypeName: "Slider insert",
          productTypeSlug: "slider-insert",
        }}
        product={{
          ...product,
          insertMagnetOffers: [
            {
              clickCount: 5,
              clickOptionId: 3000,
              configuration,
              copiedFromTemplateId: null,
              id: 4000,
              insertProductId: product.id,
              isAdvertisedDefault: true,
            },
          ],
          productTypeName: "Slider insert",
          productTypeSlug: "slider-insert",
        }}
      />,
    );

    expect(html).toContain("web.slider.setup.defaultDescription");
    expect(html).toContain("Advertised layout");
    expect(html).toContain("5");
  });

  it("shows approval actions only to administrators while owners retain review status and editing", () => {
    const item = owners[0]?.items[0];
    if (!item) throw new Error("Collection item fixture is required.");
    const pending = {
      ...item,
      approvalStatus: "pending" as const,
      canEdit: true,
      isOwner: true,
    };
    const ownerHtml = renderToStaticMarkup(
      <CollectionItemDetailPage item={pending} />,
    );
    expect(ownerHtml).toContain("Pending review");
    expect(ownerHtml).toContain(`/collections/edit/${item.collectionItemId}`);
    expect(ownerHtml).not.toContain("Approve collection item");
    const adminHtml = renderToStaticMarkup(
      <CollectionItemDetailPage item={{ ...pending, canAdminister: true }} />,
    );
    expect(adminHtml).toContain("Collection item approval");
    expect(adminHtml).toContain("Approve collection item");
    expect(adminHtml).toContain("Reject collection item");
  });
  it("uses the display name while retaining product details", () => {
    const item = owners[0]?.items[0];
    if (!item) throw new Error("Collection item fixture is required.");

    const html = renderToStaticMarkup(<CollectionItemDetailPage item={item} />);

    expect(html).toContain("My Catla");
    expect(html).toContain("Catla");
    expect(html).toContain('href="/products/spinner/catla"');
  });

  it("renders effective collection item details", () => {
    const item = owners[0]?.items[0];
    if (!item) throw new Error("Collection item fixture is required.");

    const html = renderToStaticMarkup(
      <CollectionItemDetailPage
        item={{
          ...item,
          bearing: "One Drop",
          description: "Collection **override**",
        }}
      />,
    );

    expect(html).toContain("One Drop");
    expect(html).toContain("Collection <strong>override</strong>");
    expect(html).toContain("text-[13.5px] leading-[1.6]");
  });
});
