import type {
  CatalogProduct,
  CatalogProductType,
  UserCollectionItem,
  UserCollectionSummary,
} from "@package/services";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  CollectionAddPage,
  CollectionEditPage,
  CollectionFormPage,
  CollectionProductFields,
  collectionEditSubmissionMode,
  FinishOptionsEditor,
  ownedInsertSetupAfterLayoutChange,
  ProductEditor,
} from "./catalog-form-pages";

vi.mock("@tanstack/react-router", () => ({
  /**
   * Returns a navigation spy.
   *
   * @returns The navigation spy.
   */
  useNavigate: () => vi.fn(),
}));

vi.mock("@clerk/tanstack-react-start", () => ({
  /**
   * Returns test authentication helpers.
   *
   * @returns Authentication state with a token spy.
   */
  useAuth: () => ({ getToken: vi.fn() }),
}));

vi.mock("@/components/app-shell", () => ({
  /**
   * Renders a minimal application shell for tests.
   *
   * @param props - Shell properties.
   * @param props.children - Nested page content.
   * @returns The test shell.
   */
  AppShell: ({
    children,
  }: {
    /** Nested page content. */
    children: React.ReactNode;
  }) => <div>{children}</div>,
}));

/**
 * Renders a minimal user shell for tests.
 *
 * @param props - User shell properties.
 * @param props.children - Nested page content.
 * @returns The test user shell.
 */
function MockUserPageShell({
  children,
}: {
  /** Nested page content. */
  children: React.ReactNode;
}) {
  return <div>{children}</div>;
}

vi.mock("@/components/user-page-shell", () => ({
  UserPageShell: MockUserPageShell,
}));

vi.mock("@/providers/locale-provider", () => ({
  /**
   * Provides locale data for page tests.
   *
   * @returns The stable test locale.
   */
  useLocale: () => ({ locale: "en-US" }),
  /**
   * Provides an optional locale for page tests.
   *
   * @returns The test locale.
   */
  useOptionalLocale: () => "en-US",
}));

/**
 * Formats stable test copy.
 *
 * @param key - Localization key.
 * @param values - Values interpolated into the copy.
 * @returns The localized test copy.
 */
const t = (key: string, values: Readonly<Record<string, unknown>> = {}) =>
  key === "web.catalog.finishPreview" ? String(values.finish) : key;
/** Empty custom-finish selection used by form tests. */
const emptyCustomFinish = {
  colorEffectId: null,
  colorEffectSlug: null,
  colorIds: [],
  finishIds: [],
  patternId: null,
};
/** Empty catalog option lists used by form tests. */
const emptyCatalogOptions = {
  colorEffects: [],
  compatibilityFamilies: [],
  colors: [],
  finishes: [],
  makers: [],
  materials: [],
  patterns: [],
  productTypes: [],
  relationshipProducts: [],
  spinnerButtons: [],
};

describe("collection deletion choices", () => {
  it("keeps collection creation in a single column", () => {
    const html = renderToStaticMarkup(createElement(CollectionFormPage));

    expect(html).not.toContain("lg:grid-cols-2");
  });

  it("renders all outcomes with the affected item count", () => {
    const collection: UserCollectionSummary = {
      canAdminister: false,
      canEdit: true,
      coverImage: null,
      coverImages: [],
      createdAt: new Date(0),
      description: null,
      id: 1000,
      isAdminPrivate: false,
      isOwner: true,
      isPrivate: false,
      itemCount: 2,
      name: "Source",
      ownerUserId: 1000,
      updatedAt: new Date(0),
    };
    const html = renderToStaticMarkup(
      createElement(CollectionFormPage, {
        collection,
        deletion: { destinations: [], itemCount: 2 },
      }),
    );

    expect(html).toContain('value="archive"');
    expect(html).toContain('value="delete"');
    expect(html).toContain('value="move"');
    expect(html).toContain("Collection items: 2");
    expect(html).toContain("lg:grid-cols-2");
    expect(html).not.toContain("lg:col-start-2");
    expect(html.match(/<form/g)).toHaveLength(2);
    expect(html).toContain(">Cancel</button>");
  });
});

