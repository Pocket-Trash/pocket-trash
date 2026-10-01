import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox";
import { Check, ChevronDown, X } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Selectable catalog option displayed by a combobox.
 */
export type ComboboxOption = {
  /**
   * Stable option identifier.
   */
  id: number | string;
  /**
   * Display label for the option.
   */
  name: string;
};

/**
 * Renders a single-select catalog combobox with an optional removable selection pill.
 *
 * @param props - Catalog combobox properties.
 * @param props.ariaLabel - Accessible label for the combobox input and trigger.
 * @param props.items - Options available for selection.
 * @param props.onValueChange - Callback invoked when the selection changes.
 * @param props.placeholder - Prompt shown when the combobox has no selection.
 * @param props.removeLabel - Accessible label for the optional removal control.
 * @param props.showSelectedPill - Whether to allow a non-default selection to render as a removable pill when `removeLabel` is provided.
 * @param props.value - Currently selected option.
 * @returns The rendered catalog combobox UI.
 */
export function CatalogCombobox({
  ariaLabel,
  items,
  onValueChange,
  placeholder,
  removeLabel,
  showSelectedPill = false,
  value,
}: {
  /**
   * Accessible label for the combobox input and trigger.
   */
  ariaLabel: string;
  /**
   * Options available for selection.
   */
  items: ComboboxOption[];
  /**
   * Reports selection changes.
   *
   * @param value - Next selection value.
   */
  onValueChange: (value: ComboboxOption | null) => void;
  /**
   * Prompt shown when the combobox has no selection.
   */
  placeholder: string;
  /**
   * Accessible label for the optional removal control.
   */
  removeLabel?: string;
  /**
   * Whether to allow a non-default selection to render as a removable pill when
   * `removeLabel` is provided.
   *
   * @default false
   */
  showSelectedPill?: boolean;
  /**
   * Current controlled selection.
   */
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

/**
 * Renders a multi-select catalog combobox with removable selection pills.
 *
 * @param props - Catalog multi combobox properties.
 * @param props.ariaLabel - Accessible label for the combobox input and trigger.
 * @param props.disabled - Whether the combobox input and selection controls are disabled; removal pills remain interactive unless `removeDisabled` is set.
 * @param props.emptyLabel - Message shown when no options match; defaults to `placeholder`.
 * @param props.filter - `null` to disable built-in filtering.
 * @param props.inputValue - Controlled combobox search text.
 * @param props.items - Options available for selection.
 * @param props.onInputValueChange - Callback invoked when the search text changes.
 * @param props.onValueChange - Callback invoked when the selected options change.
 * @param props.placeholder - Prompt shown when the combobox has no selection.
 * @param props.removeDisabled - Whether selected options cannot be removed.
 * @param props.removeLabel - Accessible label or label builder for removal controls.
 * @param props.value - Currently selected options.
 * @returns The rendered catalog multi combobox UI.
 */
export function CatalogMultiCombobox({
  ariaLabel,
  disabled = false,
  emptyLabel,
  filter,
  inputValue,
  items,
  onInputValueChange,
  onValueChange,
  placeholder,
  removeDisabled = false,
  removeLabel,
  value,
}: {
  /**
   * Accessible label for the combobox input and trigger.
   */
  ariaLabel: string;
  /**
   * Whether the combobox input and selection controls are disabled. Removal
   * pills remain interactive unless `removeDisabled` is set.
   */
  disabled?: boolean;
  /**
   * Message shown when no combobox options match. Defaults to `placeholder`.
   */
  emptyLabel?: string;
  /**
   * Disables built-in filtering when set to `null`.
   */
  filter?: null;
  /**
   * Controlled combobox search text.
   */
  inputValue?: string;
  /**
   * Options available for selection.
   */
  items: ComboboxOption[];
  /**
   * Reports controlled combobox search-text changes.
   *
   * @param value - Next search text.
   */
  onInputValueChange?: (value: string) => void;
  /**
   * Reports selection changes.
   *
   * @param value - Next selection value.
   */
  onValueChange: (value: ComboboxOption[]) => void;
  /**
   * Prompt shown when the combobox has no selection.
   */
  placeholder: string;
  /**
   * Whether selected options cannot be removed.
   */
  removeDisabled?: boolean;
  /**
   * Accessible label or builder called with the selected option name.
   */
  removeLabel: string | ((name: string) => string);
  /**
   * Current controlled selection.
   */
  value: ComboboxOption[];
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="grid gap-2">
      <ComboboxPrimitive.Root
        disabled={disabled}
        filter={filter}
        inputValue={inputValue}
        isItemEqualToValue={(item, selected) => item.id === selected.id}
        itemToStringLabel={(item) => item.name}
        items={items}
        multiple
        onInputValueChange={onInputValueChange}
        onOpenChange={setOpen}
        onValueChange={(nextValue) => {
          onValueChange(nextValue);
          setOpen(false);
        }}
        open={open}
        value={value}
      >
        <ComboboxControl ariaLabel={ariaLabel} placeholder={placeholder} />
        <ComboboxOptions
          emptyLabel={emptyLabel ?? placeholder}
          placeholder={placeholder}
        />
      </ComboboxPrimitive.Root>
      {value.length ? (
        <div className="flex flex-wrap gap-1.5">
          {value.map((selected) => (
            <SelectionPill
              className="bg-secondary text-secondary-foreground"
              disabled={removeDisabled}
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

/**
 * Renders the catalog combobox input and disclosure control.
 *
 * @param props - Combobox control properties.
 * @param props.ariaLabel - Accessible label for the combobox input and trigger.
 * @param props.placeholder - Prompt shown when the combobox has no selection.
 * @returns The rendered combobox control UI.
 */
function ComboboxControl({
  ariaLabel,
  placeholder,
}: {
  /**
   * Accessible label for the combobox input and trigger.
   */
  ariaLabel: string;
  /**
   * Prompt shown when the combobox has no selection.
   */
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

/**
 * Renders the portal-hosted catalog combobox option list.
 *
 * @param props - Combobox options properties.
 * @param props.placeholder - Prompt shown when the combobox has no selection.
 * @param props.emptyLabel - Message shown when no combobox options match.
 * @returns The rendered combobox options UI.
 */
function ComboboxOptions({
  placeholder,
  emptyLabel = placeholder,
}: {
  /**
   * Message shown when no combobox options match.
   */
  emptyLabel?: string;
  /**
   * Prompt shown when the combobox has no selection.
   */
  placeholder: string;
}) {
  return (
    <ComboboxPrimitive.Portal>
      <ComboboxPrimitive.Positioner className="z-50" sideOffset={4}>
        <ComboboxPrimitive.Popup className="max-h-72 min-w-[var(--anchor-width)] overflow-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md">
          <ComboboxPrimitive.Empty className="px-3 py-2 text-sm text-muted-foreground">
            {emptyLabel}
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

/**
 * Renders one selected combobox option with a removal control.
 *
 * @param props - Selection pill properties.
 * @param props.className - Additional CSS classes.
 * @param props.disabled - Whether interaction is disabled.
 * @param props.onRemove - Callback invoked to remove the option.
 * @param props.removeLabel - Accessible label or label builder for removal controls.
 * @param props.value - Selected option represented by the pill.
 * @returns The rendered selection pill UI.
 */
function SelectionPill({
  className,
  disabled = false,
  onRemove,
  removeLabel,
  value,
}: {
  /**
   * Additional CSS classes.
   */
  className: string;
  /**
   * Whether interaction is disabled.
   */
  disabled?: boolean;
  /**
   * Removes the selected option.
   */
  onRemove: () => void;
  /**
   * Accessible label or label builder for removal controls.
   */
  removeLabel: string | ((name: string) => string);
  /**
   * Current controlled selection.
   */
  value: ComboboxOption;
}) {
  return (
    <span
      className={`inline-flex w-fit items-center gap-1 rounded-full py-1 pr-1 pl-2.5 text-xs ${className}`}
    >
      {value.name}
      <button
        aria-label={
          typeof removeLabel === "function"
            ? removeLabel(value.name)
            : `${removeLabel}: ${value.name}`
        }
        className="rounded-full p-0.5 outline-none hover:bg-background/60 focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
        disabled={disabled}
        onClick={onRemove}
        type="button"
      >
        <X aria-hidden="true" className="size-3" />
      </button>
    </span>
  );
}

/**
 * Exposes the root that coordinates composed combobox controls and options.
 */
const Combobox = ComboboxPrimitive.Root;

/**
 * Renders a combobox input with its disclosure control.
 *
 * @param props - Combobox input properties.
 * @param props.className - Additional CSS classes.
 * @returns The rendered combobox input UI.
 */
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

/**
 * Renders the positioned combobox popup.
 *
 * @param props - Combobox content properties.
 * @param props.className - Additional CSS classes.
 * @returns The rendered combobox content UI.
 */
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

/**
 * Renders the scrollable combobox option list.
 *
 * @param props - Combobox list properties.
 * @param props.className - Additional CSS classes.
 * @returns The rendered combobox list UI.
 */
function ComboboxList({ className, ...props }: ComboboxPrimitive.List.Props) {
  return (
    <ComboboxPrimitive.List
      className={cn("max-h-72 overflow-y-auto p-1", className)}
      {...props}
    />
  );
}

/**
 * Renders one selectable combobox option and its selected indicator.
 *
 * @param props - Combobox item properties.
 * @param props.children - Nested content.
 * @param props.className - Additional CSS classes.
 * @returns The rendered combobox item UI.
 */
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

/**
 * Renders the combobox empty-state message.
 *
 * @param props - Combobox empty properties.
 * @param props.className - Additional CSS classes.
 * @returns The rendered combobox empty UI.
 */
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
