import type { UserCollectionSummary } from "@package/services";
import { formatTranslation } from "@pocket-trash/localizations";
import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, fn, mocked, userEvent, waitFor, within } from "storybook/test";
import { StoryProviders } from "../../.storybook/story-fixtures";
import { CollectionDeletionSection } from "../pages/catalog-form-pages";

/** Owned collection fixture and same-owner move destination. */
const collection: UserCollectionSummary = {
  id: 1000,
  ownerUserId: 1000,
  name: "Source",
  description: null,
  canEdit: true,
  canAdminister: false,
  isOwner: true,
  isPrivate: false,
  isAdminPrivate: false,
  coverImage: null,
  coverImages: [],
  itemCount: 2,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};
/** Configures isolated collection-deletion mutation callbacks. */
const meta = {
  title: "Components/CollectionDeletionSection",
  component: CollectionDeletionSection,
  args: {
    collection,
    destinations: [{ ...collection, id: 1001, name: "Destination" }],
    itemCount: 2,
    onSubmit: fn().mockResolvedValue(undefined),
  },
  /**
   * Resets mutation state before each story.
   * @param context - Story arguments.
   */
  beforeEach: ({ args }) => {
    mocked(args.onSubmit).mockReset().mockResolvedValue(undefined);
  },
  decorators: [
    (Story) => (
      <StoryProviders>
        <Story />
      </StoryProviders>
    ),
  ],
} satisfies Meta<typeof CollectionDeletionSection>;
export default meta;
/** Typed collection-deletion interaction story. */
type Story = StoryObj<typeof meta>;
/** Localized destructive button label. */
const deleteLabel = formatTranslation("web.resources.action.permanentlyDelete");

/**
 * Opens the collection dialog and selects the requested destructive outcome.
 *
 * @param canvasElement - Story root element.
 * @param choice - Permanent deletion or move-before-delete choice.
 * @returns Queries scoped to the native modal dialog.
 * @rejects When the dialog or requested choice cannot be found.
 */
async function open(
  canvasElement: HTMLElement,
  choice: "deleteChoice" | "moveChoice",
) {
  const page = within(canvasElement.ownerDocument.body);
  await userEvent.click(
    page.getByRole("button", {
      name: formatTranslation("web.collections.deletion.open"),
    }),
  );
  const dialog = within(page.getByRole("dialog"));
  await userEvent.click(
    dialog.getByRole("radio", {
      name: formatTranslation(`web.collections.deletion.${choice}`),
    }),
  );
  return dialog;
}

