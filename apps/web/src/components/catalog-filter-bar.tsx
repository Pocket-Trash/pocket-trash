import type { CatalogColor } from "@package/services";
import { SlidersHorizontal } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  CatalogCombobox,
  CatalogMultiCombobox,
} from "@/components/ui/combobox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  type CatalogFacet,
  type CatalogFacets,
  type CatalogFilters,
  emptyCatalogFilters,
  fadeKey,
  hasCatalogFilters,
  pruneCatalogFilters,
} from "@/lib/catalog-filters";
import { cn } from "@/lib/utils";

/**
 * Localized labels and label builders used by catalog filter controls.
 */
export type CatalogFilterCopy = {
  /**
   * Label for requiring all selected values.
   */
  all: string;
  /**
   * Label for accepting any selected value.
   */
  any: string;
  /**
   * Label for closing the advanced filter panel after applying filters.
   */
  apply: string;
  /**
   * Label for clearing all filters.
   */
  clear: string;
  /**
   * Prefix for selection-removal accessible labels.
   */
  close: string;
  /**
   * Color facet label.
   */
  colors: string;
  /**
   * Description of the advanced filter sheet.
   */
  description: string;
  /**
   * Builds the display label for a color fade.
   *
   * @param colors - Arrow-separated color names in the fade.
   * @returns The localized fade label.
   */
  fadeName: (colors: string) => string;
  /**
   * Advanced filter panel title.
   */
  filters: string;
  /**
   * Finish facet label.
   */
  finishes: string;
  /**
   * Maker facet label.
   */
  maker: string;
  /**
   * Any/all matching fieldset label.
   */
  matchMode: string;
  /**
   * Material facet label.
   */
  materials: string;
  /**
   * Short label for opening overflow facet options.
   */
  more: string;
  /**
   * Label for opening advanced filters.
   */
  moreFilters: string;
  /**
   * Builds an accessible label for overflow facet options.
   *
   * @param label - Facet label whose overflow options will open.
   * @returns The localized overflow-options label.
   */
  moreOptions: (label: string) => string;
  /**
   * Product-type facet label.
   */
  productType: string;
  /**
   * Label for the all-product-types option.
   */
  productTypeAll: string;
  /**
   * Placeholder for the maker combobox.
   */
  selectMaker: string;
  /**
   * Placeholder for the product-type combobox.
   */
  selectProductType: string;
  /** Accessible label for shared catalog search. */
  searchLabel: string;
  /** Placeholder for shared catalog search. */
  searchPlaceholder: string;
};

/**
 * Renders quick catalog facets in route flow and advanced facets in a desktop
 * overlay or mobile sheet. The controlled state is pruned against the supplied
 * facets, and color controls expose tooltips, pressed state, and a visible
 * selection border.
 *
 * @param props - Catalog filter bar properties.
 * @param props.action - Optional trailing action beside the filter controls.
 * @param props.copy - Localized filter labels and label builders.
 * @param props.facets - Available catalog facet values and counts.
 * @param props.filters - Current controlled filter state.
 * @param props.onChange - Callback receiving the complete next filter state.
 * @returns The responsive catalog filter controls.
 */
export function CatalogFilterBar({
  action,
  copy,
  facets,
  filters,
  onChange,
}: {
  /**
   * Optional trailing action beside the filter controls.
   */
  action?: React.ReactNode;
  /**
   * Localized filter labels and label builders.
   */
  copy: CatalogFilterCopy;
  /**
   * Available catalog facet values and counts.
   */
  facets: CatalogFacets;
  /**
   * Current controlled filter state.
   */
  filters: CatalogFilters;
  /**
   * Replaces the controlled filter state.
   *
   * @param filters - Complete next filter state.
   */
  onChange: (filters: CatalogFilters) => void;
}) {
  const [desktopAdvancedOpen, setDesktopAdvancedOpen] = React.useState(false);
  const [mobileAdvancedOpen, setMobileAdvancedOpen] = React.useState(false);
  const desktopRootRef = React.useRef<HTMLDivElement>(null);
  const advancedId = React.useId();
  const facetKey = JSON.stringify({
    colors: facets.colors.map(({ id }) => id),
    fades: facets.fades.map(({ key }) => key),
    finishes: facets.finishes.map(({ id }) => id),
    makers: facets.makers.map(({ id }) => id),
    materials: facets.materials.map(({ id }) => id),
  });
  React.useEffect(() => {
    const next = pruneCatalogFilters(filters, facets);
    if (JSON.stringify(next) !== JSON.stringify(filters)) onChange(next);
  }, [facetKey, facets, filters, onChange]);
  React.useEffect(() => {
    if (!desktopAdvancedOpen) return;
    /**
     * Closes the desktop advanced panel for pointer events outside its controls and popups.
     *
     * @param event - Document pointer event used to locate the interaction target.
     */
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target as Element;
      const inFilterPopup = target.closest(
        '[role="listbox"], [data-slot="dropdown-menu-content"]',
      );
      if (!desktopRootRef.current?.contains(target) && !inFilterPopup) {
        setDesktopAdvancedOpen(false);
      }
    };
    /**
     * Closes the desktop advanced panel when Escape is pressed.
     *
     * @param event - Document keyboard event.
     */
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDesktopAdvancedOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [desktopAdvancedOpen]);
  const productType = filters.productType
    ? (() => {
        const selected = facets.productTypes.find(
          ({ slug }) => slug === filters.productType,
        );
        return selected ? { id: selected.slug, name: selected.name } : null;
      })()
    : { id: "all", name: copy.productTypeAll };
  const productTypes = [
    { id: "all", name: copy.productTypeAll },
    ...facets.productTypes.map(({ name, slug }) => ({ id: slug, name })),
  ];
  const selectedMakers = facets.makers.filter(({ id }) =>
    filters.makerIds.includes(id),
  );
  const advanced = (
    <AdvancedFilters
      copy={copy}
      facets={facets}
      filters={filters}
      onChange={onChange}
      selectedMakers={selectedMakers}
    />
  );

  return (
    <div
      className="relative grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-end gap-1.5"
      ref={desktopRootRef}
    >
      <div className="flex min-w-0 flex-wrap items-end gap-1.5">
        <div className="grid min-w-52 flex-1 gap-1 text-xs font-semibold text-foreground">
          <label htmlFor={advancedId + "-search"}>{copy.searchLabel}</label>
          <Input
            id={advancedId + "-search"}
            onChange={(event) =>
              onChange({ ...filters, query: event.target.value })
            }
            placeholder={copy.searchPlaceholder}
            type="search"
            value={filters.query}
          />
        </div>
        <div className="grid min-w-40 gap-1 text-xs font-semibold text-foreground">
          <span>{copy.productType}</span>
          <CatalogCombobox
            ariaLabel={copy.productType}
            items={productTypes}
            onValueChange={(value) =>
              onChange({
                ...filters,
                productType: facets.productTypes.some(
                  ({ slug }) => slug === value?.id,
                )
                  ? (value?.id as CatalogFilters["productType"])
                  : null,
              })
            }
            placeholder={copy.selectProductType}
            value={productType}
          />
        </div>
        <CheckboxFacet
          copy={copy}
          label={copy.materials}
          onChange={(materialIds) => onChange({ ...filters, materialIds })}
          options={facets.materials}
          selected={filters.materialIds}
        />
        <CheckboxFacet
          copy={copy}
          label={copy.finishes}
          onChange={(finishIds) => onChange({ ...filters, finishIds })}
          options={facets.finishes}
          selected={filters.finishIds}
        />
        <ColorFacet
          copy={copy}
          facets={facets}
          filters={filters}
          onChange={onChange}
        />
        <Button
          aria-controls={advancedId}
          aria-expanded={desktopAdvancedOpen}
          className="max-[880px]:hidden"
          onClick={() => setDesktopAdvancedOpen((open) => !open)}
          size="sm"
          type="button"
          variant="outline"
        >
          <SlidersHorizontal aria-hidden="true" />
          {copy.moreFilters}
        </Button>
        <Sheet open={mobileAdvancedOpen} onOpenChange={setMobileAdvancedOpen}>
          <SheetTrigger
            className="min-[881px]:hidden"
            render={
              <Button type="button" variant="outline">
                <SlidersHorizontal aria-hidden="true" />
                {copy.moreFilters}
              </Button>
            }
          />
          <SheetContent side="bottom">
            <SheetHeader>
              <SheetTitle>{copy.filters}</SheetTitle>
              <SheetDescription>{copy.description}</SheetDescription>
            </SheetHeader>
            <div className="grid gap-5 overflow-y-auto px-6 pb-6">
              {advanced}
              <Button
                onClick={() => setMobileAdvancedOpen(false)}
                type="button"
              >
                {copy.apply}
              </Button>
            </div>
          </SheetContent>
        </Sheet>
        {hasCatalogFilters(filters) ? (
          <Button
            onClick={() => onChange(emptyCatalogFilters())}
            type="button"
            variant="ghost"
          >
            {copy.clear}
          </Button>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
      {desktopAdvancedOpen ? (
        <section
          aria-label={copy.filters}
          className="absolute inset-x-0 top-full z-40 hidden min-h-96 grid-cols-[minmax(0,1fr)_minmax(16rem,0.5fr)] content-start gap-5 rounded-b-xl border-x border-b border-border bg-popover p-5 text-popover-foreground shadow-lg min-[881px]:grid"
          id={advancedId}
        >
          {advanced}
          <Button
            className="col-span-full mt-auto ml-auto self-end"
            onClick={() => setDesktopAdvancedOpen(false)}
            type="button"
          >
            {copy.apply}
          </Button>
        </section>
      ) : null}
    </div>
  );
}

/**
 * Renders a checkbox facet with four quick options and optional overflow menu.
 *
 * @param props - Checkbox facet properties.
 * @param props.copy - Localized labels and label builders.
 * @param props.label - Facet legend.
 * @param props.onChange - Callback receiving the next selected IDs.
 * @param props.options - Facet options in display order.
 * @param props.selected - Currently selected option IDs.
 * @returns The checkbox facet controls.
 */
function CheckboxFacet({
  copy,
  label,
  onChange,
  options,
  selected,
}: {
  /**
   * Localized labels and label builders.
   */
  copy: CatalogFilterCopy;
  /**
   * Facet legend.
   */
  label: string;
  /**
   * Replaces the selected option IDs.
   *
   * @param ids - Next selected option IDs.
   */
  onChange: (ids: number[]) => void;
  /**
   * Facet options in display order.
   */
  options: CatalogFacet[];
  /**
   * Currently selected option IDs.
   */
  selected: number[];
}) {
  const quick = options.slice(0, 4);
  const more = options.slice(4);
  /**
   * Renders one controlled checkbox facet option.
   *
   * @param option - Facet option to render.
   * @returns The labeled checkbox option.
   */
  const checkbox = (option: CatalogFacet) => (
    <label className="flex items-center gap-1.5 text-xs" key={option.id}>
      <input
        checked={selected.includes(option.id)}
        className="size-4 accent-primary"
        onChange={() => onChange(toggle(selected, option.id))}
        type="checkbox"
      />
      {option.name}
    </label>
  );

  return (
    <fieldset className="grid gap-1">
      <legend className="text-xs font-semibold text-foreground">{label}</legend>
      <div className="flex min-h-9 flex-wrap items-center gap-x-1 gap-y-1">
        {quick.map(checkbox)}
        {more.length ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  aria-label={copy.moreOptions(label)}
                  className="px-2"
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  {copy.more}
                </Button>
              }
            />
            <DropdownMenuContent align="start" className="max-h-72 min-w-48">
              {more.map((option) => (
                <DropdownMenuCheckboxItem
                  checked={selected.includes(option.id)}
                  closeOnClick={false}
                  key={option.id}
                  onCheckedChange={() => onChange(toggle(selected, option.id))}
                >
                  {option.name}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </fieldset>
  );
}

/**
 * Renders popular color and fade toggles with overflow options.
 *
 * @param props - Color facet properties.
 * @param props.copy - Localized labels and label builders.
 * @param props.facets - Available colors and fades with counts.
 * @param props.filters - Current controlled filter state.
 * @param props.onChange - Callback receiving the complete next filter state.
 * @returns The color and fade facet controls.
 */
function ColorFacet({
  copy,
  facets,
  filters,
  onChange,
}: {
  /**
   * Localized labels and label builders.
   */
  copy: CatalogFilterCopy;
  /**
   * Available colors and fades with counts.
   */
  facets: CatalogFacets;
  /**
   * Current controlled filter state.
   */
  filters: CatalogFilters;
  /**
   * Replaces the controlled filter state.
   *
   * @param filters - Complete next filter state.
   */
  onChange: (filters: CatalogFilters) => void;
}) {
  const choices = [
    ...facets.colors.map((color) => ({
      colors: [color],
      count: color.count,
      key: `color-${color.id}`,
      selected: filters.colorIds.includes(color.id),
      /**
       * Toggles this solid color in the controlled filters.
       *
       * @returns The parent callback result.
       */
      toggle: () =>
        onChange({ ...filters, colorIds: toggle(filters.colorIds, color.id) }),
      tooltip: color.name,
    })),
    ...facets.fades.map((fade) => ({
      colors: fade.colors,
      count: fade.count,
      key: `fade-${fade.key}`,
      selected: filters.fadeColorSets.some(
        (selected) => fadeKey(selected) === fade.key,
      ),
      /**
       * Toggles this canonical fade color set, ignoring color order and duplicates.
       *
       * @returns The parent callback result.
       */
      toggle: () =>
        onChange({
          ...filters,
          fadeColorSets: filters.fadeColorSets.some(
            (selected) => fadeKey(selected) === fade.key,
          )
            ? filters.fadeColorSets.filter(
                (selected) => fadeKey(selected) !== fade.key,
              )
            : [...filters.fadeColorSets, fade.colors.map(({ id }) => id)],
        }),
      tooltip: copy.fadeName(fade.colors.map(({ name }) => name).join(" → ")),
    })),
  ].sort(
    (left, right) =>
      right.count - left.count || left.tooltip.localeCompare(right.tooltip),
  );
  const quick = choices.slice(0, 5);
  const more = choices.slice(5);

  return (
    <fieldset className="grid gap-1">
      <legend className="text-xs font-semibold text-foreground">
        {copy.colors}
      </legend>
      <div className="flex min-h-9 items-center gap-1.5">
        {quick.map((choice) => (
          <ColorToggle {...choice} key={choice.key} />
        ))}
        {more.length ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  aria-label={copy.moreOptions(copy.colors)}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  {copy.more}
                </Button>
              }
            />
            <DropdownMenuContent
              align="start"
              className="grid max-h-72 min-w-48 grid-cols-5 gap-2 p-3"
            >
              {more.map((choice) => (
                <ColorToggle {...choice} key={choice.key} />
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </fieldset>
  );
}

/**
 * Renders an accessible solid-color or fade swatch toggle with a tooltip.
 *
 * @param props - Color toggle properties.
 * @param props.colors - Ordered colors displayed by the swatch.
 * @param props.selected - Whether the color or fade is selected.
 * @param props.toggle - Callback that toggles the selection.
 * @param props.tooltip - Accessible name and visible tooltip text.
 * @returns The color or fade toggle.
 */
function ColorToggle({
  colors,
  selected,
  toggle: onClick,
  tooltip,
}: {
  /**
   * Ordered colors displayed by the swatch.
   */
  colors: CatalogColor[];
  /**
   * Whether the color or fade is selected.
   */
  selected: boolean;
  /**
   * Toggles the color or fade selection.
   */
  toggle: () => void;
  /**
   * Accessible name and visible tooltip text.
   */
  tooltip: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        aria-label={tooltip}
        aria-pressed={selected}
        className={cn(
          "flex h-8 items-center rounded-full border-2 p-1 outline-none focus-visible:ring-2 focus-visible:ring-ring",
          selected ? "border-primary" : "border-transparent",
        )}
        onClick={onClick}
        type="button"
      >
        <span className="flex pl-1">
          {colors.map((color, index) => (
            <span
              aria-hidden="true"
              className="size-5 rounded-full border border-black/20"
              key={`${color.id}-${index}`}
              style={{
                backgroundColor: color.hex,
                marginLeft: index ? "-0.4rem" : "-0.25rem",
              }}
            />
          ))}
        </span>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

/**
 * Renders maker selection and any/all matching for values within each facet.
 *
 * @param props - Advanced filters properties.
 * @param props.copy - Localized labels and label builders.
 * @param props.facets - Available maker options.
 * @param props.filters - Current controlled filter state.
 * @param props.onChange - Callback receiving the complete next filter state.
 * @param props.selectedMakers - Selected maker option objects.
 * @returns The advanced filter controls.
 */
function AdvancedFilters({
  copy,
  facets,
  filters,
  onChange,
  selectedMakers,
}: {
  /**
   * Localized labels and label builders.
   */
  copy: CatalogFilterCopy;
  /**
   * Available maker options.
   */
  facets: CatalogFacets;
  /**
   * Current controlled filter state.
   */
  filters: CatalogFilters;
  /**
   * Replaces the controlled filter state.
   *
   * @param filters - Complete next filter state.
   */
  onChange: (filters: CatalogFilters) => void;
  /**
   * Selected maker option objects.
   */
  selectedMakers: Array<{
    /** Stable maker identifier. */
    id: number;
    /** Maker display name. */
    name: string;
  }>;
}) {
  return (
    <>
      <div className="grid gap-1 text-xs font-semibold">
        <span>{copy.maker}</span>
        <CatalogMultiCombobox
          ariaLabel={copy.maker}
          items={facets.makers}
          onValueChange={(makers) =>
            onChange({
              ...filters,
              makerIds: makers.map(({ id }) => Number(id)),
            })
          }
          placeholder={copy.selectMaker}
          removeLabel={copy.close}
          value={selectedMakers}
        />
      </div>
      <fieldset className="grid max-w-xs gap-1">
        <legend className="text-xs font-semibold">{copy.matchMode}</legend>
        <ToggleGroup
          onValueChange={(value) =>
            onChange({ ...filters, strict: value === "all" })
          }
          value={filters.strict ? "all" : "any"}
        >
          <ToggleGroupItem value="any">{copy.any}</ToggleGroupItem>
          <ToggleGroupItem value="all">{copy.all}</ToggleGroupItem>
        </ToggleGroup>
      </fieldset>
    </>
  );
}

/**
 * Toggles one numeric identifier while preserving the other selections.
 *
 * @param values - Current selected identifiers.
 * @param value - Identifier to add or remove.
 * @returns A new array containing the toggled selection state.
 */
function toggle(values: number[], value: number): number[] {
  return values.includes(value)
    ? values.filter((candidate) => candidate !== value)
    : [...values, value];
}