describe("finish option editor", () => {
  it("renders removable components and accessible ordering controls", () => {
    const html = renderToStaticMarkup(
      createElement(FinishOptionsEditor, {
        onChange: vi.fn(),
        onOptionsChange: vi.fn(),
        options: {
          colorEffects: [
            { id: 1000, name: "Solid", slug: "solid" },
            { id: 1001, name: "Fade", slug: "fade" },
          ],
          compatibilityFamilies: [],
          colors: [
            { id: 1000, name: "Blue", slug: "blue" },
            { id: 1001, name: "Purple", slug: "purple" },
          ],
          finishes: [{ id: 1000, name: "Anodized", slug: "anodized" }],
          makers: [],
          materials: [],
          patterns: [{ id: 1002, name: "Honeycomb", slug: "honeycomb" }],
          productTypes: [],
          relationshipProducts: [],
          spinnerButtons: [],
        },
        t,
        value: [
          {
            colorEffectId: 1001,
            colorEffectSlug: "fade",
            colorIds: [1000, 1001],
            finishIds: [1000],
            patternId: 1002,
          },
        ],
      }),
    );

    expect(html).toContain('aria-label="web.catalog.field.finishes"');
    expect(html).toContain('aria-label="web.action.close: Anodized"');
    expect(html).toContain('aria-label="web.action.close: Blue"');
    expect(html).toContain('aria-label="web.slider.appearance.pattern"');
    expect(html).toContain('value="Honeycomb"');
    expect(html).toContain("web.action.moveFinishOptionUp");
    expect(html).toContain("web.action.moveFinishOptionDown");
    expect(html).toContain("web.action.removeFinishOption");
    expect(html).toContain(
      "Anodized · Blue → Purple web.catalog.colorEffect.fade · Honeycomb",
    );
  });

  it("renders the owned material and product finish choices", () => {
    const product: CatalogProduct = {
      approvalStatus: "approved",
      advertisedInsertOffers: [],
      bearing: null,
      bodyHostedMagnetSetup: null,
      insertClickOptions: [],
      insertMagnetOffers: [],
      buttonDiameterMm: null,
      canAdminister: false,
      canEdit: true,
      compatibleButtonId: null,
      compatibleButtonName: null,
      compatibilityAdvisories: [],
      compatibilityFamilies: [],
      createdAt: new Date(0),
      description: null,
      diameterMm: null,
      finishOptions: [
        {
          colorEffect: null,
          colors: [],
          finishes: [{ id: 1001, name: "Polished", slug: "polished" }],
          id: 1002,
          pattern: null,
        },
      ],
      imageCount: 0,
      images: [],
      includedComponents: [],
      id: 1000,
      lengthMm: null,
      makerId: 1000,
      makerName: "Maker",
      makerSlug: "maker",
      makerProductUrl: null,
      makerProductUrlValid: true,
      makerUrl: null,
      magnetSystem: null,
      materials: [{ id: 1000, name: "Bronze", slug: "bronze" }],
      name: "Spinner",
      ownerClerkId: "user_test",
      isAdminPrivate: false,
      isPrivate: false,
      productTypeId: 1000,
      productTypeName: "Spinner",
      productTypeSlug: "spinner",
      slug: "spinner",
      spinDiameterMm: null,
      thicknessMm: null,
      thicknessWithButtonMm: null,
      updatedAt: new Date(0),
      weightG: null,
      weightBasis: null,
      widthMm: null,
    };
    const html = renderToStaticMarkup(
      createElement(CollectionProductFields, {
        customFinish: emptyCustomFinish,
        finish: { id: 1002, name: "Polished" },
        material: product.materials[0] ?? null,
        onCustomFinishChange: vi.fn(),
        onFinishChange: vi.fn(),
        onMaterialChange: vi.fn(),
        onOptionsChange: vi.fn(),
        options: emptyCatalogOptions,
        product,
        t,
      }),
    );

    expect(html).toContain('aria-label="web.catalog.field.materials"');
    expect(html).toContain('aria-label="web.action.close: Bronze"');
    expect(html).toContain('aria-label="web.action.close: Polished"');
  });

  it("renders a single private custom finish editor with ordered colors", () => {
    const product = productFixture(1000, "Spinner", "spinner");
    const html = renderToStaticMarkup(
      createElement(CollectionProductFields, {
        customFinish: {
          colorEffectId: 10,
          colorEffectSlug: "fade",
          colorIds: [22, 21],
          finishIds: [31],
          patternId: null,
        },
        finish: {
          id: "custom",
          name: "web.collections.finishChoice.custom",
        },
        material: product.materials[0] ?? null,
        onCustomFinishChange: vi.fn(),
        onFinishChange: vi.fn(),
        onMaterialChange: vi.fn(),
        onOptionsChange: vi.fn(),
        options: {
          ...emptyCatalogOptions,
          colorEffects: [{ id: 10, name: "Fade", slug: "fade" }],
          colors: [
            { id: 21, name: "Blue", slug: "blue" },
            { id: 22, name: "Purple", slug: "purple" },
          ],
          finishes: [{ id: 31, name: "Polished", slug: "polished" }],
        },
        product,
        t,
      }),
    );

    expect(html).toContain(
      "Polished · Purple → Blue web.catalog.colorEffect.fade",
    );
    expect(html).toContain("web.action.addFinish");
    expect(html).toContain("web.action.addColor");
    expect(html).not.toContain("web.action.addFinishOption");
  });

  it("restores independent spinner and installed button fields", () => {
    const spinner = productFixture(1000, "Spinner", "spinner");
    const button = productFixture(2000, "Button", "spinner-button");
    const buttonItem = collectionFixture(20, button, 2001);
    const spinnerItem = {
      ...collectionFixture(10, spinner, 1001),
      installedButtonId: buttonItem.collectionItemId,
    };

    const html = renderToStaticMarkup(
      createElement(CollectionEditPage, {
        buttonProducts: [button],
        collections: [
          {
            coverImage: null,
            coverImages: [],
            createdAt: new Date(0),
            description: null,
            id: 1000,
            isAdminPrivate: false,
            isPrivate: false,
            itemCount: 2,
            name: "Test collection",
            ownerUserId: 1,
            updatedAt: new Date(0),
          },
        ],
        item: spinnerItem,
        options: emptyCatalogOptions,
        ownedButtons: [buttonItem],
        product: spinner,
      }),
    );

    expect(html).toContain(">Spinner</legend>");
    expect(html).toContain(">Button</legend>");
    expect(html.match(/<fieldset/g)).toHaveLength(2);
  });

  it("offers only available slider components and restores the installed assembly", () => {
    const slider = {
      ...productFixture(3000, "Slider", "slider"),
      magnetSystem: "insert-driven" as const,
    };
    const plate = productFixture(3001, "Plate", "slider-plate");
    const insert = productFixture(3002, "Insert", "slider-insert");
    const sliderItem = {
      ...collectionFixture(30, slider, 3001),
      installedPlateId: 31,
    };
    const plateItem = collectionFixture(31, plate, 3002);
    const insertItem = collectionFixture(32, insert, 3003);
    const busyPlate = {
      ...collectionFixture(33, plate, 3004),
      displayName: "Busy plate",
      installedOnSliderId: 999,
    };

    const html = renderToStaticMarkup(
      createElement(CollectionEditPage, {
        buttonProducts: [],
        collections: [],
        item: sliderItem,
        options: emptyCatalogOptions,
        ownedButtons: [],
        ownedSliderComponents: [plateItem, insertItem, busyPlate],
        product: slider,
      }),
    );

    expect(html).toContain("Installed plate");
    expect(html).toContain("Installed insert");
    expect(html).toContain("Plate");
    expect(html).not.toContain("Busy plate");
  });

  it("offers live defaults, exact offers, and custom owned insert setups", () => {
    const insert = {
      ...productFixture(3100, "Setup insert", "slider-insert"),
      insertClickOptions: [
        { clickCount: 3, id: 4100, insertionPosition: 0 },
        { clickCount: 5, id: 4101, insertionPosition: 1 },
      ],
      insertMagnetOffers: [
        {
          clickCount: 5,
          clickOptionId: 4101,
          configuration: {
            groups: [],
            label: "Catalog layout",
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
          },
          copiedFromTemplateId: null,
          id: 4200,
          insertProductId: 3100,
          isAdvertisedDefault: true,
        },
      ],
    };
    const html = renderToStaticMarkup(
      createElement(CollectionEditPage, {
        buttonProducts: [],
        collections: [],
        item: {
          ...collectionFixture(41, insert, 3101),
          ownedInsertSetup: {
            clickCount: 3,
            configuration: null,
            sourceOfferId: null,
          },
        },
        options: emptyCatalogOptions,
        ownedButtons: [],
        product: insert,
      }),
    );

    expect(html).toContain("web.slider.setup.default");
    expect(html).toContain("web.slider.setup.selectOffer");
    expect(html).toContain("web.slider.setup.fromScratch");
    expect(html).toContain("web.slider.setup.clickCount");
    expect(html.indexOf(">3<")).toBeLessThan(html.indexOf(">5<"));
  });

  it("clears a linked click option after any layout edit", () => {
    expect(
      ownedInsertSetupAfterLayoutChange(
        {
          clickOptionId: 4101,
          configuration: null,
          sourceOfferId: 4200,
        },
        {
          groups: [],
          label: "Observed",
          slots: [],
          sourceLabel: null,
          sourceNotes: null,
        },
      ),
    ).toMatchObject({
      clickOptionId: null,
      sourceOfferId: 4200,
    });
  });
});

