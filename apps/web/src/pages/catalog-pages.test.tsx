import type {
  CatalogImage,
  CatalogProduct,
  CatalogProductTypeSummary,
  PublicCollectionOwner,
} from "@package/services";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ProductCard } from "@/components/product-card";
import { emptyCatalogFilters } from "@/lib/catalog-filters";
import {
  CollectionItemDetailPage,
  CollectionPage,
  getCatalogPageSize,
  HomePage,
  PaginatedCards,
  ProductDetailPage,
  ProductGrid,
  ProductsPage,
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
   * @param props.search - Route search values.
   * @param props.to - Route destination.
   * @returns A test anchor.
   */
  Link: ({
    children,
    params = {},
    search = {},
    to,
  }: {
    /** Linked content. */
    children: React.ReactNode;
    /** Route parameter values. */
    params?: Record<string, number | string>;
    /** Route search values. */
    search?: Record<string, unknown>;
    /** Route destination. */
    to: string;
  }) => {
    const path = Object.entries(params).reduce(
      (path, [key, value]) => path.replace(`$${key}`, String(value)),
      to,
    );
    const query = new URLSearchParams(
      Object.entries(search).flatMap(([key, value]) =>
        value === undefined ? [] : [[key, String(value)] as [string, string]],
      ),
    ).toString();
    const href = query ? `${path}?${query}` : path;
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
        compatibleButtonId: null,
        compatibleButtonName: null,
        displayName: "My Catla",
        description: null,
        descriptionOverride: null,
        finishOption: null,
        effectiveSliderSetup: null,
        imageCount: 0,
        images: [],
        installedButtonId: null,
        installedInsertId: null,
        installedOnSliderId: null,
        installedPlateId: null,
        includedInsert: null,
        includedPlate: null,
        isAdminPrivate: false,
        isPrivate: false,
        makerId: 1,
        makerName: "KAP EDC",
        makerSlug: "kap-edc",
        makerUrl: null,
        material: null,
        name: "Catla",
        ownerClerkId: "user_1002",
        ownerImageUrl: null,
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
    imageUrl: null,
    userId: 1002,
    username: "royanger",
  },
] satisfies PublicCollectionOwner[];

