import { Monitor, Moon, Sun } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ThemeMode } from "@/lib/theme";
import { webText } from "@/lib/ui-text";
import { useLocale } from "@/providers/locale-provider";
import { useTheme } from "@/providers/theme-provider";

const themeOptions: Array<{
  icon: typeof Sun;
  label: string;
  value: ThemeMode;
}> = [
  { icon: Moon, label: "Dark", value: "dark" },
  { icon: Sun, label: "Light", value: "light" },
  { icon: Monitor, label: "System", value: "system" },
];

export function ThemeToggle() {
  const { saving, setTheme, theme } = useTheme();
  const { locale } = useLocale();
  const t = (key: Parameters<typeof webText>[1]) => webText(locale, key);

  return (
    <ToggleGroup
      aria-label={t("Theme")}
      className="mx-auto h-9 w-fit gap-0.5 rounded-full border-sidebar-border bg-secondary/20 p-1"
      onValueChange={(value) => {
        if (value) setTheme(value as ThemeMode);
      }}
      type="single"
      value={theme}
    >
      {themeOptions.map((option) => {
        const Icon = option.icon;
        const label = t(option.label as Parameters<typeof webText>[1]);

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
