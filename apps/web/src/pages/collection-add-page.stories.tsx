import type { CatalogProduct } from "@package/services";
import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, within } from "storybook/test";
import { mockStoryAuth, StoryProviders } from "../../.storybook/story-fixtures";
import { CollectionAddPage } from "./catalog-form-pages";

/** Catalog product used by the chooser interaction stories. */
const product: CatalogProduct = {
  aliases: [],
  approvalStatus: "approved",
  bearing: null,
  buttonDiameter: null,
  clickCount: null,
  canAdminister: false,
  canEdit: true,
  compatibleButtonId: null,
  compatibleButtonName: null,
  compatiblePens: [],
  configurationSlots: [],
  createdAt: new Date(0),
  description: null,
  diameter: null,
  finishOptions: [
    {
      colorEffect: null,
      colors: [],
      finishes: [{ id: 1002, name: "Polished", slug: "polished" }],
      id: 1003,
      pattern: null,
    },
  ],
  imageCount: 0,
  images: [],
  includedInsert: null,
  includedPlate: null,
  id: 1000,
  length: null,
  makerId: 1,
  makerName: "Maker",
  makerSlug: "maker",
  makerProductUrl: null,
  makerProductUrlValid: true,
  makerUrl: null,
  magnetLayout: null,
  usesInserts: null,
  materials: [
    {
      assignmentId: 1001,
      specific: null,
      id: 1001,
      name: "Bronze",
      slug: "bronze",
    },
  ],
  name: "Product 1",
  refillModel: null,
  refillOfferings: [],
  ownerClerkId: "user_test",
  isAdminPrivate: false,
  isPrivate: false,
  productTypeId: 1,
  productTypeName: "Spinner",
  productTypeSlug: "spinner",
  slug: "product-1",
  spinDiameter: null,
  thickness: null,
  thicknessWithButton: null,
  updatedAt: new Date(0),
  weight: null,
  width: null,
};

/** Thirteen products exercise a full first page and a final partial page. */
const products: CatalogProduct[] = [
  ...Array.from({ length: 13 }, (_, index) => ({
    ...product,
    id: 1000 + index,
    name: `Product ${index + 1}`,
    images:
      index === 1
        ? []
        : [
            {
              contentType: "image/svg+xml",
              createdAt: new Date(0),
              deletedAt: null,
              deletedByClerkId: null,
              deletedByRole: null,
              fileName: "product.svg",
              id: 2000 + index,
              objectPath: "storybook/product.svg",
              position: 0,
              size: 100,
              url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Crect width='400' height='300' fill='%233178c6'/%3E%3C/svg%3E",
            },
          ],
  })),
  {
    ...product,
    id: 2000,
    name: "Button product",
    productTypeId: 2,
    productTypeName: "Spinner button",
    productTypeSlug: "spinner-button",
  },
  {
    ...product,
    clickCount: 3,
    id: 3000,
    includedInsert: null,
    includedPlate: {
      id: 3001,
      name: "Included plate",
      productTypeSlug: "slider-plate",
      slug: "included-plate",
    },
    magnetLayout: "2x4",
    usesInserts: false,
    name: "Standalone slider",
    productTypeId: 3,
    productTypeName: "Slider",
    productTypeSlug: "slider",
  },
  {
    ...product,
    configurationSlots: [
      {
        choices: [
          {
            availableWhen: [],
            finishOptionId: null,
            id: 4002,
            label: "Aluminum body",
            productMaterialId: 4002,
          },
          {
            availableWhen: [],
            finishOptionId: null,
            id: 4003,
            label: "Titanium body",
            productMaterialId: 4003,
          },
        ],
        id: 4001,
        labelFallback: "Body material",
        labelKey: "catalog.pen.configurationSlot.bodyMaterial",
        required: true,
      },
      {
        choices: [
          {
            availableWhen: [[4002]],
            finishOptionId: null,
            id: 4005,
            label: "Needle tip",
            partProductId: 4004,
          },
        ],
        id: 4004,
        labelFallback: "Tip",
        labelKey: "catalog.pen.configurationSlot.tip",
        required: true,
      },
    ],
    id: 4000,
    materials: [],
    name: "Configurable pen",
    productTypeId: 4,
    productTypeName: "Pen",
    productTypeSlug: "pen",
    slug: "configurable-pen",
  },
  {
    ...product,
    compatiblePens: [
      {
        id: 4000,
        name: "Configurable pen",
        outcome: "conditional",
        requiredTipName: "Needle tip",
        requiredTipProductId: 4004,
        slug: "configurable-pen",
      },
    ],
    id: 5000,
    materials: [],
    name: "Compatible refill",
    productTypeId: 5,
    productTypeName: "Refill",
    productTypeSlug: "refill",
    refillModel: "RF-05",
    refillOfferings: [
      {
        id: 5001,
        inkColor: "Black",
        tipSize: "0.5 mm",
        tipStyle: "Needle",
      },
    ],
    slug: "compatible-refill",
  },
  {
    ...product,
    id: 5002,
    materials: [],
    name: "Other refill",
    productTypeId: 5,
    productTypeName: "Refill",
    productTypeSlug: "refill",
    refillModel: "OTHER-05",
    refillOfferings: [],
    slug: "other-refill",
  },
];