describe("collection edit submission", () => {
  it("allows pending images to upload without valid legacy details", () => {
    expect(collectionEditSubmissionMode(false, 0)).toBe("disabled");
    expect(collectionEditSubmissionMode(false, 3)).toBe("upload");
    expect(collectionEditSubmissionMode(true, 0)).toBe("save");
  });
});

describe("collection item deletion", () => {
  it("shows one confirmed deletion control to owners and authorized staff", () => {
    const product = productFixture(1008, "Delete me", "spinner");
    const item = collectionFixture(40, product, 1009);
    const props = {
      buttonProducts: [],
      collections: [],
      options: emptyCatalogOptions,
      ownedButtons: [],
      product,
    };
    const ownerHtml = renderToStaticMarkup(
      createElement(CollectionEditPage, {
        ...props,
        item: { ...item, isOwner: true },
      }),
    );
    const adminHtml = renderToStaticMarkup(
      createElement(CollectionEditPage, {
        ...props,
        item: {
          ...item,
          canAdminister: true,
          isOwner: false,
        },
      }),
    );
    const strangerHtml = renderToStaticMarkup(
      createElement(CollectionEditPage, {
        ...props,
        item: { ...item, canEdit: false, isOwner: false },
      }),
    );

    expect(ownerHtml.match(/>Permanently delete item<\/button>/g)).toHaveLength(
      2,
    );
    expect(ownerHtml).not.toContain("Reason");
    expect(adminHtml).toContain("Permanently delete item");
    expect(adminHtml).toContain('maxLength="1000"');
    expect(strangerHtml).not.toContain("Permanently delete item");
  });
});

