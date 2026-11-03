import type { CollectionItemStatusState, MoneyValue } from "@package/services";
import { type CurrencyCode, currencies } from "@/lib/pen-formatters";

/** Form-owned decimal text and its selected currency preserve incomplete input. */
export type CollectionMoneyInput = {
  /** Unformatted decimal amount, or empty text to clear the price. */
  amount: string;
  /** Currency chosen for this specific price. */
  currencyCode: CurrencyCode;
};

/**
 * Converts decimal form text to exact minor units without floating-point rounding.
 * @param input - Raw form text and its selected supported currency.
 * @returns Persistable money, or undefined when the amount is empty.
 * @throws When the input is negative, incomplete, too precise, or outside safe integer range.
 */
export function moneyFromInput(
  input: CollectionMoneyInput,
): MoneyValue | undefined {
  const amount = input.amount.trim();
  if (!amount) return undefined;
  const digits = input.currencyCode === "JPY" ? 0 : 2;
  if (!(digits ? /^\d+(?:\.\d{1,2})?$/ : /^\d+$/).test(amount))
    throw new Error("web.collectionItemMetadata.moneyAmountError");
  const [whole, fraction = ""] = amount.split(".");
  const amountMinor = Number(`${whole}${fraction.padEnd(digits, "0")}`);
  if (!Number.isSafeInteger(amountMinor))
    throw new Error("web.collectionItemMetadata.moneyAmountError");
  return { amountMinor, currencyCode: input.currencyCode };
}

/**
 * Restores exact decimal input from saved money, retaining its historical currency.
 * @param money - Persisted value, or undefined for an empty field.
 * @param preferredCurrency - Default used only when no persisted money exists.
 * @returns Form-owned amount text and currency.
 */
export function moneyInput(
  money: MoneyValue | undefined,
  preferredCurrency: CurrencyCode,
): CollectionMoneyInput {
  const currencyCode =
    currencies.find((code) => code === money?.currencyCode) ??
    preferredCurrency;
  if (!money) return { amount: "", currencyCode };
  const digits = String(money.amountMinor).padStart(3, "0");
  return {
    amount:
      currencyCode === "JPY"
        ? String(money.amountMinor)
        : `${digits.slice(0, -2)}.${digits.slice(-2)}`,
    currencyCode,
  };
}

/**
 * Formats persisted minor units in their original currency without losing cents.
 * @param money - Exact saved price.
 * @param locale - Active supported display locale.
 * @returns Locale-formatted price in the saved currency.
 */
export function formatCollectionMoney(
  money: MoneyValue,
  locale: string,
): string {
  const divisor = money.currencyCode === "JPY" ? 1n : 100n;
  const amount = BigInt(money.amountMinor);
  const fraction = String(amount % divisor).padStart(2, "0");
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: money.currencyCode,
  })
    .formatToParts(amount / divisor)
    .map((part) => (part.type === "fraction" ? fraction : part.value))
    .join("");
}

/**
 * Determines whether the selected item state has an editable sale price.
 * @param statuses - Current independently selected scopes.
 * @param ownership - Selected ownership-period editor state, when editing history.
 * @returns Whether a sale is selected through statuses or lifecycle controls.
 */
export function hasCollectionSalePrice(
  statuses: CollectionItemStatusState,
  ownership?: {
    /** Whether the selected ownership period remains open. */
    currentlyOwned: boolean;
    /** Selected departure reason. */
    exitReason: string;
  },
): boolean {
  return (
    statuses.public.includes("sold") ||
    statuses.private.includes("sold") ||
    Boolean(
      ownership && !ownership.currentlyOwned && ownership.exitReason === "sale",
    )
  );
}
