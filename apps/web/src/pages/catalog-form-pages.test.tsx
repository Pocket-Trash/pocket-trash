import type { CatalogProduct, UserCollectionItem } from "@package/services";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  CollectionEditPage,
  CollectionProductFields,
  FinishOptionsEditor,
} from "./catalog-form-pages";

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("@clerk/tanstack-react-start", () => ({
  useAuth: () => ({ getToken: vi.fn() }),
}));

vi.mock("@/components/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock("@/providers/locale-provider", () => ({
  useLocale: () => ({ locale: "en-US" }),
}));

const t = (key: string, values: Readonly<Record<string, unknown>> = {}) =>
  key === "web.catalog.finishPreview" ? String(values.finish) : key;
const emptyCustomFinish = {
  colorEffectId: null,
  colorEffectSlug: null,
  colorIds: [],
  finishIds: [],
};
const emptyCatalogOptions = {
  colorEffects: [],
  colors: [],
  finishes: [],
  makers: [],
  materials: [],
  productTypes: [],
  spinnerButtons: [],
};

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
          colors: [
            { id: 1000, name: "Blue", slug: "blue" },
            { id: 1001, name: "Purple", slug: "purple" },
          ],
          finishes: [{ id: 1000, name: "Anodized", slug: "anodized" }],
          makers: [],
          materials: [],
          productTypes: [],
          spinnerButtons: [],
        },
        t,
        value: [
          {
            colorEffectId: 1001,
            colorEffectSlug: "fade",
            colorIds: [1000, 1001],
            finishIds: [1000],
          },
        ],
      }),
    );

    expect(html).toContain('aria-label="web.catalog.field.finishes"');
    expect(html).toContain('aria-label="web.action.close: Anodized"');
    expect(html).toContain('aria-label="web.action.close: Blue"');
    expect(html).toContain("web.action.moveFinishOptionUp");
    expect(html).toContain("web.action.moveFinishOptionDown");
    expect(html).toContain("web.action.removeFinishOption");
    expect(html).toContain(
      "Anodized · Blue → Purple web.catalog.colorEffect.fade",
    );
  });

  it("renders the owned material and product finish choices", () => {
    const product: CatalogProduct = {
      buttonDiameterMm: null,
      canAdminister: false,
      canEdit: true,
      compatibleButtonId: null,
      compatibleButtonName: null,
      createdAt: new Date(0),
      diameterMm: null,
      finishOptions: [
        {
          colorEffect: null,
          colors: [],
          finishes: [{ id: 1001, name: "Polished", slug: "polished" }],
          id: 1002,
        },
      ],
      imageCount: 0,
      images: [],
      id: 1000,
      lengthMm: null,
      makerId: 1000,
      makerName: "Maker",
      materials: [{ id: 1000, name: "Bronze", slug: "bronze" }],
      name: "Spinner",
      ownerClerkId: "user_test",
      isAdminPrivate: false,
      isPrivate: false,
      productTypeId: 1000,
      productTypeName: "Spinner",
      productTypeSlug: "spinner",
      slug: "spinner",
      thicknessMm: null,
      thicknessWithButtonMm: null,
      updatedAt: new Date(0),
      weightG: null,
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
});

function productFixture(
  id: number,
  name: string,
  productTypeSlug: "spinner" | "spinner-button",
): CatalogProduct {
  return {
    buttonDiameterMm: null,
    canAdminister: false,
    canEdit: true,
    compatibleButtonId: null,
    compatibleButtonName: null,
    createdAt: new Date(0),
    diameterMm: null,
    finishOptions: [
      {
        colorEffect: null,
        colors: [],
        finishes: [{ id: id + 2, name: "Polished", slug: "polished" }],
        id: id + 3,
      },
    ],
    imageCount: 0,
    images: [],
    id,
    lengthMm: null,
    makerId: 1,
    makerName: "Maker",
    materials: [{ id: id + 1, name: "Bronze", slug: "bronze" }],
    name,
    ownerClerkId: "user_test",
    isAdminPrivate: false,
    isPrivate: false,
    productTypeId: 1,
    productTypeName: productTypeSlug === "spinner" ? "Spinner" : "Button",
    productTypeSlug,
    slug: name.toLowerCase(),
    thicknessMm: null,
    thicknessWithButtonMm: null,
    updatedAt: new Date(0),
    weightG: null,
    widthMm: null,
  };
}

function collectionFixture(
  collectionItemId: number,
  product: CatalogProduct,
  sourceProductFinishOptionId: number,
): UserCollectionItem {
  return {
    canAdminister: false,
    canEdit: true,
    collectionId: 1000,
    collectionItemId,
    collectionIsPrivate: false,
    collectionName: "Test collection",
    finishOption: product.finishOptions[0] ?? null,
    imageCount: 0,
    images: [],
    isAdminPrivate: false,
    isPrivate: false,
    installedButtonId: null,
    makerId: product.makerId,
    makerName: product.makerName,
    material: product.materials[0] ?? null,
    name: product.name,
    ownerClerkId: "user_test",
    ownerUserId: 1,
    productId: product.id,
    productTypeName: product.productTypeName,
    productTypeSlug: product.productTypeSlug as "spinner" | "spinner-button",
    productImages: [],
    sourceProductFinishOptionId,
  };
}