describe("product form conditional fields", () => {
  it.each([
    "spinner",
    "spinner-button",
  ] as const)("renders spinner-only fields correctly for %s add and edit forms", (productTypeSlug) => {
    const product = productFixture(1005, "Test product", productTypeSlug);
    const props = {
      options: {
        ...emptyCatalogOptions,
        productTypes: [
          {
            id: product.productTypeId,
            name: product.productTypeName,
            slug: productTypeSlug,
          },
        ],
      },
      productTypeSlug,
    };
    const addHtml = renderToStaticMarkup(createElement(ProductEditor, props));
    const editHtml = renderToStaticMarkup(
      createElement(ProductEditor, { ...props, initialProduct: product }),
    );

    for (const html of [addHtml, editHtml]) {
      expect(html).toContain("lg:grid-cols-2");
      expect(html).toContain("lg:col-span-2");
      expect(html).toContain(">Cancel</button>");
      expect(html).toContain("0 / 5,000 characters");
      if (productTypeSlug === "spinner") {
        expect(html).toContain('aria-label="Bearing"');
        expect(html).toContain('aria-label="Spin diameter"');
      } else {
        expect(html).not.toContain('aria-label="Bearing"');
        expect(html).not.toContain('aria-label="Spin diameter"');
      }
    }
  });

  it.each([
    "slider",
    "slider-plate",
    "slider-insert",
  ] as const)("renders exhaustive slider catalog fields for %s", (productTypeSlug) => {
    const product = productFixture(1010, "Slider product", productTypeSlug);
    const relationshipProduct = productFixture(
      1011,
      "Matched plates",
      "slider-plate",
    );
    const html = renderToStaticMarkup(
      createElement(ProductEditor, {
        initialProduct: product,
        options: {
          ...emptyCatalogOptions,
          compatibilityFamilies: [
            {
              id: 3000,
              makerId: product.makerId,
              makerName: product.makerName,
              name: "Rail 50",
              slug: "rail-50",
            },
          ],
          makers: [
            {
              description: null,
              id: product.makerId,
              images: [],
              name: product.makerName,
              rootUrl: null,
              slug: "slider-maker",
            },
          ],
          productTypes: [
            {
              id: product.productTypeId,
              name: product.productTypeName,
              slug: productTypeSlug,
            },
          ],
          relationshipProducts: [relationshipProduct],
        },
        productTypeSlug,
      }),
    );

    expect(html).toContain("Compatibility families");
    expect(html).toContain("Reviewed advisory");
    expect(html).toContain("Maker terminology");
    expect(html).toContain("Add terminology alias");
    expect(html).toContain('aria-label="Length"');
    expect(html).not.toContain('aria-label="Diameter"');
    if (productTypeSlug === "slider") {
      expect(html).toContain('aria-label="Magnet host"');
      expect(html).toContain('aria-label="Weight basis"');
      expect(html).toContain('aria-label="Click count"');
      expect(html).toContain("Magnet configuration");
      expect(html).toContain("Included components");
    } else {
      expect(html).toContain(
        "Plate and insert measurements and weight describe the complete matched set.",
      );
      expect(html).not.toContain('aria-label="Magnet host"');
      expect(html).not.toContain("Included components");
      if (productTypeSlug === "slider-insert") {
        expect(html).toContain("Available insert setups");
      }
    }
  });
});

