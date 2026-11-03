import {
  formatTranslation,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { useId } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type CollectionMoneyInput, moneyFromInput } from "@/lib/catalog-money";
import { currencies } from "@/lib/pen-formatters";
import { useLocale } from "@/providers/locale-provider";

/**
 * Edits exact decimal money using existing input and currency-select primitives.
 * @param props - Form-owned raw amount, currency, and price visibility.
 * @returns One labeled price field that retains invalid input and explains errors.
 */
export function CollectionItemPriceField(props: {
  /** Whether this is an always-private sold price. */
  sold?: boolean;
  /** Raw amount and historical or preferred currency. */
  value: CollectionMoneyInput;
  /** Paid-price public designation. */
  isPublic?: boolean;
  /**
   * Updates raw amount or currency without discarding incomplete input.
   * @param value - Replacement form value.
   */
  onChange: (value: CollectionMoneyInput) => void;
  /**
   * Updates the paid price's saved public designation.
   * @param value - Public visibility choice.
   */
  onPublicChange?: (value: boolean) => void;
}) {
  const { locale } = useLocale();
  const id = useId();
  /**
   * Formats a field label in the current locale.
   * @param key - Semantic message key.
   * @returns Localized label.
   */
  const t = (key: TranslationKey) => formatTranslation(key, {}, locale);
  let invalid = false;
  try {
    moneyFromInput(props.value);
  } catch {
    invalid = true;
  }
  return (
    <fieldset className="mt-4 grid gap-2 border-t pt-4">
      <legend id={`${id}-price`}>
        {t(
          props.sold
            ? "web.collectionItemMetadata.priceSold"
            : "web.collectionItemMetadata.pricePaid",
        )}
      </legend>
      <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-2">
        <Input
          aria-labelledby={`${id}-price`}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? `${id}-error` : undefined}
          inputMode="decimal"
          maxLength={32}
          value={props.value.amount}
          onChange={(event) =>
            props.onChange({ ...props.value, amount: event.target.value })
          }
        />
        <Select
          items={currencies.map((code) => ({ label: code, value: code }))}
          value={props.value.currencyCode}
          onValueChange={(code) => {
            const currencyCode = currencies.find((value) => value === code);
            if (currencyCode) props.onChange({ ...props.value, currencyCode });
          }}
        >
          <SelectTrigger aria-label={t("web.collectionItemMetadata.currency")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {currencies.map((code) => (
              <SelectItem key={code} value={code}>
                {code}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {invalid ? (
        <p id={`${id}-error`} role="alert" className="text-destructive">
          {t("web.collectionItemMetadata.moneyAmountError")}
        </p>
      ) : null}
      {props.sold ? (
        <p className="text-muted-foreground">
          {t("web.collectionItemMetadata.soldIsPrivate")}
        </p>
      ) : (
        <label className="flex min-h-9 items-center gap-2">
          <input
            type="checkbox"
            className="size-4"
            checked={props.isPublic ?? false}
            onChange={(event) => props.onPublicChange?.(event.target.checked)}
          />
          {t("web.collectionItemMetadata.paidIsPublic")}
        </label>
      )}
    </fieldset>
  );
}
