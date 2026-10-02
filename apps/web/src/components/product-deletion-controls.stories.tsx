import { formatTranslation } from "@pocket-trash/localizations";
import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, fn, mocked, userEvent, waitFor, within } from "storybook/test";
import { StoryProviders } from "../../.storybook/story-fixtures";
import { ProductDeletionControls } from "./product-deletion-controls";

/** Product-deletion story configuration and isolated mutation spy. */
const meta = {
  title: "Components/ProductDeletionControls",
  component: ProductDeletionControls,
  args: {
    name: "Katla",
    reasonRequired: false,
    onDelete: fn().mockResolvedValue(undefined),
  },
  /**
   * Resets the deletion spy before each story.
   * @param context - Story arguments.
   */
  beforeEach: ({ args }) => {
    mocked(args.onDelete).mockReset().mockResolvedValue(undefined);
  },
  decorators: [
    (Story) => (
      <StoryProviders>
        <Story />
      </StoryProviders>
    ),
  ],
} satisfies Meta<typeof ProductDeletionControls>;
export default meta;
/** Typed permanent-product-deletion story. */
type Story = StoryObj<typeof meta>;
/** English permanent deletion button label. */
const action = formatTranslation("web.catalog.deletion.action", {}, "en-US");
/** English acknowledgement label. */
const confirmation = formatTranslation(
  "web.catalog.deletion.confirmation",
  {},
  "en-US",
);
/** English staff reason label. */
const reasonLabel = formatTranslation(
  "web.resources.moderation.reasonLabel",
  {},
  "en-US",
);

/** Owner confirmation is keyboard accessible and cancel resets acknowledgement. */
export const Owner: Story = {
  /**
   * Verifies keyboard acknowledgement, reset, and owner deletion.
   * @param context - Story canvas and mutation spy.
   * @returns Completion after interaction assertions.
   * @rejects When interaction assertions fail.
   */
  play: async ({ canvasElement, args }) => {
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(page.getByRole("button", { name: action }));
    const dialog = within(page.getByRole("dialog"));
    await expect(dialog.getByText(/Katla/)).toBeVisible();
    await expect(dialog.getByRole("button", { name: action })).toBeDisabled();
    const checkbox = dialog.getByRole("checkbox", { name: confirmation });
    checkbox.focus();
    await userEvent.keyboard("[Space]");
    await userEvent.click(
      dialog.getByRole("button", {
        name: formatTranslation("action.cancel", {}, "en-US"),
      }),
    );
    await waitFor(() => expect(checkbox).not.toBeChecked());
    await userEvent.click(page.getByRole("button", { name: action }));
    await expect(dialog.getByRole("checkbox")).not.toBeChecked();
    await userEvent.click(dialog.getByRole("checkbox"));
    await userEvent.click(dialog.getByRole("button", { name: action }));
    await expect(args.onDelete).toHaveBeenCalledWith(undefined);
    await waitFor(() =>
      expect(page.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  },
};

/** Staff deletion requires a bounded nonblank reason as well as acknowledgement. */
export const Staff: Story = {
  args: { reasonRequired: true },
  /**
   * Verifies staff reason validation and trimmed submission.
   * @param context - Story canvas and mutation spy.
   * @returns Completion after interaction assertions.
   * @rejects When interaction assertions fail.
   */
  play: async ({ canvasElement, args }) => {
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(page.getByRole("button", { name: action }));
    const dialog = within(page.getByRole("dialog"));
    await userEvent.click(dialog.getByRole("checkbox"));
    await expect(dialog.getByRole("button", { name: action })).toBeDisabled();
    const reason = dialog.getByRole("textbox", { name: reasonLabel });
    await expect(reason).toHaveAttribute("maxlength", "1000");
    await userEvent.type(reason, " Owner requested removal ");
    await userEvent.click(dialog.getByRole("button", { name: action }));
    await expect(args.onDelete).toHaveBeenCalledWith("Owner requested removal");
    await waitFor(() =>
      expect(page.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  },
};

/** Referenced products remain in the dialog with a localized blocking explanation. */
export const Referenced: Story = {
  /**
   * Configures a referenced-product rejection after mock restoration.
   * @param context - Story arguments.
   */
  beforeEach: ({ args }) => {
    mocked(args.onDelete).mockRejectedValue(
      new Error("web.catalog.deletion.blocked"),
    );
  },
  /**
   * Verifies the referenced-product warning.
   * @param context - Story canvas.
   * @returns Completion after interaction assertions.
   * @rejects When interaction assertions fail.
   */
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(page.getByRole("button", { name: action }));
    const dialog = within(page.getByRole("dialog"));
    await userEvent.click(dialog.getByRole("checkbox"));
    await userEvent.click(dialog.getByRole("button", { name: action }));
    await expect(dialog.getByRole("alert")).toHaveTextContent(
      formatTranslation("web.catalog.deletion.blocked", {}, "en-US"),
    );
  },
};

/** Internal failures expose only generic localized copy and leave retry available. */
export const Failed: Story = {
  /**
   * Configures a private failure after mock restoration.
   * @param context - Story arguments.
   */
  beforeEach: ({ args }) => {
    mocked(args.onDelete).mockRejectedValue(
      new Error("private database details"),
    );
  },
  /**
   * Verifies sanitized failure copy and retry availability.
   * @param context - Story canvas.
   * @returns Completion after interaction assertions.
   * @rejects When interaction assertions fail.
   */
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(page.getByRole("button", { name: action }));
    const dialog = within(page.getByRole("dialog"));
    await userEvent.click(dialog.getByRole("checkbox"));
    await userEvent.click(dialog.getByRole("button", { name: action }));
    await expect(dialog.getByRole("alert")).toHaveTextContent(
      formatTranslation("web.catalog.deletion.failed", {}, "en-US"),
    );
    await expect(dialog.getByRole("button", { name: action })).toBeEnabled();
    await expect(
      page.queryByText("private database details"),
    ).not.toBeInTheDocument();
  },
};

/** In-flight deletion blocks duplicate submission, cancellation, and Escape. */
export const Pending: Story = {
  /**
   * Keeps deletion pending after mock restoration.
   * @param context - Story arguments.
   */
  beforeEach: ({ args }) => {
    mocked(args.onDelete).mockImplementation(() => new Promise<void>(() => {}));
  },
  /**
   * Verifies duplicate and cancellation guards during deletion.
   * @param context - Story canvas and mutation spy.
   * @returns Completion after interaction assertions.
   * @rejects When interaction assertions fail.
   */
  play: async ({ canvasElement, args }) => {
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(page.getByRole("button", { name: action }));
    const dialog = within(page.getByRole("dialog"));
    await userEvent.click(dialog.getByRole("checkbox"));
    await userEvent.click(dialog.getByRole("button", { name: action }));
    await expect(dialog.getByRole("button", { name: action })).toBeDisabled();
    await expect(
      dialog.getByRole("button", {
        name: formatTranslation("action.cancel", {}, "en-US"),
      }),
    ).toBeDisabled();
    await userEvent.keyboard("{Escape}");
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(args.onDelete).toHaveBeenCalledTimes(1);
  },
};