describe("collection edit conditional fields", () => {
  it.each([
    "spinner",
    "spinner-button",
  ] as const)("renders the bearing override correctly for %s items", (productTypeSlug) => {
    const product = productFixture(1006, "Test product", productTypeSlug);
    const item = collectionFixture(30, product, 1007);
    item.images = [
      {
        contentType: "image/webp",
        createdAt: new Date(0),
        deletedAt: null,
        deletedByClerkId: null,
        deletedByRole: null,
        fileName: `${"long-name-".repeat(20)}.webp`,
        id: 1008,
        objectPath: "collections/1000/long-name.webp",
        position: 0,
        size: 1024,
        url: "https://cdn.test/long-name.webp",
      },
    ];
    const html = renderToStaticMarkup(
      createElement(CollectionEditPage, {
        buttonProducts: [],
        collections: [],
        item,
        options: emptyCatalogOptions,
        ownedButtons: [],
        product,
      }),
    );

    if (productTypeSlug === "spinner") {
      expect(html).toContain('aria-label="Bearing"');
    } else {
      expect(html).not.toContain('aria-label="Bearing"');
    }
    expect(html).toContain("max-w-6xl");
    expect(html).toContain("lg:grid-cols-2");
    expect(html).toContain("lg:col-span-2");
    expect(html).toContain(">Cancel</button>");
    expect(html).toContain("flex min-w-0 items-center");
    expect(html).toContain("min-w-0 flex-1 truncate");
    expect(html).toContain("0 / 5,000 characters");
  });
});

