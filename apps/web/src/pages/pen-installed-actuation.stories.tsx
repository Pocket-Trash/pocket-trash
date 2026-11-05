import type {
  CatalogProduct,
  InstalledPenActuationInput,
} from "@package/services";
import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { useReducer } from "react";
import { expect, waitFor, within } from "storybook/test";
import { useCatalogCopy } from "@/lib/catalog-copy";
import { mockStoryAuth, StoryProviders } from "../../.storybook/story-fixtures";
import { PenCollectionFields } from "./catalog-form-pages";
import { collectionFixture, productFixture } from "./catalog-test-fixtures";

/** Catalog physical mechanism and its actual owned copy. */
const mechanism = productFixture(1010, "Click mechanism", "pen-mechanism");
/** Another physical mechanism without a recorded clip association. */
const alternateMechanism = productFixture(
  1011,
  "Alternate mechanism",
  "pen-mechanism",
);
/** One physical clip serving both Clip and Actuator roles. */
const clipProduct: CatalogProduct = {
  ...productFixture(1012, "Action clip", "pen-clip"),
  penPartRoles: ["clip", "actuator"],
};
/** Actual owned mechanism installed at the start of the draft. */
const ownedMechanism = {
  ...collectionFixture(2010, mechanism, 3000),
  displayName: "My click mechanism",
  privacyInheritedFromItemId: null,
};
/** Another available mechanism owned by the same collector. */
const ownedAlternate = {
  ...collectionFixture(2011, alternateMechanism, 3000),
  displayName: "My alternate mechanism",
  privacyInheritedFromItemId: null,
};
/** One owned clip, never duplicated to fill its additional role. */
const ownedClip = {
  ...collectionFixture(2012, clipProduct, 3000),
  displayName: "My action clip",
  privacyInheritedFromItemId: null,
  penPartRoles: clipProduct.penPartRoles,
};

/**
 * Controls one owned installation and its actual physical pairings.
 * @param props - Whether the pairing is already saved or absent from catalog context.
 * @returns Owned Pen installation controls.
 */
function Fixture({
  saved = false,
  unrecorded = false,
}: {
  /** Existing saved pairs must not ask for repeat confirmation. */
  saved?: boolean;
  /** Unrecorded catalog pairing requires a new acknowledgment. */
  unrecorded?: boolean;
}) {
  const t = useCatalogCopy();
  const [state, dispatch] = useReducer(
    (
      previous: {
        /** Installed physical item identities. */
        ids: number[];
        /** Complete owned actuator/mechanism draft. */
        pairs: InstalledPenActuationInput[];
        /** Confirmed part-level exceptions. */
        confirmed: number[];
      },
      event:
        | {
            /** Owner changes installed physical items. */
            type: "partsChanged";
            /** Proposed owned identities. */
            ids: number[];
          }
        | {
            /** Owner accepts a pairing selection. */
            type: "pairingsChanged";
            /** Proposed physical pairings. */
            pairs: InstalledPenActuationInput[];
          }
        | {
            /** Owner acknowledges part-level customization. */
            type: "customizationConfirmed";
            /** Acknowledged owned identities. */
            ids: number[];
          },
    ) => {
      switch (event.type) {
        case "partsChanged":
          return { ...previous, ids: event.ids };
        case "pairingsChanged":
          return { ...previous, pairs: event.pairs };
        case "customizationConfirmed":
          return { ...previous, confirmed: event.ids };
      }
    },
    {
      ids: saved
        ? [ownedMechanism.collectionItemId, ownedClip.collectionItemId]
        : [ownedMechanism.collectionItemId],
      pairs: saved
        ? [
            {
              actuatorCollectionItemId: ownedClip.collectionItemId,
              mechanismCollectionItemId: ownedMechanism.collectionItemId,
            },
          ]
        : [],
      confirmed: [],
    },
  );
  return (
    <PenCollectionFields
      allProducts={[
        { ...clipProduct, actuatedMechanisms: unrecorded ? [] : [mechanism] },
        mechanism,
        alternateMechanism,
      ]}
      ownedItems={[ownedMechanism, ownedAlternate, ownedClip]}
      product={{
        ...productFixture(1000, "My Pen", "pen"),
        interchangeableParts: {
          tip: false,
          clip: true,
          actuator: true,
          mechanism: true,
          topCap: false,
        },
        compatibleParts: [clipProduct, mechanism, alternateMechanism],
      }}
      installedPartIds={state.ids}
      installedActuations={state.pairs}
      savedInstalledPartIds={
        saved
          ? [ownedMechanism.collectionItemId, ownedClip.collectionItemId]
          : [ownedMechanism.collectionItemId]
      }
      savedInstalledActuations={
        saved
          ? [
              {
                actuatorCollectionItemId: ownedClip.collectionItemId,
                mechanismCollectionItemId: ownedMechanism.collectionItemId,
                requiresCustomization: unrecorded,
              },
            ]
          : []
      }
      confirmedCustomizationIds={state.confirmed}
      onInstalledPartIdsChange={(ids) =>
        dispatch({ type: "partsChanged", ids })
      }
      onInstalledActuationsChange={(pairs) =>
        dispatch({ type: "pairingsChanged", pairs })
      }
      onConfirmedCustomizationIdsChange={(ids) =>
        dispatch({ type: "customizationConfirmed", ids })
      }
      refillOfferingId={null}
      refillProductId={null}
      onRefillOfferingChange={() => undefined}
      onRefillProductChange={() => undefined}
      t={t}
    />
  );
}

