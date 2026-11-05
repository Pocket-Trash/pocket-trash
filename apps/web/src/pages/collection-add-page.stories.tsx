import type { CatalogProduct } from "@package/services";
import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, fn, within } from "storybook/test";
import { mockStoryAuth, StoryProviders } from "../../.storybook/story-fixtures";
import { CollectionAddPage } from "./catalog-form-pages";
import { collectionFixture, productFixture } from "./catalog-test-fixtures";

/** Product-type image metadata used by collection stories. */
const productTypeImage = {
  imageAlt: "No image set",
  imageUrl: "https://cdn.pocket-trash.app/assets/static/no-image.png",
} as const;

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
  refillCompatibility: [],
  compatibleParts: [],
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
  productLinks: [],
  makerUrl: null,
  magnetLayout: null,
  usesInserts: null,
  materials: [
    {
      assignmentId: 1001,
      weight: null,
      materials: [{ specific: null, id: 1001, name: "Bronze", slug: "bronze" }],
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
    finishOptions:
      index === 1
        ? [
            ...product.finishOptions,
            {
              colorEffect: null,
              colors: [],
              finishes: [{ id: 1014, name: "Blasted", slug: "blasted" }],
              id: 1015,
              pattern: null,
            },
          ]
        : product.finishOptions,
    id: 1000 + index,
    name: `Product ${index + 1}`,
    materials:
      index === 1
        ? [
            ...product.materials,
            {
              assignmentId: 1016,
              weight: null,
              materials: [
                {
                  id: 1016,
                  name: "Steel",
                  slug: "steel",
                  specific: null,
                },
              ],
            },
          ]
        : product.materials,
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
    compatibleParts: [],
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
        slug: "configurable-pen",
      },
    ],
    refillCompatibility: [],
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
          id: 5,
          ...productTypeImage,
          isPartOrAccessory: true,
          name: "Pen Actuator",
          slug: "pen-actuator",
        },
        {
          id: 1,
          ...productTypeImage,
          isPartOrAccessory: false,
          name: "Spinner",
          slug: "spinner",
        },
        {
          id: 2,
          ...productTypeImage,
          isPartOrAccessory: true,
          name: "Spinner button",
          slug: "spinner-button",
        },
        {
          id: 3,
          ...productTypeImage,
          isPartOrAccessory: false,
          name: "Slider",
          slug: "slider",
        },
        {
          id: 4,
          ...productTypeImage,
          isPartOrAccessory: false,
          name: "Pen",
          slug: "pen",
        },
      ],
    },
    products,
  },
  /**
   * Installs authenticated fixtures and confirms intentional product replacements.
   * @returns Cleanup restoring the native confirmation dialog.
   */
  beforeEach: async () => {
    await mockStoryAuth();
    const original = window.confirm;
    window.confirm = fn(() => true);
    return () => {
      window.confirm = original;
    };
  },
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
    const chooser = canvas.getByText("Selected product: Product 1 · Spinner", {
      selector: "summary",
    });
    await expect(
      canvas.getByRole("button", { name: "Product 1" }),
    ).not.toBeVisible();
    await expect(
      canvas.getByRole("button", { name: "Close: Bronze" }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: "Close: Polished" }),
    ).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Close: Bronze" }),
    );
    await userEvent.click(chooser);
    await userEvent.click(chooser);
    await expect(
      canvas.queryByRole("button", { name: "Close: Bronze" }),
    ).toBeNull();
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
    await expect(
      canvas.getByRole("button", { name: "Product 13" }),
    ).not.toBeVisible();
    await expect(
      canvas.getByRole("button", { name: "Close: Bronze" }),
    ).toBeVisible();
    await userEvent.click(chooser);
    const search = canvas.getByRole("searchbox", { name: "Search products" });
    await userEvent.type(search, "product 2");
    await expect(canvas.queryByText("Page 1 of 1")).toBeNull();
    const second = canvas.getByRole("button", {
      name: "Product 2",
    });
    await expect(within(second).queryByRole("img")).toBeNull();
    await userEvent.click(second);
    await expect(canvas.getByLabelText("Display name")).toHaveValue(
      "Product 2",
    );
    await expect(second).not.toBeVisible();
    await expect(
      canvas.queryByRole("button", { name: "Close: Bronze" }),
    ).toBeNull();
    await expect(
      canvas.queryByRole("button", { name: "Close: Polished" }),
    ).toBeNull();
    await userEvent.click(chooser);
    await userEvent.clear(search);
    await userEvent.type(search, "no match");
    await expect(
      canvas.getByText(
        "No products match. Try another search or product type.",
      ),
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
    await expect(canvas.queryByText("Page 1 of 1")).toBeNull();
    await expect(canvas.queryByLabelText("Display name")).toBeNull();
    await userEvent.click(
      canvas.getByRole("button", { name: "Button product" }),
    );
    await expect(search).not.toBeVisible();
    await expect(chooser).toHaveFocus();
  },
};

