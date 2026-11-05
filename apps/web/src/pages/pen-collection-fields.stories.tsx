import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { useReducer } from "react";
import { expect, waitFor, within } from "storybook/test";
import { useCatalogCopy } from "@/lib/catalog-copy";
import { mockStoryAuth, StoryProviders } from "../../.storybook/story-fixtures";
import { CollectionAddPage, PenCollectionFields } from "./catalog-form-pages";
import { collectionFixture, productFixture } from "./catalog-test-fixtures";

/** Pen with no ordinarily interchangeable parts. */
const pen = productFixture(1000, "Test Pen", "pen");
/** Unlisted physical clip owned by the current collector. */
const clip = {
  ...collectionFixture(
    2000,
    productFixture(1001, "Custom Clip", "pen-clip"),
    1004,
  ),
  privacyInheritedFromItemId: null,
};
/** Standard compatibility fixture for a tip. */
const tipProduct = productFixture(1002, "Standard Tip", "pen-tip");
/** Available tip owned by the current collector. */
const tip = {
  ...collectionFixture(2001, tipProduct, 1005),
  privacyInheritedFromItemId: null,
};

/**
 * Controls the section using the form's existing selection model.
 * @param props - Optional saved or ordinary installation fixture.
 * @returns Controlled installed-part fields.
 */
function Fixture({
  saved = false,
  ordinary = false,
  interchangeableClip = false,
}: {
  /** Saved selections need no repeat acknowledgment. */
  saved?: boolean;
  /** Ordinary interchangeable compatible tip. */
  ordinary?: boolean;
  /** Clip is interchangeable but has no recorded catalog compatibility. */
  interchangeableClip?: boolean;
}) {
  const t = useCatalogCopy();
  const [state, update] = useReducer(
    (
      previous: {
        /** Selected owned parts. */
        ids: number[];
        /** Exceptions acknowledged in this draft. */
        confirmed: number[];
      },
      event: {
        /** Particular user selection or confirmation. */
        type: "partsSelected" | "customizationConfirmed";
        /** Owned parts affected by the event. */
        ids: number[];
      },
    ) =>
      event.type === "partsSelected"
        ? { ...previous, ids: event.ids }
        : { ...previous, confirmed: event.ids },
    { ids: saved ? [clip.collectionItemId] : [], confirmed: [] },
  );
  return (
    <PenCollectionFields
      allProducts={[]}
      ownedItems={ordinary ? [tip] : [clip]}
      product={
        ordinary
          ? {
              ...pen,
              interchangeableParts: {
                tip: true,
                clip: false,
                topCap: false,
                actuator: false,
                mechanism: false,
              },
              compatibleParts: [
                {
                  id: tipProduct.id,
                  name: tipProduct.name,
                  slug: tipProduct.slug,
                  productTypeSlug: tipProduct.productTypeSlug,
                  productTypeName: tipProduct.productTypeName,
                },
              ],
            }
          : interchangeableClip
            ? {
                ...pen,
                interchangeableParts: {
                  tip: false,
                  clip: true,
                  topCap: false,
                  actuator: false,
                  mechanism: false,
                },
              }
            : pen
      }
      installedPartIds={state.ids}
      confirmedCustomizationIds={state.confirmed}
      savedInstalledPartIds={saved ? [clip.collectionItemId] : []}
      onConfirmedCustomizationIdsChange={(confirmed) =>
        update({ type: "customizationConfirmed", ids: confirmed })
      }
      onInstalledPartIdsChange={(ids) => update({ type: "partsSelected", ids })}
      refillOfferingId={null}
      refillProductId={null}
      onRefillOfferingChange={() => undefined}
      onRefillProductChange={() => undefined}
      t={t}
    />
  );
}
/** Story metadata for custom owned-part installations. */
const meta = {
  component: Fixture,
  decorators: [
    (Story) => (
      <StoryProviders>
        <Story />
      </StoryProviders>
    ),
  ],
  parameters: { layout: "padded" },
  title: "Components/PenCollectionFields",
} satisfies Meta<typeof Fixture>;
export default meta;
/** Controlled story type. */
type Story = StoryObj<typeof meta>;

