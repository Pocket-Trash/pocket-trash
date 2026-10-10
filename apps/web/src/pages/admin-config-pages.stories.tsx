import type { CatalogProductTypeSummary } from "@package/services";
import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { toast } from "sonner";
import { expect, mocked, waitFor, within } from "storybook/test";
import { setProductTypePartOrAccessory } from "@/lib/catalog-api";
import { mockStoryRole, StoryProviders } from "../../.storybook/story-fixtures";
import { AdminProductConfigPage } from "./admin-config-pages";

/** Product types that exercise the configured 30-row page size. */
const productTypes: CatalogProductTypeSummary[] = Array.from(
  { length: 31 },
  (_, index) => ({
    id: index + 1,
    isPartOrAccessory: false,
    name: `Product Type ${String(index + 1).padStart(2, "0")}`,
    slug: `product-type-${String(index + 1).padStart(2, "0")}`,
  }),
);

/** Product-type configuration Storybook setup. */
const meta = {
  args: { productTypes },
  /** Configures administrator authorization and persistence mocks. */
  beforeEach: () => {
    mockStoryRole("admin");
    mocked(toast.error).mockClear();
    mocked(toast.success).mockClear();
    mocked(setProductTypePartOrAccessory).mockImplementation(
      async (options) => {
        if (!options) throw new Error("Product type update data is required.");
        const data = options.data;
        if (
          typeof data !== "object" ||
          data === null ||
          !("productTypeId" in data) ||
          !("isPartOrAccessory" in data) ||
          typeof data.productTypeId !== "number" ||
          typeof data.isPartOrAccessory !== "boolean"
        )
          throw new Error("Product type update data is invalid.");
        const productType = productTypes.find(
          ({ id }) => id === data.productTypeId,
        );
        if (!productType) throw new Error("Product type fixture is missing.");
        return {
          ...productType,
          isPartOrAccessory: data.isPartOrAccessory,
        };
      },
    );
  },
  component: AdminProductConfigPage,
  decorators: [
    (Story) => (
      <StoryProviders>
        <Story />
      </StoryProviders>
    ),
  ],
  parameters: { layout: "fullscreen" },
  title: "Components/AdminProductConfigPage",
} satisfies Meta<typeof AdminProductConfigPage>;

export default meta;
/** Product-type configuration story. */
type Story = StoryObj<typeof meta>;

/** Search, pagination, and debounced persistence behavior. */
export const Default: Story = {
  /**
   * Verifies table interactions and persistence.
   *
   * @param context - Story interaction context.
   * @returns A promise that resolves after the interactions complete.
   * @rejects When an expected table interaction cannot be completed.
   */
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.getAllByRole("checkbox")).toHaveLength(30);
    await expect(canvas.queryByText("Product Type 31")).not.toBeInTheDocument();

    await userEvent.click(canvas.getByRole("button", { name: "Next page" }));
    await expect(canvas.getByText("Product Type 31")).toBeVisible();

    const search = canvas.getByRole("searchbox");
    await userEvent.type(search, "product-type-02");
    await expect(canvas.getByText("Product Type 02")).toBeVisible();
    await expect(canvas.queryByText("Product Type 31")).not.toBeInTheDocument();

    const rowElement = canvas.getByText("Product Type 02").closest("tr");
    if (!rowElement) throw new Error("Product type row is missing.");
    const row = within(rowElement);
    const checkbox = row.getByRole("checkbox");
    await userEvent.click(checkbox);
    await userEvent.click(checkbox);
    await userEvent.click(checkbox);

    await waitFor(() =>
      expect(mocked(setProductTypePartOrAccessory)).toHaveBeenCalledTimes(1),
    );
    await expect(setProductTypePartOrAccessory).toHaveBeenCalledWith({
      data: { isPartOrAccessory: true, productTypeId: 2 },
    });
    await expect(checkbox).toBeChecked();
    await expect(toast.success).toHaveBeenCalledOnce();
  },
};

/** Failed updates restore the last persisted checkbox value. */
export const FailedUpdate: Story = {
  /** Configures a rejected persistence request. */
  beforeEach: () => {
    mocked(setProductTypePartOrAccessory).mockRejectedValueOnce(
      new Error("Persistence failed"),
    );
  },
  /**
   * Verifies optimistic state rolls back after a failed request.
   *
   * @param context - Story interaction context.
   * @returns A promise that resolves after rollback completes.
   * @rejects When the expected product-type row is unavailable.
   */
  play: async ({ canvas, userEvent }) => {
    const checkbox = canvas.getAllByRole("checkbox")[0];
    if (!checkbox) throw new Error("Product type checkbox is missing.");

    await userEvent.click(checkbox);
    await expect(checkbox).toBeChecked();
    await waitFor(() => expect(checkbox).not.toBeChecked());
    await expect(setProductTypePartOrAccessory).toHaveBeenCalledWith({
      data: { isPartOrAccessory: true, productTypeId: 1 },
    });
    await expect(toast.error).toHaveBeenCalledOnce();
  },
};

/** A pending request disables only the row being saved. */
export const PendingUpdate: Story = {
  /** Keeps the persistence request pending for the interaction assertion. */
  beforeEach: () => {
    mocked(setProductTypePartOrAccessory).mockImplementation(
      () => new Promise(() => undefined),
    );
  },
  /**
   * Verifies the saving row cannot start an overlapping write.
   *
   * @param context - Story interaction context.
   * @returns A promise that resolves when the checkbox becomes disabled.
   * @rejects When the expected product-type checkboxes are unavailable.
   */
  play: async ({ canvas, userEvent }) => {
    const checkboxes = canvas.getAllByRole("checkbox");
    const checkbox = checkboxes[0];
    const otherCheckbox = checkboxes[1];
    if (!checkbox || !otherCheckbox)
      throw new Error("Product type checkboxes are missing.");

    await userEvent.click(checkbox);
    await waitFor(() => expect(checkbox).toBeDisabled());
    await expect(otherCheckbox).toBeEnabled();
  },
};