/** Standalone slider creation without spinner-only controls. */
export const StandaloneSlider: Story = {
  args: { initialProductId: 3000 },
};

/** Direct visits retain the open product-type chooser. */
export const DirectVisit: Story = {
  args: { initialProductId: undefined },
  /**
   * Reveals search only after choosing a type, and details only after a product.
   * @param context - Browser interaction context.
   */
  play: async ({ canvas, userEvent, canvasElement }) => {
    await expect(canvas.queryByRole("searchbox")).toBeNull();
    await expect(canvas.queryByLabelText("Display name")).toBeNull();
    await expect(canvas.queryByText("Ownership history")).toBeNull();
    await expect(
      canvas.queryByRole("button", { name: "Next page" }),
    ).toBeNull();
    await userEvent.click(
      canvas.getByRole("combobox", { name: "Product type" }),
    );
    await userEvent.click(
      await within(canvasElement.ownerDocument.body).findByRole("option", {
        name: "Spinner button",
      }),
    );
    await expect(
      canvas.getByRole("searchbox", { name: "Search products" }),
    ).toBeVisible();
    await expect(canvas.queryByLabelText("Display name")).toBeNull();
    await expect(
      canvas.queryByRole("button", { name: "Previous page" }),
    ).toBeNull();
    await expect(
      canvas.queryByRole("button", { name: "Next page" }),
    ).toBeNull();
    await userEvent.click(
      canvas.getByRole("button", { name: "Button product" }),
    );
    await expect(canvas.getByLabelText("Display name")).toHaveValue(
      "Button product",
    );
    await expect(
      canvas.getByText("Selected product: Button product · Spinner button", {
        selector: "summary",
      }),
    ).toHaveFocus();
  },
};
/** Unknown product identifiers retain the open product-type chooser. */
export const UnknownProduct: Story = {
  ...DirectVisit,
  args: { initialProductId: 9999 },
};

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

    const refill = canvas.getByRole("combobox", {
      name: /refill$|web\.pens\.collection\.refill/iu,
    });
    await userEvent.click(refill);
    const refillOptions = await page.findAllByRole("option");
    await expect(refillOptions[0]).toHaveAccessibleName("Compatible refill");
    await expect(refillOptions[1]).toHaveAccessibleName(
      "Other refill Compatibility not recorded for this configuration",
    );
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

/** Removing a new Sold selection discards inactive invalid sold-price validation. */
export const SoldPriceDeselection: Story = {
  args: { defaultCollectionName: "Daily carry" },
  /**
   * Keeps an unsold draft saveable after entering and hiding a sold price.
   * @param context - Rendered form and real browser interactions.
   */
  play: async (context) => {
    await context.userEvent.click(
      context.canvas.getByText("Add price, status, or notes"),
    );
    const publicStatuses = within(
      context.canvas.getByRole("group", { name: "Public status" }),
    );
    const sold = publicStatuses.getByRole("checkbox", { name: "Sold" });
    await context.userEvent.click(sold);
    await context.userEvent.type(
      context.canvas.getByRole("textbox", { name: "Price sold" }),
      "-1",
    );
    await expect(context.canvas.getByRole("alert")).toBeVisible();
    await context.userEvent.click(sold);
    await expect(
      context.canvas.queryByRole("textbox", { name: "Price sold" }),
    ).not.toBeInTheDocument();
    await expect(context.canvas.queryByRole("alert")).not.toBeInTheDocument();
    await expect(
      context.canvas.getByRole("button", { name: /^Add to collection$/ }),
    ).toBeEnabled();
  },
};

/** Empty results have usable search and no pagination after a type is chosen. */
export const NoMatchingProducts: Story = {
  args: { initialProductId: undefined, products: [] },
  /**
   * Shows a genuine empty result rather than an empty pre-type search.
   * @param context - Browser interaction context.
   */
  play: async ({ canvas, canvasElement, userEvent }) => {
    await expect(
      canvas.queryByText(
        "No products match. Try another search or product type.",
      ),
    ).toBeNull();
    await userEvent.click(
      canvas.getByRole("combobox", { name: "Product type" }),
    );
    await userEvent.click(
      await within(canvasElement.ownerDocument.body).findByRole("option", {
        name: "Spinner",
      }),
    );
    await expect(
      canvas.getByText(
        "No products match. Try another search or product type.",
      ),
    ).toBeVisible();
    await expect(
      canvas.getByRole("searchbox", { name: "Search products" }),
    ).toBeEnabled();
    await expect(
      canvas.queryByRole("button", { name: "Next page" }),
    ).toBeNull();
    await expect(
      canvas.queryByRole("button", { name: "Previous page" }),
    ).toBeNull();
  },
};

