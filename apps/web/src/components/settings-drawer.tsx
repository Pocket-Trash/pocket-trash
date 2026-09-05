import { useAuth } from "@clerk/tanstack-react-start";
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
import { webText } from "@/lib/ui-text";
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
  const t = (key: Parameters<typeof webText>[1]) => webText(locale, key);

  return (
    <Sheet onOpenChange={setOpen} open={open}>
      <Button
        aria-label={t("Settings")}
        aria-expanded={open}
        onClick={() => setOpen(true)}
        size="icon"
        title={t("Settings")}
        type="button"
        variant="outline"
      >
        <Settings />
      </Button>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{t("Settings")}</SheetTitle>
          <SheetDescription className="sr-only">
            {t("Display preferences for the Machined Pens archive.")}
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
  const t = (key: Parameters<typeof webText>[1]) => webText(locale, key);

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
        <SettingGroup label={t("Theme")}>
          <ThemeToggle />
        </SettingGroup>
      ) : null}

      <SettingGroup label={t("Language")}>
        <LanguageSelect locale={locale} onLocaleChange={onLocaleChange} />
      </SettingGroup>

      <SettingGroup label={t("Dimensions")}>
        <ToggleGroup
          aria-label={t("Dimension units")}
          onValueChange={(value) => {
            if (value) onUnitsChange(value as DimensionUnit);
          }}
          type="single"
          value={units}
        >
          <ToggleGroupItem disabled={disabled} value="in">
            {t("Inches")}
          </ToggleGroupItem>
          <ToggleGroupItem disabled={disabled} value="mm">
            {t("Millimeters")}
          </ToggleGroupItem>
        </ToggleGroup>
      </SettingGroup>

      <SettingGroup label={t("Weight")}>
        <ToggleGroup
          aria-label={t("Weight units")}
          onValueChange={(value) => {
            if (value) onWeightChange(value as WeightUnit);
          }}
          type="single"
          value={weight}
        >
          <ToggleGroupItem disabled={disabled} value="g">
            {t("Grams")}
          </ToggleGroupItem>
          <ToggleGroupItem disabled={disabled} value="oz">
            {t("Ounces")}
          </ToggleGroupItem>
        </ToggleGroup>
      </SettingGroup>

      <SettingGroup label={t("Currency")}>
        <Select
          items={currencies.map((code) => ({
            label: currencyLabel(code),
            value: code,
          }))}
          onValueChange={(value) => onCurrencyChange(value as CurrencyCode)}
          value={currency}
        >
          <SelectTrigger
            aria-label={t("Display currency")}
            className="w-full"
            disabled={disabled}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {currencies.map((code) => (
              <SelectItem key={code} value={code}>
                {currencyLabel(code)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingGroup>

      <div className="mt-auto border-t border-sidebar-border pt-5">
        <h3 className="mb-2 text-[11px] font-semibold tracking-[0.8px] text-muted-foreground uppercase">
          About
        </h3>
        <p className="text-[12.5px] leading-6 text-muted-foreground">
          An unofficial archive of machined pen drops, with filters, specs,
          descriptions, and local image backups. Made by a fan; not affiliated
          with any maker.
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

function currencyLabel(code: CurrencyCode) {
  switch (code) {
    case "CAD":
      return "$ CAD (native)";
    case "USD":
      return "$ USD";
    case "EUR":
      return "EUR EUR";
    case "GBP":
      return "GBP GBP";
    case "AUD":
      return "$ AUD";
    case "JPY":
      return "JPY JPY";
    case "CHF":
      return "CHF";
    case "NZD":
      return "$ NZD";
  }
}