/** Catalog product fixture used by page tests. */
const product: CatalogProduct = {
  approvalStatus: "approved",
  bearing: null,
  buttonDiameter: null,
  clickCount: null,
  canAdminister: false,
  canEdit: false,
  compatibleButtonId: null,
  compatibleButtonName: null,
  createdAt: new Date(0),
  description: null,
  diameter: null,
  finishOptions: [],
  id: 1,
  imageCount: 0,
  images: [],
  includedInsert: null,
  includedPlate: null,
  isAdminPrivate: false,
  isPrivate: false,
  length: null,
  makerId: 1,
  makerName: "KAP EDC",
  makerSlug: "kap-edc",
  makerProductUrl: null,
  makerProductUrlValid: true,
  makerUrl: "https://www.kapedc.com",
  magnetLayout: null,
  usesInserts: null,
  materials: [],
  name: "Catla",
  ownerClerkId: "user_1002",
  productTypeId: 1,
  productTypeName: "Spinner",
  productTypeSlug: "spinner",
  slug: "catla",
  spinDiameter: null,
  thickness: null,
  thicknessWithButton: null,
  updatedAt: new Date(0),
  weight: null,
  width: null,
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

  it("returns a collection when its parent slider has the selected installed plate", () => {
    const owner = owners[0];
    const collection = owner?.collections[0];
    const sourceItem = owner?.items[0];
    if (!owner || !collection || !sourceItem) {
      throw new Error("Public collection fixtures are required.");
    }
    const otherCollection = {
      ...collection,
      id: 1002,
      name: "Other collection",
    };
    const installedPlate = {
      ...sourceItem,
      collectionItemId: 2001,
      displayName: "Standalone selected plate",
      installedOnSliderId: 2000,
      name: "V2 plate",
      productId: 401,
      productSlug: "v2-plate",
      productTypeName: "Slider plate",
      productTypeSlug: "slider-plate" as const,
    };
    const parentSlider = {
      ...sourceItem,
      displayName: "Qualifying parent slider",
      installedPlateId: installedPlate.collectionItemId,
      productTypeName: "Slider",
      productTypeSlug: "slider" as const,
    };
    const unrelated = {
      ...sourceItem,
      collectionId: otherCollection.id,
      collectionItemId: 2002,
      displayName: "Unrelated slider",
      productTypeName: "Slider",
      productTypeSlug: "slider" as const,
    };

    const html = renderToStaticMarkup(
      <PublicCollectionsPage
        filters={{ ...emptyCatalogFilters(), plateIds: [401] }}
        owners={[
          {
            ...owner,
            collections: [collection, otherCollection],
            items: [parentSlider, installedPlate, unrelated],
          },
        ]}
      />,
    );

    expect(html).toContain("Daily Carry");
    expect(html).not.toContain("Other collection");
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
  it("places the owner avatar beside the title in the details card", () => {
    const collection = owners[0]?.collections[0];
    if (!collection) throw new Error("Collection fixture is required.");
    const html = renderToStaticMarkup(
      <CollectionPage
        collection={collection}
        items={[]}
        ownerImageUrl="https://img.clerk.com/picture"
        ownerUsername="royanger"
      />,
    );
    const content = html.slice(html.indexOf("<main"));
    expect(content).toContain('data-slot="avatar"');
    expect(content).toContain('data-size="lg"');
    expect(content.indexOf('data-slot="avatar"')).toBeGreaterThan(
      content.indexOf(collection.name),
    );
  });
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

  it("shows the qualifying parent assembly and omits its standalone plate", () => {
    const collection = owners[0]?.collections[0];
    const sourceItem = owners[0]?.items[0];
    if (!collection || !sourceItem) {
      throw new Error("Collection fixtures are required.");
    }
    const installedPlate = {
      ...sourceItem,
      collectionItemId: 2001,
      displayName: "Standalone selected plate",
      installedOnSliderId: sourceItem.collectionItemId,
      name: "V2 plate",
      productId: 401,
      productSlug: "v2-plate",
      productTypeName: "Slider plate",
      productTypeSlug: "slider-plate" as const,
    };
    const parentSlider = {
      ...sourceItem,
      displayName: "Qualifying parent slider",
      installedPlateId: installedPlate.collectionItemId,
      productTypeName: "Slider",
      productTypeSlug: "slider" as const,
    };

    const html = renderToStaticMarkup(
      <CollectionPage
        collection={collection}
        filters={{ ...emptyCatalogFilters(), plateIds: [401] }}
        items={[parentSlider, installedPlate]}
      />,
    );

    expect(html).toContain("Qualifying parent slider");
    expect(html).not.toContain("Standalone selected plate");
  });

  it("matches only the owned item's selected pattern snapshot", () => {
    const collection = owners[0]?.collections[0];
    const sourceItem = owners[0]?.items[0];
    if (!collection || !sourceItem) {
      throw new Error("Collection fixtures are required.");
    }
    const selectedPattern = { id: 201, name: "Ripple", slug: "ripple" };
    const ownedSlider = {
      ...sourceItem,
      displayName: "Ripple owned slider",
      finishOption: {
        colorEffect: null,
        colors: [],
        finishes: [],
        id: 1001,
        pattern: selectedPattern,
      },
      productTypeName: "Slider",
      productTypeSlug: "slider" as const,
    };

    const selectedHtml = renderToStaticMarkup(
      <CollectionPage
        collection={collection}
        filters={{
          ...emptyCatalogFilters(),
          patternIds: [selectedPattern.id],
        }}
        items={[ownedSlider]}
      />,
    );
    const unselectedHtml = renderToStaticMarkup(
      <CollectionPage
        collection={collection}
        filters={{ ...emptyCatalogFilters(), patternIds: [202] }}
        items={[ownedSlider]}
      />,
    );

    expect(selectedHtml).toContain("Ripple owned slider");
    expect(unselectedHtml).not.toContain("Ripple owned slider");
  });

  it("matches an installed spinner button through its parent spinner only", () => {
    const collection = owners[0]?.collections[0];
    const sourceItem = owners[0]?.items[0];
    if (!collection || !sourceItem) {
      throw new Error("Collection fixtures are required.");
    }
    const installedButton = {
      ...sourceItem,
      collectionItemId: 2001,
      displayName: "Standalone selected button",
      installedOnSliderId: sourceItem.collectionItemId,
      name: "Soft click button",
      productId: 501,
      productSlug: "soft-click-button",
      productTypeName: "Spinner button",
      productTypeSlug: "spinner-button" as const,
    };
    const parentSpinner = {
      ...sourceItem,
      displayName: "Qualifying parent spinner",
      installedButtonId: installedButton.collectionItemId,
    };

    const html = renderToStaticMarkup(
      <CollectionPage
        collection={collection}
        filters={{ ...emptyCatalogFilters(), spinnerButtonIds: [501] }}
        items={[parentSpinner, installedButton]}
      />,
    );

    expect(html).toContain("Qualifying parent spinner");
    expect(html).not.toContain("Standalone selected button");
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

describe("ProductsPage", () => {
  it("groups visible product types and links into the product list", () => {
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
      {
        id: 4,
        isPartOrAccessory: true,
        name: "Spinner Button",
        slug: "spinner-button",
      },
      {
        id: 5,
        isPartOrAccessory: false,
        name: "Empty type",
        slug: "empty-type",
      },
    ];
    const products = productTypes.slice(0, 4).map((type, index) => ({
      ...product,
      id: index + 1,
      name: `${type.name} product`,
      productTypeId: type.id,
      productTypeName: type.name,
      productTypeSlug: type.slug as CatalogProduct["productTypeSlug"],
      slug: `${type.slug}-product`,
    }));

    const html = renderToStaticMarkup(
      <ProductsPage
        productTypes={productTypes}
        products={products}
        view="directory"
      />,
    );

    const labels = [
      "All Products",
      "Slider",
      "Spinner",
      "Parts and Accessories",
      "Slider plate",
      "Spinner button",
    ].map((label) => html.indexOf(label));
    expect(labels.every((index) => index >= 0)).toBe(true);
    expect(labels).toEqual([...labels].sort((left, right) => left - right));
    expect(html).toContain('<h2 class="sr-only">Products</h2>');
    expect(html).toContain(
      '<h3 class="m-0 text-xl font-semibold" id="parts-and-accessories-title">Parts and Accessories</h3>',
    );
    expect(html).not.toContain("Empty type");
    expect(html).toContain('href="/products?view=all"');
    expect(html).toContain('href="/products?type=spinner&amp;view=all"');
  });

  it("matches any offered pattern together with the included plate", () => {
    const ripple = { id: 201, name: "Ripple", slug: "ripple" };
    const qualifying = {
      ...product,
      finishOptions: [
        {
          colorEffect: null,
          colors: [],
          finishes: [],
          id: 1001,
          pattern: null,
        },
        {
          colorEffect: null,
          colors: [],
          finishes: [],
          id: 1002,
          pattern: ripple,
        },
      ],
      includedPlate: {
        id: 401,
        name: "V2 plate",
        productTypeSlug: "slider-plate" as const,
        slug: "v2-plate",
      },
      name: "Qualifying catalog slider",
      productTypeName: "Slider",
      productTypeSlug: "slider" as const,
      slug: "qualifying-slider",
    };
    const unrelated = {
      ...product,
      id: 2,
      name: "Unrelated catalog slider",
      productTypeName: "Slider",
      productTypeSlug: "slider" as const,
      slug: "unrelated-slider",
    };

    const html = renderToStaticMarkup(
      <ProductsPage
        filters={{
          ...emptyCatalogFilters(),
          patternIds: [ripple.id],
          plateIds: [401],
        }}
        products={[qualifying, unrelated]}
      />,
    );

    expect(html).toContain("Qualifying catalog slider");
    expect(html).not.toContain("Unrelated catalog slider");
  });

  it("matches a spinner by its exact compatible button product", () => {
    const qualifying = {
      ...product,
      compatibleButtonId: 501,
      compatibleButtonName: "Soft click button",
      name: "Qualifying catalog spinner",
      slug: "qualifying-spinner",
    };
    const unrelated = {
      ...product,
      id: 2,
      name: "Unrelated catalog spinner",
      slug: "unrelated-spinner",
    };

    const html = renderToStaticMarkup(
      <ProductsPage
        filters={{
          ...emptyCatalogFilters(),
          spinnerButtonIds: [501],
        }}
        products={[qualifying, unrelated]}
      />,
    );

    expect(html).toContain("Qualifying catalog spinner");
    expect(html).not.toContain("Unrelated catalog spinner");
  });
});

describe("ProductDetailPage", () => {
  it("shows the slider layout and derived click count", () => {
    const html = renderToStaticMarkup(
      <ProductDetailPage
        collectionItems={[]}
        product={{
          ...product,
          clickCount: 3,
          magnetLayout: "2x4",
          usesInserts: false,
          productTypeName: "Slider",
          productTypeSlug: "slider",
        }}
      />,
    );

    expect(html).toMatch(/2×4 — 3-click|web\.slider\.layout\.option/);
    expect(html).toMatch(/8 slots per side|web\.slider\.layout\.help/);
    expect(html).not.toContain("Install");
    expect(html).not.toContain("Custom setup");
  });

  it("shows the exact included insert", () => {
    const html = renderToStaticMarkup(
      <ProductDetailPage
        collectionItems={[]}
        product={{
          ...product,
          includedInsert: {
            id: 2000,
            name: "Maker Insert",
            productTypeSlug: "slider-insert",
            slug: "maker-insert",
          },
          productTypeName: "Slider",
          productTypeSlug: "slider",
          usesInserts: true,
        }}
      />,
    );

    expect(html).toContain("Maker Insert");
    expect(html).toContain("/products/slider-insert/maker-insert");
    expect(html).not.toContain("Available insert setups");
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
      spinDiameter: { unit: "mm" as const, value: "52" },
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
      clickCount: 3,
      magnetLayout: "2x4" as const,
      usesInserts: false,
      productTypeName: "Slider",
      productTypeSlug: "slider" as const,
      thickness: { unit: "mm" as const, value: "12" },
      width: { unit: "mm" as const, value: "40" },
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

    expect(html).toMatch(
      /Slider body holds magnets|web\.slider\.capability\.sliderBodyHoldsMagnets/,
    );
    expect(html).toMatch(/Magnet setup|web\.slider\.setup\.title/);
    expect(html).toMatch(/2×4 — 3-click|web\.slider\.layout\.option/);
    expect(html).toContain("40 mm");
    expect(html).toContain("12 mm");
    expect(html).not.toContain("Build from scratch");
  });

  it("shows installed slider components", () => {
    const item = owners[0]?.items[0];
    if (!item) throw new Error("Collection item fixture is required.");
    const slider = {
      ...product,
      usesInserts: true,
      productTypeName: "Slider",
      productTypeSlug: "slider" as const,
    };
    const html = renderToStaticMarkup(
      <CollectionItemDetailPage
        installedInsert={{ ...item, displayName: "Installed insert" }}
        installedPlate={{ ...item, displayName: "Installed plate" }}
        item={{
          ...item,
          productTypeName: "Slider",
          productTypeSlug: "slider",
        }}
        product={slider}
      />,
    );

    expect(html).toContain("Installed plate");
    expect(html).toContain("Installed insert");
  });

  it("labels redacted installed components as unavailable instead of defaults", () => {
    const item = owners[0]?.items[0];
    if (!item) throw new Error("Collection item fixture is required.");
    const html = renderToStaticMarkup(
      <CollectionItemDetailPage
        item={{
          ...item,
          installedInsertUnavailable: true,
          installedPlateUnavailable: true,
          productTypeName: "Slider",
          productTypeSlug: "slider",
        }}
        product={{
          ...product,
          usesInserts: true,
          productTypeName: "Slider",
          productTypeSlug: "slider",
        }}
      />,
    );

    expect(html.match(/Unavailable component/g)).toHaveLength(2);
    expect(html).not.toContain("No plate installed");
    expect(html).not.toContain("No insert installed");
  });

  it("renders installed component privacy as a read-only inherited control", () => {
    const item = owners[0]?.items[0];
    if (!item) throw new Error("Collection item fixture is required.");
    const html = renderToStaticMarkup(
      <CollectionItemDetailPage
        item={{
          ...item,
          canEdit: true,
          isOwner: true,
          privacyInheritedFromItemId: 2010,
          savedIsPrivate: true,
        }}
      />,
    );

    expect(html).toContain("Inherited privacy");
    expect(html).toContain(
      "Use the information button with a pointer, keyboard, or touch to learn why this privacy setting is read-only.",
    );
    expect(html).toContain("disabled");
  });

  it("shows an owned slider's effective magnet snapshot", () => {
    const item = owners[0]?.items[0];
    if (!item) throw new Error("Collection item fixture is required.");
    const html = renderToStaticMarkup(
      <CollectionItemDetailPage
        item={{
          ...item,
          effectiveSliderSetup: {
            clickCount: null,
            configuration: {
              sideA: ["N52", "N48", null, "N42"],
              sideB: null,
            },
            magnetLayout: "2x2",
            source: "installed-insert",
          },
          productTypeName: "Slider",
          productTypeSlug: "slider",
        }}
        product={{
          ...product,
          usesInserts: true,
          productTypeName: "Slider",
          productTypeSlug: "slider",
        }}
      />,
    );

    expect(html).toContain("2×2 — 1-click");
    expect(html).toContain("N52");
    expect(html).toContain("Empty");
  });

  it("does not invent a live setup for an insert", () => {
    const item = owners[0]?.items[0];
    if (!item) throw new Error("Collection item fixture is required.");
    const html = renderToStaticMarkup(
      <CollectionItemDetailPage
        item={{
          ...item,
          productTypeName: "Slider insert",
          productTypeSlug: "slider-insert",
        }}
        product={{
          ...product,
          productTypeName: "Slider insert",
          productTypeSlug: "slider-insert",
        }}
      />,
    );

    expect(html).not.toContain("Magnet setup");
    expect(html).not.toContain("Advertised layout");
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
