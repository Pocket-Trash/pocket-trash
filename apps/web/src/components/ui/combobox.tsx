import { Combobox } from "@base-ui/react/combobox";
import { Check, ChevronDown } from "lucide-react";

export type ComboboxOption = { id: number | string; name: string };

export function CatalogCombobox({
  ariaLabel,
  items,
  onValueChange,
  placeholder,
  value,
}: {
  ariaLabel: string;
  items: ComboboxOption[];
  onValueChange: (value: ComboboxOption | null) => void;
  placeholder: string;
  value: ComboboxOption | null;
}) {
  return (
    <Combobox.Root
      isItemEqualToValue={(item, selected) => item.id === selected.id}
      itemToStringLabel={(item) => item.name}
      items={items}
      onValueChange={onValueChange}
      value={value}
    >
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
    </Combobox.Root>
  );
}

export function CatalogMultiCombobox({
  ariaLabel,
  items,
  onValueChange,
  placeholder,
  value,
}: {
  ariaLabel: string;
  items: ComboboxOption[];
  onValueChange: (value: ComboboxOption[]) => void;
  placeholder: string;
  value: ComboboxOption[];
}) {
  return (
    <Combobox.Root
      isItemEqualToValue={(item, selected) => item.id === selected.id}
      itemToStringLabel={(item) => item.name}
      items={items}
      multiple
      onValueChange={onValueChange}
      value={value}
    >
      <div className="relative">
        <Combobox.Input
          aria-label={ariaLabel}
          className="h-9 w-full rounded-md border border-input bg-background px-3 pr-9 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          placeholder={
            value.length
              ? value.map(({ name }) => name).join(", ")
              : placeholder
          }
        />
        <Combobox.Trigger
          aria-label={ariaLabel}
          className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground"
        >
          <ChevronDown aria-hidden="true" className="size-4" />
        </Combobox.Trigger>
      </div>
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
    </Combobox.Root>
  );
}