describe("collection add form", () => {
  it.each([
    undefined,
    9999,
  ])("retains product selection without a valid preselected product (%s)", (initialProductId) => {
    const html = renderToStaticMarkup(
      createElement(CollectionAddPage, {
        collections: [],
        defaultCollectionName: null,
        initialProductId,
        options: emptyCatalogOptions,
        products: [],
      }),
    );
    expect(html).toContain('aria-label="Product type"');
    expect(html).toMatch(/<details[^>]* open=""/u);
  });

  it("renders localized collection copy and a disabled primary action", () => {
    const product = productFixture(1003, "Zoom Zoom", "spinner");
    const html = renderToStaticMarkup(
      createElement(CollectionAddPage, {
        collections: [
          {
            coverImage: null,
            coverImages: [],
            createdAt: new Date(0),
            description: null,
            id: 1000,
            isAdminPrivate: false,
            isPrivate: false,
            itemCount: 0,
            name: "Test collection",
            ownerUserId: 1,
            updatedAt: new Date(0),
          },
        ],
        defaultCollectionName: null,
        initialProductId: product.id,
        options: {
          ...emptyCatalogOptions,
          productTypes: [{ id: 1, name: "Spinner", slug: "spinner" }],
        },
        products: [product],
      }),
    );

    expect(html).not.toContain("Something went wrong");
    expect(html).toContain('aria-label="Product type"');
    expect(html).toContain(">Zoom Zoom</span>");
    expect(html).toMatch(/<details[^>]*>/u);
    expect(html).not.toMatch(/<details[^>]* open=/u);
    expect(html).toMatch(/<summary[^>]*>Products<\/summary>/u);
    expect(html).toContain(">Collection<");
    expect(html).toContain(">Add new collection<");
    expect(html).toContain(">Add to collection<");
    expect(html).toContain("disabled");
    expect(html).toContain(
      'id="collection-item-description-label">Description',
    );
    expect(html).toContain("0 / 5,000 characters");
    expect(html).not.toContain('maxlength="5000"');
    expect(html).toContain('aria-label="Bearing"');
    expect(html).toContain("border-input bg-background");
    expect(html).toContain("focus-visible:ring-ring");
  });

  it("does not offer a bearing override for a button", () => {
    const product = productFixture(1004, "Button", "spinner-button");
    const html = renderToStaticMarkup(
      createElement(CollectionAddPage, {
        collections: [],
        defaultCollectionName: "Tester's Collection",
        initialProductId: product.id,
        options: {
          ...emptyCatalogOptions,
          productTypes: [
            { id: 2, name: "Spinner button", slug: "spinner-button" },
          ],
        },
        products: [product],
      }),
    );

    expect(html).toContain(
      'id="collection-item-description-label">Description',
    );
    expect(html).not.toContain('aria-label="Bearing"');
  });

  it.each([
    "slider",
    "slider-plate",
    "slider-insert",
  ] as const)("offers standalone %s collection items without spinner-only controls", (productTypeSlug) => {
    const product = productFixture(1100, "Slider product", productTypeSlug);
    const html = renderToStaticMarkup(
      createElement(CollectionAddPage, {
        collections: [],
        defaultCollectionName: "Tester's Collection",
        initialProductId: product.id,
        options: {
          ...emptyCatalogOptions,
          productTypes: [
            {
              id: product.productTypeId,
              name: product.productTypeName,
              slug: productTypeSlug,
            },
          ],
        },
        products: [product],
      }),
    );

    expect(html).toContain("Slider product");
    expect(html).not.toContain("Unsupported product type");
    expect(html).not.toContain('aria-label="Bearing"');
    expect(html).not.toContain('aria-label="Button"');
  });

  it("presents included slider components as explicit suggestions only", () => {
    const product = {
      ...productFixture(1200, "Suggested slider", "slider"),
      includedComponents: [
        {
          id: 1201,
          name: "Suggested plate",
          productTypeSlug: "slider-plate" as const,
          slug: "suggested-plate",
        },
        {
          id: 1202,
          name: "Suggested insert",
          productTypeSlug: "slider-insert" as const,
          slug: "suggested-insert",
        },
      ],
    };
    const html = renderToStaticMarkup(
      createElement(CollectionAddPage, {
        collections: [],
        defaultCollectionName: "Tester's Collection",
        initialProductId: product.id,
        options: {
          ...emptyCatalogOptions,
          productTypes: [
            {
              id: product.productTypeId,
              name: product.productTypeName,
              slug: "slider",
            },
          ],
        },
        products: [product],
      }),
    );

    expect(html).toContain(
      "Included components describe what is sold with this product. They do not create collection items.",
    );
    expect(html).toContain("Suggested plate");
    expect(html).toContain("Suggested insert");
  });
});

