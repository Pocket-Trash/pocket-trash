import {
  formatTranslation,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { PenProduct } from "@/lib/pen-data";
import {
  type ActiveFilters,
  type FilterKey,
  filterGroups,
  type MatchMode,
  type MatchModes,
  valuesFor,
} from "@/lib/pen-filters";
import { cn } from "@/lib/utils";
import { useLocale } from "@/providers/locale-provider";

type FilterSidebarProps = {
  active: ActiveFilters;
  matchModes: MatchModes;
  onClear: () => void;
  onMatchModeChange: (key: FilterKey, mode: MatchMode) => void;
  onToggleFilter: (key: FilterKey, value: string) => void;
  products: PenProduct[];
};

export function FilterSidebar({
  active,
  matchModes,
  onClear,
  onMatchModeChange,
  onToggleFilter,
  products,
}: FilterSidebarProps) {
  const { locale } = useLocale();
  const t = (
    key: TranslationKey,
    values: Readonly<Record<string, unknown>> = {},
  ) => formatTranslation(key, values, locale);

  return (
    <div className="px-2 py-1 text-sidebar-foreground">
      {filterGroups.map((group) => (
        <section key={group.key} className="mt-5 first:mt-0">
          {/*
            Product tag values come from catalog data; group labels are app UI.
          */}
          <div className="mb-2 flex min-h-[26px] items-center justify-between gap-2 border-b border-sidebar-border pb-1.5">
            <h2 className="text-[12.5px] font-bold tracking-[1.2px] uppercase">
              {t(group.labelKey)}
            </h2>
            {group.andable ? (
              <ToggleGroup
                aria-label={t("web.archive.filter.matchMode", {
                  label: t(group.labelKey),
                })}
                className={cn(
                  "h-[25px] w-auto gap-0 p-0.5",
                  active[group.key].size < 2 && "invisible",
                )}
                onValueChange={(value) => {
                  if (value) onMatchModeChange(group.key, value as MatchMode);
                }}
                type="single"
                value={matchModes[group.key]}
              >
                <ToggleGroupItem className="h-5 px-2 text-[10px]" value="any">
                  {t("web.archive.filter.any")}
                </ToggleGroupItem>
                <ToggleGroupItem className="h-5 px-2 text-[10px]" value="all">
                  {t("web.archive.filter.all")}
                </ToggleGroupItem>
              </ToggleGroup>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-1">
            {valuesFor(products, group.key).map(([value, count]) => {
              const selected = active[group.key].has(value);
              return (
                <button
                  className={cn(
                    "rounded-full border border-transparent px-2 py-1 text-[11.5px] whitespace-nowrap transition-colors hover:border-primary",
                    selected
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground",
                  )}
                  key={value}
                  onClick={() => onToggleFilter(group.key, value)}
                  type="button"
                >
                  {value}
                  <span className="ml-1 opacity-65">{count}</span>
                </button>
              );
            })}
          </div>
        </section>
      ))}

      <Button className="mt-4 w-full" onClick={onClear} variant="outline">
        {t("web.action.clearAllFilters")}
      </Button>
    </div>
  );
}
