import {
  formatTranslation,
  type SupportedLocale,
  type TranslationKey,
} from "@pocket-trash/localizations";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { localeLabel, supportedLocales } from "@/lib/locale";
import { cn } from "@/lib/utils";

type LanguageSelectProps = {
  className?: string;
  locale: SupportedLocale;
  onLocaleChange: (locale: SupportedLocale) => void;
};

export function LanguageSelect({
  className,
  locale,
  onLocaleChange,
}: LanguageSelectProps) {
  const t = (key: TranslationKey) => formatTranslation(key, {}, locale);

  return (
    <Select
      items={supportedLocales.map((code) => ({
        label: localeLabel(code, t),
        value: code,
      }))}
      onValueChange={(value) => onLocaleChange(value as SupportedLocale)}
      value={locale}
    >
      <SelectTrigger
        aria-label={t("web.navigation.selectLanguage")}
        className={cn("w-full", className)}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {supportedLocales.map((code) => (
          <SelectItem key={code} value={code}>
            {localeLabel(code, t)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