/** Collection form fixtures and the standard app providers. */
const meta = {
  args: {
    collections: [],
    defaultCollectionName: null,
    initialProductId: 1000,
    options: {
      colorEffects: [],
      colors: [],
      finishes: [],
      makers: [],
      mechanisms: [],
      materials: [],
      patterns: [],
      relationshipProducts: [],
      spinnerButtons: [],
      productTypes: [
        {
          id: 1,
          isPartOrAccessory: false,
          name: "Spinner",
          slug: "spinner",
        },
        {
          id: 2,
          isPartOrAccessory: true,
          name: "Spinner button",
          slug: "spinner-button",
        },
        {
          id: 3,
          isPartOrAccessory: false,
          name: "Slider",
          slug: "slider",
        },
        {
          id: 4,
          isPartOrAccessory: false,
          name: "Pen",
          slug: "pen",
        },
      ],
    },
    products,
  },
  beforeEach: mockStoryAuth,
  component: CollectionAddPage,
  decorators: [
    (Story) => (
      <StoryProviders>
        <Story />
      </StoryProviders>
    ),
  ],
  parameters: { layout: "fullscreen" },
  title: "Components/CollectionAddPage",
} satisfies Meta<typeof CollectionAddPage>;

export default meta;
/** Collection product chooser story contract. */
type Story = StoryObj<typeof meta>;

/** Collapsed chooser with browser coverage for paging, searching, and selection. */
export const Preselected: Story = {
  /**
   * Verifies the native disclosure and product chooser interactions.
   *
   * @param context - Story interaction context.
   * @param context.canvas - Rendered story queries.
   * @param context.userEvent - Browser interaction driver.
   * @returns A promise that resolves after chooser assertions pass.
   */
  play: async ({ canvas, userEvent }) => {
    const chooser = canvas.getByText("Products", { selector: "summary" });
    await expect(
      canvas.getByRole("button", { name: "Product 1" }),
    ).not.toBeVisible();
    await userEvent.click(chooser);
    const first = canvas.getByRole("button", {
      name: "Product 1",
    });
    await expect(first).toBeVisible();
    await expect(first).toHaveAttribute("aria-pressed", "true");
    await expect(first.querySelector("img")).toBeVisible();
    await expect(first.querySelector("img")?.parentElement).toHaveClass(
      "aspect-4/3",
    );
    await expect(
      canvas.getAllByRole("button", { name: /^Product \d+$/u }),
    ).toHaveLength(12);
    await expect(
      canvas.getByRole("button", { name: "Previous page" }),
    ).toBeDisabled();
    await userEvent.click(canvas.getByRole("button", { name: "Next page" }));
    await expect(canvas.getByText("Page 2 of 2")).toBeVisible();
    await expect(
      canvas.getAllByRole("button", { name: /^Product \d+$/u }),
    ).toHaveLength(1);
    await expect(
      canvas.getByRole("button", { name: "Next page" }),
    ).toBeDisabled();
    await userEvent.click(canvas.getByRole("button", { name: "Product 13" }));
    await expect(canvas.getByLabelText("Display name")).toHaveValue(
      "Product 13",
    );
    const search = canvas.getByRole("searchbox", { name: "Search" });
    await userEvent.type(search, "product 2");
    await expect(canvas.getByText("Page 1 of 1")).toBeVisible();
    const second = canvas.getByRole("button", {
      name: "Product 2",
    });
    await expect(within(second).queryByRole("img")).toBeNull();
    await userEvent.click(second);
    await expect(canvas.getByLabelText("Display name")).toHaveValue(
      "Product 2",
    );
    await expect(second).toHaveAttribute("aria-pressed", "true");
    await userEvent.clear(search);
    await userEvent.type(search, "no match");
    await expect(
      canvas.getByText("No items match these filters."),
    ).toBeVisible();
    await expect(
      canvas.queryByRole("button", { name: /^Product \d+$/u }),
    ).toBeNull();
    await userEvent.click(
      canvas.getByRole("combobox", { name: "Product type" }),
    );
    await userEvent.click(
      await within(chooser.ownerDocument.body).findByRole("option", {
        name: "Spinner button",
      }),
    );
    await expect(search).toHaveValue("");
    await expect(
      canvas.getByRole("button", { name: "Button product" }),
    ).toBeVisible();
    await expect(canvas.getByText("Page 1 of 1")).toBeVisible();
    await userEvent.click(chooser);
    await expect(search).not.toBeVisible();
  },
};