/** Canceling product replacement preserves edited fields and browsing scope. */
export const PreserveProductEdits: Story = {
  /**
   * Rejects a type change, then explicitly accepts the reset and chooses a product.
   * @param context - Browser interaction context.
   */
  play: async ({ canvas, canvasElement, userEvent }) => {
    const name = canvas.getByLabelText("Display name");
    await userEvent.clear(name);
    await userEvent.type(name, "My daily spinner");
    const chooser = canvas.getByText("Selected product: Product 1 · Spinner", {
      selector: "summary",
    });
    await userEvent.click(chooser);
    const search = canvas.getByRole("searchbox", { name: "Search products" });
    await userEvent.type(search, "Product");
    window.confirm = fn(() => false);
    const type = canvas.getByRole("combobox", { name: "Product type" });
    await userEvent.click(type);
    await userEvent.click(
      await within(canvasElement.ownerDocument.body).findByRole("option", {
        name: "Spinner button",
      }),
    );
    await expect(name).toHaveValue("My daily spinner");
    await expect(type).toHaveValue("Spinner");
    await expect(search).toHaveValue("Product");
    window.confirm = fn(() => true);
    await userEvent.click(type);
    await userEvent.click(
      await within(canvasElement.ownerDocument.body).findByRole("option", {
        name: "Spinner button",
      }),
    );
    await expect(canvas.queryByLabelText("Display name")).toBeNull();
    await expect(search).toHaveValue("");
    await userEvent.click(
      canvas.getByRole("button", { name: "Button product" }),
    );
    await expect(canvas.getByLabelText("Display name")).toHaveValue(
      "Button product",
    );
    await expect(chooser).toHaveFocus();
  },
};

/** The picker and selected summary fit within a real phone viewport. */
export const MobileProductPicker: Story = {
  ...DirectVisit,
  parameters: { viewport: { defaultViewport: "mobile1" } },
  /**
   * Selects a product on a narrow screen and checks its summary bounds.
   * @param context - Browser interaction context.
   * @rejects When the collection form is missing.
   */
  play: async (context) => {
    await DirectVisit.play?.(context);
    const main = context.canvasElement.querySelector("main");
    if (!main) throw new Error("Missing collection form.");
    await expect(window.innerWidth).toBeLessThanOrEqual(400);
    await expect(main.scrollWidth).toBeLessThanOrEqual(main.clientWidth);
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(
      window.innerWidth,
    );
  },
};

/** Product replacement clears physical installations, pairings, and acknowledgments. */
export const ResetOwnedPenParts: Story = {
  /**
   * Renders two pens with actual owned clip/mechanism choices.
   * @returns A collection form with customizable owned parts.
   */
  render: () => {
    const mechanism = productFixture(
      7101,
      "Mechanism catalog product",
      "pen-mechanism",
    );
    const clip: CatalogProduct = {
      ...productFixture(7102, "Clip catalog product", "pen-clip"),
      penPartRoles: ["clip", "actuator"],
      actuatedMechanisms: [mechanism],
    };
    const penA = productFixture(7100, "Pen A", "pen");
    const penB = productFixture(7200, "Pen B", "pen");
    return (
      <CollectionAddPage
        {...meta.args}
        initialProductId={penA.id}
        products={[penA, penB, mechanism, clip]}
        ownedItems={[
          {
            ...collectionFixture(8101, mechanism, 9000),
            displayName: "Owned mechanism",
            privacyInheritedFromItemId: null,
          },
          {
            ...collectionFixture(8102, clip, 9000),
            displayName: "Owned clip",
            privacyInheritedFromItemId: null,
            penPartRoles: clip.penPartRoles,
          },
        ]}
      />
    );
  },
  /**
   * Resets a configured physical pairing and requires a fresh exception on the next pen.
   * @param context - Browser interaction context.
   */
  play: async ({ canvas, canvasElement, userEvent }) => {
    const page = within(canvasElement.ownerDocument.body);
    const parts = canvas.getByRole("combobox", { name: "Installed parts" });
    await userEvent.click(parts);
    await userEvent.type(parts, "Owned mechanism");
    await userEvent.keyboard("{ArrowDown}{Enter}");
    let dialog = await page.findByRole("dialog", {
      name: "Confirm customization",
    });
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Yes, continue" }),
    );
    const actuator = canvas.getByRole("combobox", {
      name: /Part used to actuate/,
    });
    await userEvent.click(actuator);
    await userEvent.type(actuator, "Owned clip");
    await userEvent.keyboard("{ArrowDown}{Enter}");
    dialog = await page.findByRole("dialog", { name: "Confirm customization" });
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Yes, continue" }),
    );
    await expect(
      canvas.getByRole("button", { name: "Close: Owned clip" }),
    ).toBeVisible();
    await userEvent.click(
      canvas.getByText(/Selected product: Pen A/, { selector: "summary" }),
    );
    await userEvent.click(canvas.getByRole("button", { name: "Pen B" }));
    await expect(
      canvas.queryByRole("button", { name: "Close: Owned clip" }),
    ).toBeNull();
    await expect(
      canvas.queryByRole("button", { name: "Close: Owned mechanism" }),
    ).toBeNull();
    await expect(
      canvas.queryByRole("combobox", { name: /Part used to actuate/ }),
    ).toBeNull();
    const nextParts = canvas.getByRole("combobox", { name: "Installed parts" });
    await userEvent.click(nextParts);
    await userEvent.type(nextParts, "Owned clip");
    await userEvent.keyboard("{ArrowDown}{Enter}");
    dialog = await page.findByRole("dialog", { name: "Confirm customization" });
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Cancel" }),
    );
  },
};