/**
 * Creates a catalog product fixture.
 *
 * @param id - Product identifier.
 * @param name - Product name.
 * @param productTypeSlug - Product type slug.
 * @returns The catalog product fixture.
 */
function productFixture(
  id: number,
  name: string,
  productTypeSlug: CatalogProductType,
): CatalogProduct {
  return {
    approvalStatus: "approved",
    advertisedInsertOffers: [],
    bearing: null,
    bodyHostedMagnetSetup:
      productTypeSlug === "slider"
        ? { clickCount: null, configuration: null, sourceNote: null }
        : null,
    insertClickOptions: [],
    insertMagnetOffers: [],
    buttonDiameterMm: null,
    canAdminister: false,
    canEdit: true,
    compatibleButtonId: null,
    compatibleButtonName: null,
    compatibilityAdvisories: [],
    compatibilityFamilies: [],
    createdAt: new Date(0),
    description: null,
    diameterMm: null,
    finishOptions: [
      {
        colorEffect: null,
        colors: [],
        finishes: [{ id: id + 2, name: "Polished", slug: "polished" }],
        id: id + 3,
        pattern: null,
      },
    ],
    imageCount: 0,
    images: [],
    includedComponents: [],
    id,
    lengthMm: null,
    makerId: 1,
    makerName: "Maker",
    makerSlug: "maker",
    makerProductUrl: null,
    makerProductUrlValid: true,
    makerUrl: null,
    magnetSystem: productTypeSlug === "slider" ? "body-hosted" : null,
    materials: [{ id: id + 1, name: "Bronze", slug: "bronze" }],
    name,
    ownerClerkId: "user_test",
    isAdminPrivate: false,
    isPrivate: false,
    productTypeId: 1,
    productTypeName: {
      slider: "Slider",
      "slider-insert": "Slider Insert",
      "slider-plate": "Slider Plate",
      spinner: "Spinner",
      "spinner-button": "Button",
    }[productTypeSlug],
    productTypeSlug,
    slug: name.toLowerCase(),
    spinDiameterMm: null,
    thicknessMm: null,
    thicknessWithButtonMm: null,
    updatedAt: new Date(0),
    weightG: null,
    weightBasis: null,
    widthMm: null,
  };
}

/**
 * Creates a collection item fixture for a catalog product.
 *
 * @param collectionItemId - Collection item identifier.
 * @param product - Source catalog product.
 * @param sourceProductFinishOptionId - Source finish option identifier.
 * @returns The collection item fixture.
 */
function collectionFixture(
  collectionItemId: number,
  product: CatalogProduct,
  sourceProductFinishOptionId: number,
): UserCollectionItem {
  return {
    approvalStatus: "approved",
    bearing: null,
    bearingOverride: null,
    canAdminister: false,
    canEdit: true,
    collectionId: 1000,
    collectionItemId,
    collectionIsPrivate: false,
    collectionName: "Test collection",
    displayName: product.name,
    description: null,
    descriptionOverride: null,
    finishOption: product.finishOptions[0] ?? null,
    imageCount: 0,
    images: [],
    hasGrandfatheredInstallation: false,
    effectiveSliderSetup: null,
    isAdminPrivate: false,
    isPrivate: false,
    installedButtonId: null,
    installedInsertId: null,
    installedOnSliderId: null,
    installedPlateId: null,
    makerId: product.makerId,
    makerName: product.makerName,
    makerSlug: product.makerSlug,
    makerUrl: product.makerUrl,
    material: product.materials[0] ?? null,
    name: product.name,
    ownedInsertSetup: null,
    ownerClerkId: "user_test",
    ownerUsername: "tester",
    ownerUserId: 1,
    productId: product.id,
    productSlug: product.slug,
    productTypeName: product.productTypeName,
    productTypeSlug: product.productTypeSlug,
    productImages: [],
    sourceProductFinishOptionId,
  };
}
