import {
  formatTranslation,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { UserPageShell } from "@/components/user-page-shell";
import { usePenSettings } from "@/hooks/use-pen-settings";
import {
  type CurrencyCode,
  currencies,
  type DimensionUnit,
  type WeightUnit,
} from "@/lib/pen-formatters";
import { useLocale } from "@/providers/locale-provider";

export function UserSettingsPage() {
  const { locale } = useLocale();
  const t = (key: TranslationKey) => formatTranslation(key, {}, locale);
  const { currency, saving, setCurrency, setUnits, setWeight, units, weight } =
    usePenSettings();

  return (
    <UserPageShell title={t("web.settings.settings")}>
      <div className="grid w-full max-w-xl gap-6">
        <div className="grid gap-6 rounded-lg border border-border bg-card p-4 sm:p-6">
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {t("web.settings.dimensions")}
            </legend>
            <ToggleGroup
              aria-label={t("web.settings.dimensionUnits")}
              onValueChange={(value) => {
                if (value) setUnits(value as DimensionUnit);
              }}
              type="single"
              value={units}
            >
              <ToggleGroupItem disabled={saving} value="in">
                {t("web.settings.inches")}
              </ToggleGroupItem>
              <ToggleGroupItem disabled={saving} value="mm">
                {t("web.settings.millimeters")}
              </ToggleGroupItem>
            </ToggleGroup>
          </fieldset>

          <fieldset className="grid gap-2">
            <legend className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {t("web.settings.weight")}
            </legend>
            <ToggleGroup
              aria-label={t("web.settings.weightUnits")}
              onValueChange={(value) => {
                if (value) setWeight(value as WeightUnit);
              }}
              type="single"
              value={weight}
            >
              <ToggleGroupItem disabled={saving} value="g">
                {t("web.settings.grams")}
              </ToggleGroupItem>
              <ToggleGroupItem disabled={saving} value="oz">
                {t("web.settings.ounces")}
              </ToggleGroupItem>
            </ToggleGroup>
          </fieldset>

          <fieldset className="grid gap-2">
            <legend className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {t("web.settings.currency")}
            </legend>
            <Select
              items={currencies.map((code) => ({
                label: currencyLabel(code, t),
                value: code,
              }))}
              onValueChange={(value) => setCurrency(value as CurrencyCode)}
              value={currency}
            >
              <SelectTrigger
                aria-label={t("web.settings.displayCurrency")}
                className="w-full"
                disabled={saving}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {currencies.map((code) => (
                  <SelectItem key={code} value={code}>
                    {currencyLabel(code, t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </fieldset>
        </div>

        <Button
          className="w-fit"
          nativeButton={false}
          render={<Link to="/user/settings/beta-features" />}
          variant="outline"
        >
          {t("web.navigation.betaFeatures")}
        </Button>
      </div>
    </UserPageShell>
  );
}

function currencyLabel(code: CurrencyCode, t: (key: TranslationKey) => string) {
  switch (code) {
    case "CAD":
      return t("web.currency.cad");
    case "USD":
      return t("web.currency.usd");
    case "EUR":
      return t("web.currency.eur");
    case "GBP":
      return t("web.currency.gbp");
    case "AUD":
      return t("web.currency.aud");
    case "JPY":
      return t("web.currency.jpy");
    case "CHF":
      return t("web.currency.chf");
    case "NZD":
      return t("web.currency.nzd");
  }
}