/** Long actuator type explanations remain within the phone picker. */
export const MobileActuatorPicker: Story = {
  args: {
    initialProductId: 5000,
    products: [
      {
        ...productFixture(5000, "Actuator choice", "pen-actuator"),
        productTypeId: 5,
      },
    ],
  },
  parameters: { viewport: { defaultViewport: "mobile1" } },
  /**
   * Checks both the selected summary and its open type options on a phone.
   * @param context - Browser interaction context.
   * @rejects When the selected-product summary is absent.
   */
  play: async ({ canvas, canvasElement, userEvent }) => {
    const summary = canvasElement.querySelector("summary");
    if (!summary) throw new Error("Missing selected product summary.");
    await expect(summary).toHaveTextContent(
      "Pen actuator (e.g. bolt pin, button)",
    );
    await expect(summary.scrollWidth).toBeLessThanOrEqual(summary.clientWidth);
    await userEvent.click(summary);
    await userEvent.click(
      canvas.getByRole("combobox", { name: "Product type" }),
    );
    const list = await within(canvasElement.ownerDocument.body).findByRole(
      "listbox",
      { name: "Product type" },
    );
    await expect(list.getBoundingClientRect().right).toBeLessThanOrEqual(
      window.innerWidth,
    );
    await expect(list.scrollWidth).toBeLessThanOrEqual(list.clientWidth);
    await userEvent.keyboard("{Escape}");
  },
};

/** Product descriptions are editable starting text above a clearly ordered item form. */
export const CatalogDescriptionAndDetails: Story = {
  args: {
    products: [
      { ...product, description: "Catalog **description**" },
      ...products.slice(1),
    ],
  },
  /**
   * Checks real Markdown prefill, section order, keyboard disclosure, and product replacement.
   * @param context - Real collection form and browser interactions.
   */
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Source" }));
    const description = canvas.getByRole("textbox", { name: "Description" });
    await expect(description).toHaveValue("Catalog **description**");
    await expect(
      canvas.getByText(/Your edits apply only to this item/),
    ).toBeVisible();
    const details = canvas.getByRole("group", { name: "Item details" });
    await expect(
      within(details).getByRole("textbox", { name: "Bearing" }),
    ).toBeVisible();
    await expect(
      within(details).getByRole("combobox", { name: "Button" }),
    ).toBeVisible();
    const metadata = canvas
      .getByText("Add price, status, or notes", { selector: "h2" })
      .closest("details");
    await expect(metadata).not.toHaveAttribute("open");
    const images = canvasElement.querySelector("#collection-item-images");
    await expect(
      Boolean(
        images &&
          metadata &&
          images.compareDocumentPosition(metadata) &
            Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    ).toBe(true);
    await userEvent.click(canvas.getByText("Add price, status, or notes"));
    await expect(
      canvas.getByRole("group", { name: "Ownership history" }),
    ).toBeVisible();
    await userEvent.click(canvas.getByText("Add price, status, or notes"));
    await userEvent.keyboard("{Enter}");
    await expect(
      canvas.getByRole("group", { name: "Ownership history" }),
    ).toBeVisible();
    await userEvent.click(
      canvas.getByText(/Selected product:/, { selector: "summary" }),
    );
    await userEvent.click(canvas.getByRole("button", { name: "Product 2" }));
    await expect(window.confirm).not.toHaveBeenCalled();
    await userEvent.click(canvas.getByRole("button", { name: "Source" }));
    await expect(
      canvas.getByRole("textbox", { name: "Description" }),
    ).toHaveValue("");
  },
};

/** Description and item details retain the same flow on a small phone. */
export const MobileItemDetails: Story = {
  ...CatalogDescriptionAndDetails,
  globals: { viewport: { value: "mobile1", isRotated: false } },
  parameters: { viewport: { defaultViewport: "mobile1" } },
};
