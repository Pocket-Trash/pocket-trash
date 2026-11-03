import type { CollectionItemMetadataWrite } from "@package/services";
import type { TranslationKey } from "@pocket-trash/localizations";
import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { useReducer } from "react";
import { expect, userEvent, within } from "storybook/test";
import { StoryProviders } from "../../.storybook/story-fixtures";
import { CollectionItemStatusFields } from "./collection-item-status-fields";

/**
 * Preserves form-owned selections through public/private transitions.
 * @param props - Initial selections and editing mode.
 * @returns Interactive status fields.
 */
function Controlled(props: {
  /** Initial saved scope values. */
  value: CollectionItemMetadataWrite;
  /** Whether the form edits an existing item. */
  editing?: boolean;
  /** Whether validation requires the disclosure open. */
  invalid?: boolean;
  /** Blocking public visibility explanation. */
  warning?: TranslationKey;
}) {
  const [value, update] = useReducer(
    (_state: CollectionItemMetadataWrite, next: CollectionItemMetadataWrite) =>
      next,
    props.value,
  );
  return (
    <CollectionItemStatusFields {...props} value={value} onChange={update} />
  );
}
/** Interactive metadata authoring states with the application providers. */
const meta = {
  component: Controlled,
  title: "Components/CollectionItemStatusFields",
  args: { value: { statuses: { public: [], private: ["grail"] } } },
  decorators: [
    (Story) => (
      <StoryProviders>
        <Story />
      </StoryProviders>
    ),
  ],
} satisfies Meta<typeof Controlled>;
export default meta;
/** Metadata authoring story contract. */
type Story = StoryObj<typeof meta>;
/** Create starts collapsed without hiding the surrounding form flow. */
export const Create: Story = {
  /** Confirms disclosure state and keyboard activation.
   * @param context - Story canvas.
   */
  play: async (context) => {
    const { canvasElement } = context;
    const details = canvasElement.querySelector("details");
    await expect(details).not.toHaveAttribute("open");
    await userEvent.click(
      within(canvasElement).getByText("Add price, status, or notes"),
    );
    await expect(details).toHaveAttribute("open");
  },
};
/** Public selections derive checked private controls and restore the saved value on removal. */
export const IndependentScopes: Story = {
  args: { editing: true },
  /** Exercises independent saved values rather than mirroring the implementation.
   * @param context - Story canvas.
   */
  play: async (context) => {
    const { canvasElement } = context;
    const canvas = within(canvasElement);
    const publicGroup = within(
      canvas.getByRole("group", { name: "Public status" }),
    );
    const privateGroup = within(
      canvas.getByRole("group", { name: "Private status" }),
    );
    await expect(
      privateGroup.getByRole("checkbox", { name: "Grail" }),
    ).toBeChecked();
    await userEvent.click(
      publicGroup.getByRole("checkbox", { name: "Favorite" }),
    );
    await expect(
      privateGroup.getByRole("checkbox", { name: "Favorite" }),
    ).toBeChecked();
    await expect(
      privateGroup.getByRole("checkbox", { name: "Favorite" }),
    ).toBeDisabled();
    await userEvent.click(
      publicGroup.getByRole("checkbox", { name: "Favorite" }),
    );
    await expect(
      privateGroup.getByRole("checkbox", { name: "Favorite" }),
    ).not.toBeChecked();
    await expect(
      privateGroup.getByRole("checkbox", { name: "Grail" }),
    ).toBeChecked();
  },
};

/** Contained validation opens a create disclosure. */
export const ValidationOpens: Story = {
  args: { invalid: true },
  /**
   * Confirms invalid fields remain reachable without a disclosure click.
   * @param context - Story canvas.
   */
  play: async (context) => {
    await expect(
      context.canvasElement.querySelector("details"),
    ).toHaveAttribute("open");
  },
};
/** A single keyboard-accessible warning explains hidden public assignments. */
export const HiddenPublic: Story = {
  args: {
    editing: true,
    value: { statuses: { public: ["favorite"], private: [] } },
    warning: "web.collectionItemMetadata.collectionPrivateWarning",
  },
  /**
   * Checks that the public fieldset owns one warning with a visible explanation.
   * @param context - Story canvas.
   */
  play: async (context) => {
    const canvas = within(context.canvasElement);
    const warnings = canvas.getAllByRole("button", {
      name: "Public metadata is currently hidden",
    });
    await expect(warnings).toHaveLength(1);
    await userEvent.hover(
      canvas.getByRole("button", {
        name: "Public metadata is currently hidden",
      }),
    );
    await expect(
      await within(context.canvasElement.ownerDocument.body).findByRole(
        "tooltip",
      ),
    ).toHaveTextContent("hidden while the collection is private");
  },
};