/** Explicit acknowledgement is required and cancellation resets it. */
export const Delete: Story = {
  /**
   * Verifies the permanent-deletion warning, reset, and owner request.
   * @param context - Story root and mutation spy.
   * @returns Completion after assertions.
   * @rejects When assertions fail.
   */
  play: async ({ canvasElement, args }) => {
    let dialog = await open(canvasElement, "deleteChoice");
    await expect(
      dialog.getByRole("button", { name: deleteLabel }),
    ).toBeDisabled();
    await expect(dialog.getByRole("checkbox")).toHaveAccessibleName(
      formatTranslation("web.collections.deletion.deleteConfirmation"),
    );
    await userEvent.click(dialog.getByRole("checkbox"));
    await userEvent.click(
      dialog.getByRole("button", { name: formatTranslation("action.cancel") }),
    );
    await waitFor(() =>
      expect(
        within(canvasElement.ownerDocument.body).queryByRole("dialog"),
      ).not.toBeInTheDocument(),
    );
    dialog = await open(canvasElement, "deleteChoice");
    await expect(dialog.getByRole("checkbox")).not.toBeChecked();
    await userEvent.click(dialog.getByRole("checkbox"));
    await userEvent.click(dialog.getByRole("button", { name: deleteLabel }));
    await expect(args.onSubmit).toHaveBeenCalledWith("delete", null, undefined);
  },
};
/** Cross-owner deletion also requires a trimmed bounded reason. */
export const Staff: Story = {
  args: { collection: { ...collection, isOwner: false, canAdminister: true } },
  /**
   * Verifies staff reason validation and submission.
   * @param context - Story root and mutation spy.
   * @returns Completion after assertions.
   * @rejects When assertions fail.
   */
  play: async ({ canvasElement, args }) => {
    const dialog = await open(canvasElement, "deleteChoice");
    await userEvent.click(dialog.getByRole("checkbox"));
    await expect(
      dialog.getByRole("button", { name: deleteLabel }),
    ).toBeDisabled();
    const reason = dialog.getByRole("textbox", {
      name: formatTranslation("web.resources.moderation.reasonLabel"),
    });
    await expect(reason).toHaveAttribute("maxlength", "1000");
    await userEvent.type(reason, " Owner request ");
    await userEvent.click(dialog.getByRole("button", { name: deleteLabel }));
    await expect(args.onSubmit).toHaveBeenCalledWith(
      "delete",
      null,
      "Owner request",
    );
  },
};
/** Moving requires a destination and keeps the distinct retention warning. */
export const Move: Story = {
  /**
   * Verifies destination selection and move-before-delete submission.
   * @param context - Story root and mutation spy.
   * @returns Completion after assertions.
   * @rejects When assertions fail.
   */
  play: async ({ canvasElement, args }) => {
    const dialog = await open(canvasElement, "moveChoice");
    const move = dialog.getByRole("button", {
      name: formatTranslation("web.collections.deletion.moveAction"),
    });
    await userEvent.click(dialog.getByRole("checkbox"));
    await expect(move).toBeDisabled();
    await expect(dialog.getByRole("checkbox")).toHaveAccessibleName(
      formatTranslation("web.collections.deletion.moveConfirmation"),
    );
    await userEvent.click(dialog.getByRole("combobox"));
    await userEvent.click(
      await within(canvasElement.ownerDocument.body).findByRole("option", {
        name: "Destination",
      }),
    );
    await userEvent.click(move);
    await expect(args.onSubmit).toHaveBeenCalledWith("move", 1001, undefined);
  },
};
/** An empty destination list cannot authorize moving items. */
export const NoDestination: Story = {
  args: { destinations: [] },
  /**
   * Verifies the blocked move state.
   * @param context - Story root.
   * @returns Completion after assertions.
   */
  play: async ({ canvasElement }) => {
    const dialog = await open(canvasElement, "moveChoice");
    await expect(
      dialog.getByText(
        formatTranslation("web.collections.deletion.noDestination"),
      ),
    ).toBeVisible();
    await expect(
      dialog.getByRole("button", {
        name: formatTranslation("web.collections.deletion.moveAction"),
      }),
    ).toBeDisabled();
  },
};
/** Failure leaves the confirmed action retryable without exposing internal details. */
export const Failed: Story = {
  /**
   * Sets a sanitized failure scenario.
   * @param context - Story arguments.
   */
  beforeEach: ({ args }) => {
    mocked(args.onSubmit).mockRejectedValue(
      new Error("private database details"),
    );
  },
  /**
   * Verifies generic failure and retry.
   * @param context - Story root.
   * @returns Completion after assertions.
   */
  play: async ({ canvasElement }) => {
    const dialog = await open(canvasElement, "deleteChoice");
    await userEvent.click(dialog.getByRole("checkbox"));
    await userEvent.click(dialog.getByRole("button", { name: deleteLabel }));
    await expect(
      dialog.getByText(formatTranslation("error.generic")),
    ).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: deleteLabel }),
    ).toBeEnabled();
  },
};
/** Pending deletion blocks cancellation, Escape, and duplicate submission. */
export const Pending: Story = {
  /**
   * Keeps deletion pending.
   * @param context - Story arguments.
   */
  beforeEach: ({ args }) => {
    mocked(args.onSubmit).mockImplementation(() => new Promise<void>(() => {}));
  },
  /**
   * Verifies pending guards.
   * @param context - Story root and mutation spy.
   * @returns Completion after assertions.
   */
  play: async ({ canvasElement, args }) => {
    const dialog = await open(canvasElement, "deleteChoice");
    await userEvent.click(dialog.getByRole("checkbox"));
    await userEvent.click(dialog.getByRole("button", { name: deleteLabel }));
    await expect(
      dialog.getByRole("button", { name: deleteLabel }),
    ).toBeDisabled();
    await userEvent.keyboard("{Escape}");
    await expect(
      within(canvasElement.ownerDocument.body).getByRole("dialog"),
    ).toBeVisible();
    await expect(args.onSubmit).toHaveBeenCalledTimes(1);
  },
};
/** Checks the same deletion state in the dark theme. */
export const DeleteDark: Story = { ...Delete, globals: { theme: "dark" } };
