import { Select as SelectPrimitive } from "@base-ui/react/select";
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import type * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Provides the select interaction root.
 *
 * @param props - Select properties.
 * @returns The rendered select UI.
 */
function Select({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Root>) {
  return <SelectPrimitive.Root data-slot="select" {...props} />;
}

/**
 * Renders the selected value or placeholder for a select.
 *
 * @param props - Select value properties.
 * @returns The rendered select value UI.
 */
function SelectValue({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Value>) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />;
}

/**
 * Renders the control that opens the select.
 *
 * @param props - Select trigger properties.
 * @param props.className - Additional CSS classes.
 * @param props.children - Nested content.
 * @returns The rendered select trigger UI.
 */
function SelectTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger>) {
  return (
    <SelectPrimitive.Trigger
      className={cn(
        "flex h-9 w-fit items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm whitespace-nowrap shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-[placeholder]:text-muted-foreground [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
        className,
      )}
      data-slot="select-trigger"
      {...props}
    >
      {children}
      <SelectPrimitive.Icon>
        <ChevronDownIcon className="opacity-50" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

/**
 * Renders the positioned select panel.
 *
 * @param props - Select content properties.
 * @param props.align - Popup alignment relative to its trigger.
 * @param props.className - Additional CSS classes.
 * @param props.children - Nested content.
 * @param props.position - Popup positioning strategy.
 * @param props.side - Screen edge used to place the panel.
 * @param props.sideOffset - Distance between the popup and its trigger.
 * @returns The rendered select content UI.
 */
function SelectContent({
  align,
  className,
  children,
  position = "popper",
  side,
  sideOffset,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Popup> &
  Pick<
    React.ComponentProps<typeof SelectPrimitive.Positioner>,
    "align" | "side" | "sideOffset"
  > & {
    /**
     * Popup positioning strategy.
     */
    position?: "popper" | "item-aligned";
  }) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        align={align}
        alignItemWithTrigger={false}
        className="z-50"
        side={side}
        sideOffset={sideOffset ?? (position === "popper" ? 4 : 0)}
      >
        <SelectPrimitive.Popup
          className={cn(
            "relative max-h-96 min-w-[8rem] origin-[var(--transform-origin)] overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-md data-[ending-style]:fade-out-0 data-[starting-style]:fade-in-0 data-[ending-style]:zoom-out-95 data-[starting-style]:zoom-in-95",
            position === "popper" &&
              "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
            className,
          )}
          data-slot="select-content"
          {...props}
        >
          <SelectScrollUpButton />
          <SelectPrimitive.List className="p-1">
            {children}
          </SelectPrimitive.List>
          <SelectScrollDownButton />
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  );
}

/**
 * Renders one selectable select item.
 *
 * @param props - Select item properties.
 * @param props.className - Additional CSS classes.
 * @param props.children - Nested content.
 * @returns The rendered select item UI.
 */
function SelectItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      className={cn(
        "relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-none select-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className,
      )}
      data-slot="select-item"
      {...props}
    >
      <span className="absolute right-2 flex size-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <CheckIcon className="size-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}

/**
 * Renders the control for scrolling select options upward.
 *
 * @param props - Select scroll up button properties.
 * @param props.className - Additional CSS classes.
 * @returns The rendered select scroll up button UI.
 */
function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpArrow>) {
  return (
    <SelectPrimitive.ScrollUpArrow
      className={cn(
        "flex cursor-default items-center justify-center py-1",
        className,
      )}
      data-slot="select-scroll-up-button"
      {...props}
    >
      <ChevronUpIcon className="size-4" />
    </SelectPrimitive.ScrollUpArrow>
  );
}

/**
 * Renders the control for scrolling select options downward.
 *
 * @param props - Select scroll down button properties.
 * @param props.className - Additional CSS classes.
 * @returns The rendered select scroll down button UI.
 */
function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownArrow>) {
  return (
    <SelectPrimitive.ScrollDownArrow
      className={cn(
        "flex cursor-default items-center justify-center py-1",
        className,
      )}
      data-slot="select-scroll-down-button"
      {...props}
    >
      <ChevronDownIcon className="size-4" />
    </SelectPrimitive.ScrollDownArrow>
  );
}

export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue };
