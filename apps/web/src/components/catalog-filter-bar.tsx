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

export type CatalogFilterCopy = {
  all: string;
  any: string;
  clear: string;
  close: string;
  colors: string;
  description: string;
  fadeName: (colors: string) => string;
  filters: string;
  finishes: string;
  maker: string;
  matchMode: string;
  materials: string;
  more: string;
  moreFilters: string;
  moreOptions: (label: string) => string;
  productType: string;
  productTypeAll: string;
  selectMaker: string;
  selectProductType: string;
};

export function CatalogFilterBar({
  copy,
  facets,
  filters,
  onChange,
}: {
  copy: CatalogFilterCopy;
  facets: CatalogFacets;
  filters: CatalogFilters;
  onChange: (filters: CatalogFilters) => void;
}) {
  const [advancedOpen, setAdvancedOpen] = React.useState(false);
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
    <div className="relative flex min-w-0 flex-1 flex-wrap items-end gap-3">
      <div className="grid min-w-48 gap-1 text-xs font-semibold text-foreground">
        <span>{copy.productType}</span>
        <CatalogCombobox
          ariaLabel={copy.productType}
          items={productTypes}
          onValueChange={(value) =>
            onChange({
              ...filters,
              productType:
                value?.id === "spinner" || value?.id === "spinner-button"
                  ? value.id
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
        aria-expanded={advancedOpen}
        className="max-[880px]:hidden"
        onClick={() => setAdvancedOpen((open) => !open)}
        type="button"
        variant="outline"
      >
        <SlidersHorizontal aria-hidden="true" />
        {copy.moreFilters}
      </Button>
      <Sheet open={advancedOpen} onOpenChange={setAdvancedOpen}>
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
          <div className="grid gap-5 overflow-y-auto px-6 pb-6">{advanced}</div>
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
      {advancedOpen ? (
        <section
          className="absolute top-[calc(100%+0.5rem)] left-0 z-40 hidden min-h-48 w-[min(40rem,calc(100vw-2.5rem))] gap-5 rounded-xl border border-border bg-popover p-5 text-popover-foreground shadow-lg min-[881px]:grid"
          id={advancedId}
        >
          {advanced}
        </section>
      ) : null}
    </div>
  );
}

function CheckboxFacet({
  copy,
  label,
  onChange,
  options,
  selected,
}: {
  copy: CatalogFilterCopy;
  label: string;
  onChange: (ids: number[]) => void;
  options: CatalogFacet[];
  selected: number[];
}) {
  const quick = options.slice(0, 5);
  const more = options.slice(5);
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
      <div className="flex min-h-9 flex-wrap items-center gap-x-3 gap-y-1">
        {quick.map(checkbox)}
        {more.length ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  aria-label={copy.moreOptions(label)}
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

function ColorFacet({
  copy,
  facets,
  filters,
  onChange,
}: {
  copy: CatalogFilterCopy;
  facets: CatalogFacets;
  filters: CatalogFilters;
  onChange: (filters: CatalogFilters) => void;
}) {
  const choices = [
    ...facets.colors.map((color) => ({
      colors: [color],
      count: color.count,
      key: `color-${color.id}`,
      selected: filters.colorIds.includes(color.id),
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

function ColorToggle({
  colors,
  selected,
  toggle: onClick,
  tooltip,
}: {
  colors: CatalogColor[];
  selected: boolean;
  toggle: () => void;
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

function AdvancedFilters({
  copy,
  facets,
  filters,
  onChange,
  selectedMakers,
}: {
  copy: CatalogFilterCopy;
  facets: CatalogFacets;
  filters: CatalogFilters;
  onChange: (filters: CatalogFilters) => void;
  selectedMakers: Array<{ id: number; name: string }>;
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

function toggle(values: number[], value: number): number[] {
  return values.includes(value)
    ? values.filter((candidate) => candidate !== value)
    : [...values, value];
}
