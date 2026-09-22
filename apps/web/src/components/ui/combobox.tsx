import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox";
import { Check, ChevronDown, X } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

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
      <ComboboxPrimitive.Root
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
      </ComboboxPrimitive.Root>
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
      <ComboboxPrimitive.Root
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
      </ComboboxPrimitive.Root>
      {value.length ? (
        <div className="flex flex-wrap gap-1.5">
          {value.map((selected) => (
            <SelectionPill
              className="bg-secondary text-secondary-foreground"
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
      <ComboboxPrimitive.Input
        aria-label={ariaLabel}
        className="h-9 w-full rounded-md border border-input bg-background px-3 pr-9 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        placeholder={placeholder}
      />
      <ComboboxPrimitive.Trigger
        aria-label={ariaLabel}
        className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground"
      >
        <ChevronDown aria-hidden="true" className="size-4" />
      </ComboboxPrimitive.Trigger>
    </div>
  );
}

function ComboboxOptions({ placeholder }: { placeholder: string }) {
  return (
    <ComboboxPrimitive.Portal>
      <ComboboxPrimitive.Positioner className="z-50" sideOffset={4}>
        <ComboboxPrimitive.Popup className="max-h-72 min-w-[var(--anchor-width)] overflow-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md">
          <ComboboxPrimitive.Empty className="px-3 py-2 text-sm text-muted-foreground">
            {placeholder}
          </ComboboxPrimitive.Empty>
          <ComboboxPrimitive.List>
            {(item: ComboboxOption) => (
              <ComboboxPrimitive.Item
                className="flex cursor-default items-center justify-between rounded-sm px-3 py-2 text-sm outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
                key={item.id}
                value={item}
              >
                {item.name}
                <ComboboxPrimitive.ItemIndicator>
                  <Check aria-hidden="true" className="size-4" />
                </ComboboxPrimitive.ItemIndicator>
              </ComboboxPrimitive.Item>
            )}
          </ComboboxPrimitive.List>
        </ComboboxPrimitive.Popup>
      </ComboboxPrimitive.Positioner>
    </ComboboxPrimitive.Portal>
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

const Combobox = ComboboxPrimitive.Root;

function ComboboxInput({ className, ...props }: ComboboxPrimitive.Input.Props) {
  return (
    <div className="relative">
      <ComboboxPrimitive.Input
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 pr-10 text-base shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        {...props}
      />
      <ComboboxPrimitive.Trigger
        aria-label={props["aria-label"] ?? props.placeholder}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground outline-none"
      >
        <ChevronDown aria-hidden="true" className="size-4" />
      </ComboboxPrimitive.Trigger>
    </div>
  );
}

function ComboboxContent({
  className,
  ...props
}: ComboboxPrimitive.Popup.Props) {
  return (
    <ComboboxPrimitive.Portal>
      <ComboboxPrimitive.Positioner className="z-50" sideOffset={4}>
        <ComboboxPrimitive.Popup
          className={cn(
            "max-h-72 w-(--anchor-width) overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-md",
            className,
          )}
          {...props}
        />
      </ComboboxPrimitive.Positioner>
    </ComboboxPrimitive.Portal>
  );
}

function ComboboxList({ className, ...props }: ComboboxPrimitive.List.Props) {
  return (
    <ComboboxPrimitive.List
      className={cn("max-h-72 overflow-y-auto p-1", className)}
      {...props}
    />
  );
}

function ComboboxItem({
  children,
  className,
  ...props
}: ComboboxPrimitive.Item.Props) {
  return (
    <ComboboxPrimitive.Item
      className={cn(
        "relative flex cursor-default items-center rounded-sm py-1.5 pr-8 pl-2 text-sm outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground",
        className,
      )}
      {...props}
    >
      {children}
      <ComboboxPrimitive.ItemIndicator className="absolute right-2">
        <Check aria-hidden="true" className="size-4" />
      </ComboboxPrimitive.ItemIndicator>
    </ComboboxPrimitive.Item>
  );
}

function ComboboxEmpty({ className, ...props }: ComboboxPrimitive.Empty.Props) {
  return (
    <ComboboxPrimitive.Empty
      className={cn(
        "px-3 py-6 text-center text-sm text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

export {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
};
