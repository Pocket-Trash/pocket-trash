import type { CatalogProduct } from "@package/services";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  CollectionProductFields,
  FinishOptionsEditor,
} from "./catalog-form-pages";

const t = (key: string, values: Readonly<Record<string, unknown>> = {}) =>
  key === "web.catalog.finishPreview" ? String(values.finish) : key;

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
      id: 1000,
      lengthMm: null,
      makerId: 1000,
      makerName: "Maker",
      materials: [{ id: 1000, name: "Bronze", slug: "bronze" }],
      name: "Spinner",
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
        finish: { id: 1002, name: "Polished" },
        material: product.materials[0] ?? null,
        onFinishChange: vi.fn(),
        onMaterialChange: vi.fn(),
        product,
        t,
      }),
    );

    expect(html).toContain('aria-label="web.catalog.field.materials"');
    expect(html).toContain('aria-label="web.action.close: Bronze"');
    expect(html).toContain('aria-label="web.action.close: Polished"');
  });
});