/** Cancel retains the old selection; accepting records the particular exception. */
export const ConfirmCustomization: Story = {
  /**
   * Exercises cancellation, focus restoration, acceptance and removal.
   * @param root0 - Story interaction context.
   */
  play: async ({ canvas, canvasElement, userEvent }) => {
    const page = within(canvasElement.ownerDocument.body);
    const input = canvas.getByRole("combobox", { name: "Installed parts" });
    await userEvent.click(input);
    await userEvent.type(input, "Custom");
    await userEvent.keyboard("{ArrowDown}{Enter}");
    const dialog = await page.findByRole("dialog", {
      name: "Confirm customization",
    });
    await expect(within(dialog).getByText("Custom Clip")).toBeVisible();
    await expect(
      within(dialog).getByText(/normally not interchangeable/),
    ).toBeVisible();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Cancel" }),
    );
    await expect(
      canvas.queryByRole("button", { name: /Close Custom Clip/ }),
    ).not.toBeInTheDocument();
    await userEvent.click(input);
    await userEvent.keyboard("{ArrowDown}{Enter}");
    await userEvent.click(page.getByRole("button", { name: "Yes, continue" }));
    await expect(
      canvas.getByText("Custom Clip", { exact: true }),
    ).toBeVisible();
    await expect(
      canvas.queryByRole("button", { name: "Confirm customization" }),
    ).not.toBeInTheDocument();
  },
};
/** Previously saved exceptions remain visible without repeated confirmation. */
export const SavedCustomization: Story = { args: { saved: true } };
/** Ordinary compatible interchangeable parts do not require an override. */
export const OrdinaryInstallation: Story = {
  args: { ordinary: true },
  /**
   * Installs a standard compatible tip without confirmation.
   * @param root0 - Story interaction context.
   */
  play: async ({ canvas, canvasElement, userEvent }) => {
    const input = canvas.getByRole("combobox", { name: "Installed parts" });
    await userEvent.click(input);
    await userEvent.type(input, "Standard");
    await userEvent.keyboard("{ArrowDown}{Enter}");
    await expect(
      canvas.getByText("Standard Tip", { exact: true }),
    ).toBeVisible();
    await expect(
      within(canvasElement.ownerDocument.body).queryByRole("dialog"),
    ).not.toBeInTheDocument();
    await waitFor(() =>
      expect(
        within(canvasElement.ownerDocument.body).queryByRole("listbox"),
      ).not.toBeInTheDocument(),
    );
  },
};

/** Changing the selected Pen preserves owned parts and re-evaluates their confirmation. */
export const ProductChangePreservesParts: Story = {
  beforeEach: mockStoryAuth,
  /**
   * Renders the real creation form with two catalog Pens and an owned clip.
   * @returns Collection creation form.
   */
  render: () => (
    <CollectionAddPage
      collections={[]}
      defaultCollectionName={null}
      initialProductId={pen.id}
      products={[
        pen,
        { ...pen, id: 1003, name: "Another Pen", slug: "another-pen" },
      ]}
      ownedItems={[clip]}
      options={{
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
            slug: "pen",
            name: "Pen",
            isPartOrAccessory: false,
            imageAlt: "No image",
            imageUrl: "https://cdn.pocket-trash.app/assets/static/no-image.png",
          },
        ],
      }}
    />
  ),
  /**
   * Retains a selection for the same Pen and asks again for a different Pen.
   * @param root0 - Story interaction context.
   */
  play: async ({ canvas, canvasElement, userEvent }) => {
    const page = within(canvasElement.ownerDocument.body);
    const input = canvas.getByRole("combobox", { name: "Installed parts" });
    await userEvent.click(input);
    await userEvent.type(input, "Custom");
    await userEvent.keyboard("{ArrowDown}{Enter}");
    await userEvent.click(page.getByRole("button", { name: "Yes, continue" }));
    await userEvent.click(
      canvas.getByText("Product selector", { selector: "summary" }),
    );
    await userEvent.click(canvas.getByRole("button", { name: "Test Pen" }));
    await expect(
      canvas.queryByRole("button", { name: "Confirm customization" }),
    ).not.toBeInTheDocument();
    await userEvent.click(
      canvas.getByText("Product selector", { selector: "summary" }),
    );
    await userEvent.click(canvas.getByRole("button", { name: "Another Pen" }));
    await expect(
      canvas.getByText("Custom Clip", { exact: true }),
    ).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Confirm customization" }),
    );
    await expect(
      page.getByRole("dialog", { name: "Confirm customization" }),
    ).toBeVisible();
    await userEvent.click(page.getByRole("button", { name: "Yes, continue" }));
    await expect(
      canvas.getByText("Custom Clip", { exact: true }),
    ).toBeVisible();
  },
};

/** Interchangeability alone does not imply that an unlisted part is a verified fit. */
export const UnlistedInterchangeableRole: Story = {
  args: { interchangeableClip: true },
  /**
   * Requires the missing-compatibility acknowledgment even for an interchangeable clip.
   * @param root0 - Story interaction context.
   */
  play: async ({ canvas, canvasElement, userEvent }) => {
    const input = canvas.getByRole("combobox", { name: "Installed parts" });
    await userEvent.click(input);
    await userEvent.type(input, "Custom");
    await userEvent.keyboard("{ArrowDown}{Enter}");
    const dialog = await within(canvasElement.ownerDocument.body).findByRole(
      "dialog",
      { name: "Confirm customization" },
    );
    await expect(
      within(dialog).getByText(/Installing it may require customization/),
    ).toBeVisible();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Yes, continue" }),
    );
    await expect(
      canvas.getByText("Custom Clip", { exact: true }),
    ).toBeVisible();
  },
};
