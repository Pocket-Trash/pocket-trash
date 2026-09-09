import {
  formatTranslation,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { Monitor, Moon, Sun } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ThemeMode } from "@/lib/theme";
import { useLocale } from "@/providers/locale-provider";
import { useTheme } from "@/providers/theme-provider";

const themeOptions: Array<{
  icon: typeof Sun;
  labelKey: TranslationKey;
  value: ThemeMode;
}> = [
  { icon: Moon, labelKey: "web.settings.dark", value: "dark" },
  { icon: Sun, labelKey: "web.settings.light", value: "light" },
  { icon: Monitor, labelKey: "web.settings.system", value: "system" },
];

export function ThemeToggle() {
  const { saving, setTheme, theme } = useTheme();
  const { locale } = useLocale();
  const t = (key: TranslationKey) => formatTranslation(key, {}, locale);

  return (
    <ToggleGroup
      aria-label={t("web.settings.theme")}
      className="mx-auto h-9 w-fit gap-0.5 rounded-full border-sidebar-border bg-secondary/20 p-1"
      onValueChange={(value) => {
        if (value) setTheme(value as ThemeMode);
      }}
      type="single"
      value={theme}
    >
      {themeOptions.map((option) => {
        const Icon = option.icon;
        const label = t(option.labelKey);

        return (
          <Tooltip key={option.value}>
            <TooltipTrigger
              render={
                <ToggleGroupItem
                  aria-label={label}
                  className="size-7 flex-none rounded-full p-0 text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[pressed]:bg-background data-[pressed]:text-foreground data-[pressed]:shadow-sm [&_svg]:size-4"
                  disabled={saving}
                  value={option.value}
                />
              }
            >
              <Icon />
            </TooltipTrigger>
            <TooltipContent side="top">{label}</TooltipContent>
          </Tooltip>
        );
      })}
    </ToggleGroup>
  );
}
