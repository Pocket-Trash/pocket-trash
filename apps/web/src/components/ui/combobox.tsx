import { Combobox } from "@base-ui/react/combobox";
import { Check, ChevronDown, X } from "lucide-react";
import * as React from "react";

export type ComboboxOption = { id: number | string; name: string };

export function CatalogCombobox({
  ariaLabel,
  items,
  onValueChange,
  placeholder,
  removeLabel,
  showSelectedPill = false,
  value,
}: {
  ariaLabel: string;
  items: ComboboxOption[];
  onValueChange: (value: ComboboxOption | null) => void;
  placeholder: string;
  removeLabel?: string;
  showSelectedPill?: boolean;
  value: ComboboxOption | null;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="grid gap-2">
      <Combobox.Root
        isItemEqualToValue={(item, selected) => item.id === selected.id}
        itemToStringLabel={(item) => item.name}
        items={items}
        onOpenChange={setOpen}
        onValueChange={(nextValue) => {
          onValueChange(nextValue);
          setOpen(false);
        }}
        open={open}
        value={value}
      >
        <ComboboxControl ariaLabel={ariaLabel} placeholder={placeholder} />
        <ComboboxOptions placeholder={placeholder} />
      </Combobox.Root>
      {showSelectedPill && removeLabel && value && value.id !== "default" ? (
        <SelectionPill
          className="bg-secondary text-secondary-foreground"
          onRemove={() => onValueChange(null)}
          removeLabel={removeLabel}
          value={value}
        />
      ) : null}
    </div>
  );
}

export function CatalogMultiCombobox({
  ariaLabel,
  items,
  onValueChange,
  placeholder,
  removeLabel,
  value,
}: {
  ariaLabel: string;
  items: ComboboxOption[];
  onValueChange: (value: ComboboxOption[]) => void;
  placeholder: string;
  removeLabel: string;
  value: ComboboxOption[];
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="grid gap-2">
      <Combobox.Root
        isItemEqualToValue={(item, selected) => item.id === selected.id}
        itemToStringLabel={(item) => item.name}
        items={items}
        multiple
        onOpenChange={setOpen}
        onValueChange={(nextValue) => {
          onValueChange(nextValue);
          setOpen(false);
        }}
        open={open}
        value={value}
      >
        <ComboboxControl ariaLabel={ariaLabel} placeholder={placeholder} />
        <ComboboxOptions placeholder={placeholder} />
      </Combobox.Root>
      {value.length ? (
        <div className="flex flex-wrap gap-1.5">
          {value.map((selected) => (
            <SelectionPill
              className="bg-chart-1/15 text-chart-1"
              key={selected.id}
              onRemove={() =>
                onValueChange(value.filter(({ id }) => id !== selected.id))
              }
              removeLabel={removeLabel}
              value={selected}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ComboboxControl({
  ariaLabel,
  placeholder,
}: {
  ariaLabel: string;
  placeholder: string;
}) {
  return (
    <div className="relative">
      <Combobox.Input
        aria-label={ariaLabel}
        className="h-9 w-full rounded-md border border-input bg-background px-3 pr-9 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        placeholder={placeholder}
      />
      <Combobox.Trigger
        aria-label={ariaLabel}
        className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground"
      >
        <ChevronDown aria-hidden="true" className="size-4" />
      </Combobox.Trigger>
    </div>
  );
}

function ComboboxOptions({ placeholder }: { placeholder: string }) {
  return (
    <Combobox.Portal>
      <Combobox.Positioner className="z-50" sideOffset={4}>
        <Combobox.Popup className="max-h-72 min-w-[var(--anchor-width)] overflow-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md">
          <Combobox.Empty className="px-3 py-2 text-sm text-muted-foreground">
            {placeholder}
          </Combobox.Empty>
          <Combobox.List>
            {(item: ComboboxOption) => (
              <Combobox.Item
                className="flex cursor-default items-center justify-between rounded-sm px-3 py-2 text-sm outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
                key={item.id}
                value={item}
              >
                {item.name}
                <Combobox.ItemIndicator>
                  <Check aria-hidden="true" className="size-4" />
                </Combobox.ItemIndicator>
              </Combobox.Item>
            )}
          </Combobox.List>
        </Combobox.Popup>
      </Combobox.Positioner>
    </Combobox.Portal>
  );
}

function SelectionPill({
  className,
  onRemove,
  removeLabel,
  value,
}: {
  className: string;
  onRemove: () => void;
  removeLabel: string;
  value: ComboboxOption;
}) {
  return (
    <span
      className={`inline-flex w-fit items-center gap-1 rounded-full py-1 pr-1 pl-2.5 text-xs ${className}`}
    >
      {value.name}
      <button
        aria-label={`${removeLabel}: ${value.name}`}
        className="rounded-full p-0.5 outline-none hover:bg-background/60 focus-visible:ring-2 focus-visible:ring-ring"
        onClick={onRemove}
        type="button"
      >
        <X aria-hidden="true" className="size-3" />
      </button>
    </span>
  );
}
