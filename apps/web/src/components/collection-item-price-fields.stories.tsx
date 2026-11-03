import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { useReducer } from "react";
import { expect } from "storybook/test";
import { type CollectionMoneyInput, moneyFromInput } from "@/lib/catalog-money";
import { StoryProviders } from "../../.storybook/story-fixtures";
import { CollectionItemPriceField } from "./collection-item-price-fields";

/**
 * Owns raw money text for observable input-to-minor-unit story coverage.
 * @param props - Initial amount/currency and price role.
 * @returns Interactive money field and its persisted representation.
 */
function Controlled(props: {
  /** Initial amount and currency. */
  value: CollectionMoneyInput;
  /** Whether the price is a private sale amount. */
  sold?: boolean;
}) {
  const [value, update] = useReducer(
    (_state: CollectionMoneyInput, next: CollectionMoneyInput) => next,
    props.value,
  );
  let result = "";
  try {
    result = String(moneyFromInput(value)?.amountMinor ?? "");
  } catch {
    result = "invalid";
  }
  return (
    <>
      <CollectionItemPriceField {...props} value={value} onChange={update} />
      <output>{result}</output>
    </>
  );
}
/** Exact decimal price input stories with locale and tooltip providers. */
const meta = {
  component: Controlled,
  title: "Components/CollectionItemPriceField",
  args: { value: { amount: "0", currencyCode: "JPY" } },
  decorators: [
    (Story) => (
      <StoryProviders>
        <Story />
      </StoryProviders>
    ),
  ],
} satisfies Meta<typeof Controlled>;
export default meta;
/** Ownership price input story contract. */
type Story = StoryObj<typeof meta>;
/** JPY accepts zero and whole yen while retaining invalid fractional input for correction. */
export const Yen: Story = {
  /**
   * Exercises zero values, JPY precision, and raw-input preservation.
   * @param context - Story canvas and browser interaction driver.
   */
  play: async (context) => {
    const amount = context.canvas.getByRole("textbox", { name: "Price paid" });
    await expect(context.canvas.getByRole("status")).toHaveTextContent("0");
    await context.userEvent.clear(amount);
    await context.userEvent.type(amount, "1200");
    await expect(context.canvas.getByRole("status")).toHaveTextContent("1200");
    await context.userEvent.type(amount, ".5");
    await expect(amount).toHaveValue("1200.5");
    await expect(amount).toHaveAttribute("aria-invalid", "true");
    await expect(context.canvas.getByRole("alert")).toBeVisible();
  },
};
/** USD cents are parsed from decimal text without binary floating-point rounding. */
export const Cents: Story = {
  args: { value: { amount: "0.29", currencyCode: "USD" } },
  /**
   * Verifies the known decimal-to-minor-unit result.
   * @param context - Story canvas.
   */
  play: async (context) => {
    await expect(context.canvas.getByRole("status")).toHaveTextContent("29");
  },
};
/** Sold prices have an explicit private label and no public visibility switch. */
export const PrivateSale: Story = {
  args: { sold: true, value: { amount: "185.00", currencyCode: "CAD" } },
};
