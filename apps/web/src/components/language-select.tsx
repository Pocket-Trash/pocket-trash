import type { SupportedLocale } from "@pocket-trash/localizations";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { localeLabel, supportedLocales } from "@/lib/locale";
import { webText } from "@/lib/ui-text";

type LanguageSelectProps = {
  locale: SupportedLocale;
  onLocaleChange: (locale: SupportedLocale) => void;
};

export function LanguageSelect({
  locale,
  onLocaleChange,
}: LanguageSelectProps) {
  const t = (key: Parameters<typeof webText>[1]) => webText(locale, key);

  return (
    <Select
      items={supportedLocales.map((code) => ({
        label: localeLabel(code),
        value: code,
      }))}
      onValueChange={(value) => onLocaleChange(value as SupportedLocale)}
      value={locale}
    >
      <SelectTrigger aria-label={t("Language")} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {supportedLocales.map((code) => (
          <SelectItem key={code} value={code}>
            {localeLabel(code)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
