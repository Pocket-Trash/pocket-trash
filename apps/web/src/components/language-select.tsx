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

/** Controlled locale selection state and change handler. */
type LanguageSelectProps = {
  /**
   * Additional CSS classes.
   */
  className?: string;
  /** Currently selected locale. */
  locale: SupportedLocale;
  /**
   * Reports a locale selected by the user.
   *
   * @param locale - Newly selected locale.
   */
  onLocaleChange: (locale: SupportedLocale) => void;
};

/**
 * Renders a controlled selector for every supported locale.
 *
 * @param props - Language select properties.
 * @param props.className - Additional CSS classes.
 * @param props.locale - Currently selected locale.
 * @param props.onLocaleChange - Receives a newly selected locale.
 * @returns The locale selector.
 */
export function LanguageSelect({
  className,
  locale,
  onLocaleChange,
}: LanguageSelectProps) {
  /**
   * Formats a language-selector translation for the selected locale.
   *
   * @param key - Language-selector localization key.
   * @returns The localized selector text.
   */
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
