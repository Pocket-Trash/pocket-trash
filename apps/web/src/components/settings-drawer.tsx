import { useAuth } from "@clerk/tanstack-react-start";
import {
  formatTranslation,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { Settings } from "lucide-react";
import * as React from "react";
import { LanguageSelect } from "@/components/language-select";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { updateLocaleSetting } from "@/lib/locale-api";
import {
  type CurrencyCode,
  currencies,
  type DimensionUnit,
  type WeightUnit,
} from "@/lib/pen-formatters";
import { useLocale } from "@/providers/locale-provider";

type SettingsDrawerProps = {
  currency: CurrencyCode;
  disabled?: boolean;
  onCurrencyChange: (currency: CurrencyCode) => void;
  onUnitsChange: (unit: DimensionUnit) => void;
  onWeightChange: (unit: WeightUnit) => void;
  units: DimensionUnit;
  weight: WeightUnit;
};

export function SettingsDrawer({
  currency,
  disabled = false,
  onCurrencyChange,
  onUnitsChange,
  onWeightChange,
  units,
  weight,
}: SettingsDrawerProps) {
  const [open, setOpen] = React.useState(false);
  const { locale } = useLocale();
  const t = (key: TranslationKey) => formatTranslation(key, {}, locale);

  return (
    <Sheet onOpenChange={setOpen} open={open}>
      <Button
        aria-label={t("web.settings.settings")}
        aria-expanded={open}
        onClick={() => setOpen(true)}
        size="icon"
        title={t("web.settings.settings")}
        type="button"
        variant="outline"
      >
        <Settings />
      </Button>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{t("web.settings.settings")}</SheetTitle>
          <SheetDescription className="sr-only">
            {t("web.settings.displayPreferencesMachinedPens")}
          </SheetDescription>
        </SheetHeader>
        <SettingsPanel
          currency={currency}
          disabled={disabled}
          onCurrencyChange={onCurrencyChange}
          onUnitsChange={onUnitsChange}
          onWeightChange={onWeightChange}
          units={units}
          weight={weight}
        />
      </SheetContent>
    </Sheet>
  );
}

// The settings body, shared by the desktop right-side sheet (above) and the
// compact bottom sheet in the mobile toolbar.
export function SettingsPanel({
  currency,
  disabled = false,
  onCurrencyChange,
  onUnitsChange,
  onWeightChange,
  showTheme = false,
  units,
  weight,
}: SettingsDrawerProps & { showTheme?: boolean }) {
  const { isLoaded, isSignedIn } = useAuth();
  const { locale, setLocale } = useLocale();
  const t = (key: TranslationKey) => formatTranslation(key, {}, locale);

  const onLocaleChange = React.useCallback(
    (nextLocale: typeof locale) => {
      setLocale(nextLocale);

      if (isLoaded && isSignedIn) {
        void updateLocaleSetting(nextLocale);
      }
    },
    [isLoaded, isSignedIn, setLocale],
  );

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-6 py-5">
      {showTheme ? (
        <SettingGroup label={t("web.settings.theme")}>
          <ThemeToggle />
        </SettingGroup>
      ) : null}

      <SettingGroup label={t("web.settings.language")}>
        <LanguageSelect locale={locale} onLocaleChange={onLocaleChange} />
      </SettingGroup>

      <SettingGroup label={t("web.settings.dimensions")}>
        <ToggleGroup
          aria-label={t("web.settings.dimensionUnits")}
          onValueChange={(value) => {
            if (value) onUnitsChange(value as DimensionUnit);
          }}
          type="single"
          value={units}
        >
          <ToggleGroupItem disabled={disabled} value="in">
            {t("web.settings.inches")}
          </ToggleGroupItem>
          <ToggleGroupItem disabled={disabled} value="mm">
            {t("web.settings.millimeters")}
          </ToggleGroupItem>
        </ToggleGroup>
      </SettingGroup>

      <SettingGroup label={t("web.settings.weight")}>
        <ToggleGroup
          aria-label={t("web.settings.weightUnits")}
          onValueChange={(value) => {
            if (value) onWeightChange(value as WeightUnit);
          }}
          type="single"
          value={weight}
        >
          <ToggleGroupItem disabled={disabled} value="g">
            {t("web.settings.grams")}
          </ToggleGroupItem>
          <ToggleGroupItem disabled={disabled} value="oz">
            {t("web.settings.ounces")}
          </ToggleGroupItem>
        </ToggleGroup>
      </SettingGroup>

      <SettingGroup label={t("web.settings.currency")}>
        <Select
          items={currencies.map((code) => ({
            label: currencyLabel(code, t),
            value: code,
          }))}
          onValueChange={(value) => onCurrencyChange(value as CurrencyCode)}
          value={currency}
        >
          <SelectTrigger
            aria-label={t("web.settings.displayCurrency")}
            className="w-full"
            disabled={disabled}
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
      </SettingGroup>

      <div className="mt-auto border-t border-sidebar-border pt-5">
        <h3 className="mb-2 text-[11px] font-semibold tracking-[0.8px] text-muted-foreground uppercase">
          {t("web.settings.about")}
        </h3>
        <p className="text-[12.5px] leading-6 text-muted-foreground">
          {t("web.settings.aboutDescription")}
        </p>
      </div>
    </div>
  );
}

function SettingGroup({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-[11px] tracking-[0.8px] text-muted-foreground uppercase">
        {label}
      </div>
      {children}
    </div>
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