/** Standalone slider creation without spinner-only controls. */
export const StandaloneSlider: Story = {
  args: { initialProductId: 3000 },
};

/** Direct visits retain the open product-type chooser. */
export const DirectVisit: Story = { args: { initialProductId: undefined } };
/** Unknown product identifiers retain the open product-type chooser. */
export const UnknownProduct: Story = { args: { initialProductId: 9999 } };

/** Configurable Pen selections remain intact when an earlier choice makes them unsupported. */
export const ConfigurablePen: Story = {
  args: { initialProductId: 4000 },
  /**
   * Verifies serial-number controls, configuration warnings, refill ordering, and offerings.
   *
   * @param context - Story interaction context.
   * @param context.canvas - Rendered story queries.
   * @param context.canvasElement - Story canvas root.
   * @param context.userEvent - Browser interaction driver.
   * @returns A promise that resolves after the Pen assertions pass.
   */
  play: async ({ canvas, canvasElement, userEvent }) => {
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      canvas.getByRole("checkbox", {
        name: /serial|web\.collections\.serial\.hasSerialNumber/iu,
      }),
    );
    await expect(
      canvas.getByRole("textbox", {
        name: /serial number|web\.collections\.field\.serialNumber/iu,
      }),
    ).toBeVisible();

    const body = canvas.getByRole("combobox", {
      name: /body material|configurationSlot\.bodyMaterial/iu,
    });
    await userEvent.click(body);
    await userEvent.click(
      await page.findByRole("option", { name: "Aluminum body" }),
    );
    const tip = canvas.getByRole("combobox", {
      name: /^tip$|configurationSlot\.tip/iu,
    });
    await userEvent.click(tip);
    await userEvent.click(
      await page.findByRole("option", { name: "Needle tip" }),
    );

    await userEvent.click(body);
    await userEvent.click(
      await page.findByRole("option", { name: "Titanium body" }),
    );
    await expect(tip).toHaveValue("Needle tip");
    await expect(
      canvas.getByText(/not supported|web\.pens\.collection\.notSupported/iu),
    ).toBeVisible();

    const refill = canvas.getByRole("combobox", {
      name: /refill$|web\.pens\.collection\.refill/iu,
    });
    await userEvent.click(refill);
    const refillOptions = await page.findAllByRole("option");
    await expect(refillOptions[0]).toHaveAccessibleName("Compatible refill");
    await userEvent.click(
      page.getByRole("option", { name: /compatible refill/iu }),
    );
    await expect(
      canvas.getByRole("combobox", {
        name: /refill offering|web\.pens\.collection\.refillOffering/iu,
      }),
    ).toBeVisible();
    await userEvent.keyboard("{Escape}");
  },
};
