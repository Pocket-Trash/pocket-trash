import {
  formatTranslation,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { ArrowUpDown, Check, Search, SlidersHorizontal, X } from "lucide-react";
import * as React from "react";
import { FilterSidebar } from "@/components/filter-sidebar";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { useKeyboardInset } from "@/hooks/use-keyboard-inset";
import type { PenProduct } from "@/lib/pen-data";
import type {
  ActiveFilters,
  FilterKey,
  MatchMode,
  MatchModes,
  SortKey,
} from "@/lib/pen-filters";
import { cn } from "@/lib/utils";
import { useLocale } from "@/providers/locale-provider";

// Height of the bar itself (excludes the safe-area padding below it). Kept in
// sync with the reserved bottom padding in `app-shell.tsx`.
const BAR_HEIGHT = "3.5rem";

type MobileToolbarProps = {
  active: ActiveFilters;
  filterCount: number;
  matchModes: MatchModes;
  onClearFilters: () => void;
  onMatchModeChange: (key: FilterKey, mode: MatchMode) => void;
  onQueryChange: (query: string) => void;
  onSortChange: (sort: SortKey) => void;
  onToggleFilter: (key: FilterKey, value: string) => void;
  products: PenProduct[];
  query: string;
  sort: SortKey;
  sortOptions: Array<{ label: string; value: SortKey }>;
};

/**
 * Compact-only (`< md`) bottom toolbar. It is a toolbar, not a nav bar: each
 * item opens a sheet or field rather than switching screens. Filters and Sort
 * are vaul bottom sheets (swipe-to-dismiss); Search expands a field docked
 * above the bar. Hidden at `md` and up, where the persistent sidebar and header
 * controls take over.
 */
export function MobileToolbar({
  active,
  filterCount,
  matchModes,
  onClearFilters,
  onMatchModeChange,
  onQueryChange,
  onSortChange,
  onToggleFilter,
  products,
  query,
  sort,
  sortOptions,
}: MobileToolbarProps) {
  const { locale } = useLocale();
  const t = (key: TranslationKey) => formatTranslation(key, {}, locale);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [sortOpen, setSortOpen] = React.useState(false);
  // Distinct from the desktop header search field so the two inputs never share
  // an id (the header one stays mounted, just hidden, on compact).
  const searchInputId = React.useId();
  const searchRef = React.useRef<HTMLInputElement>(null);

  // Focus the field when it opens (replaces autoFocus, which fights the sheets).
  React.useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  // Dock the field to the top of the on-screen keyboard. iOS Safari overlays
  // the keyboard without shrinking the layout viewport, so without this the
  // fixed field stays anchored behind the keyboard and floats detached.
  const keyboardInset = useKeyboardInset(searchOpen);

  return (
    <div className="md:hidden">
      {searchOpen ? (
        <div
          className="fixed inset-x-0 z-40 flex items-center gap-2 border-t border-border bg-background/95 p-2 backdrop-blur"
          style={{
            // While the keyboard is up, sit flush on its tray; otherwise rest
            // above the bottom toolbar (clear of the home indicator).
            bottom:
              keyboardInset > 0
                ? `${keyboardInset}px`
                : `calc(${BAR_HEIGHT} + env(safe-area-inset-bottom))`,
          }}
        >
          <label
            className="relative flex flex-1 items-center"
            htmlFor={searchInputId}
          >
            <Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground" />
            <Input
              aria-label={t("web.archive.searchProducts")}
              autoComplete="off"
              className="pr-3 pl-9"
              id={searchInputId}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder={t("web.archive.searchPlaceholder")}
              ref={searchRef}
              type="search"
              value={query}
            />
          </label>
          <button
            aria-label={t("web.archive.closeSearch")}
            className="flex size-9 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
            onClick={() => setSearchOpen(false)}
            type="button"
          >
            <X className="size-5" />
          </button>
        </div>
      ) : null}

      <nav
        aria-label={t("web.archive.controls")}
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-3 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
        style={{ height: `calc(${BAR_HEIGHT} + env(safe-area-inset-bottom))` }}
      >
        <ToolbarButton
          active={searchOpen || query.length > 0}
          icon={Search}
          label={t("web.action.search")}
          onClick={() => setSearchOpen((open) => !open)}
        />

        <Drawer>
          <DrawerTrigger asChild>
            <ToolbarButton
              active={filterCount > 0}
              badge={filterCount}
              icon={SlidersHorizontal}
              label={t("web.archive.filters")}
            />
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>{t("web.archive.filters")}</DrawerTitle>
              <DrawerDescription className="sr-only">
                {t("web.archive.filterDescription")}
              </DrawerDescription>
            </DrawerHeader>
            <div className="overflow-y-auto px-2 pb-4">
              <FilterSidebar
                active={active}
                matchModes={matchModes}
                onClear={onClearFilters}
                onMatchModeChange={onMatchModeChange}
                onToggleFilter={onToggleFilter}
                products={products}
              />
            </div>
          </DrawerContent>
        </Drawer>

        <Drawer onOpenChange={setSortOpen} open={sortOpen}>
          <DrawerTrigger asChild>
            <ToolbarButton
              icon={ArrowUpDown}
              label={t("web.archive.sortLabel")}
            />
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>{t("web.archive.sortLabel")}</DrawerTitle>
              <DrawerDescription className="sr-only">
                {t("web.archive.sortDescription")}
              </DrawerDescription>
            </DrawerHeader>
            <div className="overflow-y-auto p-2">
              {sortOptions.map((option) => {
                const selected = option.value === sort;
                return (
                  <button
                    className={cn(
                      "flex w-full items-center justify-between rounded-md px-3 py-3 text-left text-sm hover:bg-accent hover:text-accent-foreground",
                      selected && "font-semibold text-foreground",
                    )}
                    key={option.value}
                    onClick={() => {
                      onSortChange(option.value);
                      setSortOpen(false);
                    }}
                    type="button"
                  >
                    {option.label}
                    {selected ? <Check className="size-4" /> : null}
                  </button>
                );
              })}
            </div>
          </DrawerContent>
        </Drawer>
      </nav>
    </div>
  );
}

type ToolbarButtonProps = React.ComponentProps<"button"> & {
  active?: boolean;
  badge?: number;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
};

const ToolbarButton = React.forwardRef<HTMLButtonElement, ToolbarButtonProps>(
  ({ active, badge, className, icon: Icon, label, ...props }, ref) => (
    <button
      className={cn(
        "relative flex h-full flex-col items-center justify-center gap-0.5 text-[10px] font-medium tracking-[0.2px] transition-colors",
        active ? "text-primary" : "text-muted-foreground hover:text-foreground",
        className,
      )}
      ref={ref}
      type="button"
      {...props}
    >
      <span className="relative">
        <Icon className="size-5" />
        {badge && badge > 0 ? (
          <span className="absolute -top-1.5 -right-2.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] leading-4 font-bold text-primary-foreground">
            {badge}
          </span>
        ) : null}
      </span>
      {label}
    </button>
  ),
);
ToolbarButton.displayName = "ToolbarButton";
