import type { TrendsProductTypeConfiguration } from "@package/services";
import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { toast } from "sonner";
import { expect, mocked, waitFor } from "storybook/test";
import { setProductTypeTrendsInclusion } from "@/lib/catalog-api";
import { mockStoryRole, StoryProviders } from "../../.storybook/story-fixtures";
import { AdminTrendsConfigPage } from "./admin-config-pages";

/** Primary and secondary product types used by Trends configuration stories. */
const productTypes: TrendsProductTypeConfiguration[] = [
  {
    id: 1000,
    includeInTrends: true,
    isPartOrAccessory: false,
    name: "Slider",
    slug: "slider",
  },
  {
    id: 1001,
    includeInTrends: false,
    isPartOrAccessory: true,
    name: "Slider Plate",
    slug: "slider-plate",
  },
];

/** Public Trends configuration Storybook setup. */
const meta = {
  args: { productTypes },
  /** Configures administrator authorization and persistence mocks. */
  beforeEach: () => {
    mockStoryRole("admin");
    mocked(toast.error).mockClear();
    mocked(toast.success).mockClear();
    mocked(setProductTypeTrendsInclusion).mockImplementation(
      async (options) => {
        if (!options) throw new Error("Trends update data is required.");
        const data = options.data;
        if (
          typeof data !== "object" ||
          data === null ||
          !("productTypeId" in data) ||
          !("includeInTrends" in data) ||
          typeof data.productTypeId !== "number" ||
          typeof data.includeInTrends !== "boolean"
        )
          throw new Error("Trends update data is invalid.");
        const productType = productTypes.find(
          ({ id }) => id === data.productTypeId,
        );
        if (!productType) throw new Error("Product type fixture is missing.");
        return { ...productType, includeInTrends: data.includeInTrends };
      },
    );
  },
  component: AdminTrendsConfigPage,
  decorators: [
    (Story) => (
      <StoryProviders>
        <Story />
      </StoryProviders>
    ),
  ],
  parameters: { layout: "fullscreen" },
  title: "Components/AdminTrendsConfigPage",
} satisfies Meta<typeof AdminTrendsConfigPage>;

export default meta;
/** Public Trends configuration story. */
type Story = StoryObj<typeof meta>;

/** Primary read-only state and successful secondary inclusion. */
export const Default: Story = {
  /**
   * Verifies primary and secondary control behavior.
   *
   * @param context - Story interaction context.
   * @returns Completion after the update is persisted.
   * @rejects When an expected control or update result is unavailable.
   */
  play: async ({ canvas, userEvent }) => {
    const [primary, secondary] = canvas.getAllByRole("checkbox");
    if (!primary || !secondary)
      throw new Error("Trends configuration controls are missing.");
    await expect(primary).toBeChecked();
    await expect(primary).toBeDisabled();
    await expect(secondary).not.toBeChecked();

    await userEvent.click(secondary);
    await waitFor(() => expect(toast.success).toHaveBeenCalledOnce());
    await expect(setProductTypeTrendsInclusion).toHaveBeenCalledWith({
      data: { includeInTrends: true, productTypeId: 1001 },
    });
    await expect(secondary).toBeChecked();
  },
};

/** Failed secondary updates restore the persisted exclusion state. */
export const FailedUpdate: Story = {
  /** Configures a rejected persistence request. */
  beforeEach: () => {
    mocked(setProductTypeTrendsInclusion).mockRejectedValueOnce(
      new Error("Persistence failed"),
    );
  },
  /**
   * Verifies optimistic state rolls back after a failed request.
   *
   * @param context - Story interaction context.
   * @returns Completion after rollback.
   * @rejects When the secondary control is unavailable.
   */
  play: async ({ canvas, userEvent }) => {
    const secondary = canvas.getAllByRole("checkbox")[1];
    if (!secondary) throw new Error("Secondary Trends control is missing.");
    await userEvent.click(secondary);
    await waitFor(() => expect(secondary).not.toBeChecked());
    await expect(toast.error).toHaveBeenCalledOnce();
  },
};

/** A pending rebuild disables the affected secondary control. */
export const PendingUpdate: Story = {
  /** Keeps the aggregate rebuild pending for the interaction assertion. */
  beforeEach: () => {
    mocked(setProductTypeTrendsInclusion).mockImplementation(
      () => new Promise(() => undefined),
    );
  },
  /**
   * Verifies an overlapping write cannot be started.
   *
   * @param context - Story interaction context.
   * @returns Completion when the control becomes disabled.
   * @rejects When the secondary control is unavailable.
   */
  play: async ({ canvas, userEvent }) => {
    const secondary = canvas.getAllByRole("checkbox")[1];
    if (!secondary) throw new Error("Secondary Trends control is missing.");
    await userEvent.click(secondary);
    await waitFor(() => expect(secondary).toBeDisabled());
  },
};