/** Story metadata for actual owned actuator/mechanism connections. */
const meta = {
  component: Fixture,
  /**
   * Installs the signed-in collector fixture for each interaction.
   * @returns Completion after installing the Clerk mocks.
   */
  beforeEach: () => mockStoryAuth(),
  decorators: [
    (Story) => (
      <StoryProviders>
        <Story />
      </StoryProviders>
    ),
  ],
  parameters: { layout: "padded" },
  title: "Components/PenInstalledActuation",
} satisfies Meta<typeof Fixture>;
export default meta;
/** Controlled story type. */
type Story = StoryObj<typeof meta>;

/** Keyboard selection adds the clip once while it fills both roles. */
export const OneClipTwoRoles: Story = {
  /**
   * Selects a recorded pairing with no customization prompt or duplicate installation.
   * @param context - Story interaction context.
   */
  play: async ({ canvas, canvasElement, userEvent }) => {
    const input = canvas.getByRole("combobox", {
      name: "Part used to actuate My click mechanism",
    });
    await userEvent.click(input);
    await userEvent.type(input, "My action");
    await userEvent.keyboard("{ArrowDown}{Enter}");
    await expect(
      canvas.getAllByRole("button", { name: /Close.*My action clip/ }),
    ).toHaveLength(1);
    await expect(
      canvas.getByText("This pairing is recorded in the catalog."),
    ).toBeVisible();
    await expect(
      within(canvasElement.ownerDocument.body).queryByRole("dialog"),
    ).not.toBeInTheDocument();
  },
};

/** New unrecorded pairs hold the entire proposed installation until accepted. */
export const ConfirmUnrecordedPair: Story = {
  args: { unrecorded: true },
  /**
   * Cancels without adding a part, then explicitly accepts the physical pair.
   * @param context - Story interaction context.
   */
  play: async ({ canvas, canvasElement, userEvent }) => {
    const page = within(canvasElement.ownerDocument.body);
    const input = canvas.getByRole("combobox", {
      name: "Part used to actuate My click mechanism",
    });
    await userEvent.click(input);
    await userEvent.type(input, "My action");
    await userEvent.keyboard("{ArrowDown}{Enter}");
    const dialog = await page.findByRole("dialog", {
      name: "Confirm customization",
    });
    await expect(
      within(dialog).getByText(
        /Compatibility between My action clip and My click mechanism/,
      ),
    ).toBeVisible();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Cancel" }),
    );
    await expect(
      canvas.queryByRole("button", { name: /Close.*My action clip/ }),
    ).not.toBeInTheDocument();
    await userEvent.click(input);
    await userEvent.type(input, "My action");
    await userEvent.keyboard("{ArrowDown}{Enter}");
    await userEvent.click(page.getByRole("button", { name: "Yes, continue" }));
    await expect(
      canvas.getAllByRole("button", { name: /Close.*My action clip/ }),
    ).toHaveLength(1);
    await expect(
      canvas.getByText("This pairing is not recorded in the catalog."),
    ).toBeVisible();
    await expect(
      canvas.queryByRole("button", { name: "Confirm customization" }),
    ).not.toBeInTheDocument();
  },
};

/** A saved exceptional pairing needs no repeat acknowledgment when reopened. */
export const SavedUnrecordedPair: Story = {
  args: { saved: true, unrecorded: true },
  /**
   * Shows a truthful warning without blocking an unrelated edit.
   * @param context - Story interaction context.
   */
  play: async ({ canvas, canvasElement }) => {
    await expect(
      canvas.getByText("This pairing is not recorded in the catalog."),
    ).toBeVisible();
    await expect(
      canvas.queryByRole("button", { name: "Confirm customization" }),
    ).not.toBeInTheDocument();
    await expect(
      within(canvasElement.ownerDocument.body).queryByRole("dialog"),
    ).not.toBeInTheDocument();
  },
};

/** Changing the mechanism retains the clip but re-evaluates the new pairing. */
export const ChangeMechanism: Story = {
  args: { saved: true },
  /**
   * Keeps the owned clip installed and asks about its new unrecorded connection.
   * @param context - Story interaction context.
   */
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: /Close.*My click mechanism/ }),
    );
    await expect(
      canvas.getByRole("button", { name: /Close.*My action clip/ }),
    ).toBeVisible();
    const parts = canvas.getByRole("combobox", { name: "Installed parts" });
    await userEvent.click(parts);
    await userEvent.type(parts, "My alternate");
    await userEvent.keyboard("{ArrowDown}{Enter}");
    const actuator = canvas.getByRole("combobox", {
      name: "Part used to actuate My alternate mechanism",
    });
    await userEvent.click(actuator);
    await userEvent.type(actuator, "My action");
    await userEvent.keyboard("{ArrowDown}{Enter}");
    await expect(
      await within(canvasElement.ownerDocument.body).findByRole("dialog", {
        name: "Confirm customization",
      }),
    ).toBeVisible();
    await expect(
      canvas.getAllByRole("button", { name: /Close.*My action clip/ }),
    ).toHaveLength(1);
    await userEvent.click(
      within(canvasElement.ownerDocument.body).getByRole("button", {
        name: "Cancel",
      }),
    );
    await waitFor(() => expect(actuator).toHaveFocus());
  },
};

/** The owned pairing picker fits a narrow phone and remains keyboard-operable. */
export const MobilePairing: Story = {
  ...OneClipTwoRoles,
  parameters: { viewport: { defaultViewport: "mobile1" } },
  /**
   * Exercises selection at the phone width.
   * @param context - Story interaction context.
   */
  play: async (context) => {
    await expect(window.innerWidth).toBeLessThanOrEqual(400);
    await OneClipTwoRoles.play?.(context);
    const input = context.canvas.getByRole("combobox", {
      name: "Part used to actuate My click mechanism",
    });
    await expect(input.getBoundingClientRect().right).toBeLessThanOrEqual(
      window.innerWidth,
    );
  },
};
