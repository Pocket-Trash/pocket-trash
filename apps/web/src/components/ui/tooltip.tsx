import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import type * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Provides tooltip timing configuration to nested tooltips.
 *
 * @param props - Tooltip provider properties.
 * @param props.delay - Delay before a tooltip opens.
 * @returns The rendered tooltip provider UI.
 */
function TooltipProvider({
  delay = 0,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delay={delay}
      {...props}
    />
  );
}

/**
 * Provides the tooltip interaction root.
 *
 * @param props - Tooltip properties.
 * @returns The rendered tooltip UI.
 */
function Tooltip({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />;
}

/**
 * Renders the control that opens the tooltip.
 *
 * @param props - Tooltip trigger properties.
 * @returns The rendered tooltip trigger UI.
 */
function TooltipTrigger({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

/**
 * Renders the positioned tooltip panel.
 *
 * @param props - Tooltip content properties.
 * @param props.align - Popup alignment relative to its trigger.
 * @param props.className - Additional CSS classes.
 * @param props.sideOffset - Distance between the tooltip and its trigger.
 * @param props.side - Screen edge used to place the panel.
 * @param props.children - Nested content.
 * @returns The rendered tooltip content UI.
 */
function TooltipContent({
  align,
  className,
  sideOffset = 0,
  side,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Popup> &
  Pick<
    React.ComponentProps<typeof TooltipPrimitive.Positioner>,
    "align" | "side" | "sideOffset"
  >) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner
        align={align}
        className="z-50"
        side={side}
        sideOffset={sideOffset}
      >
        <TooltipPrimitive.Popup
          className={cn(
            "w-fit rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground",
            className,
          )}
          data-slot="tooltip-content"
          {...props}
        >
          {children}
          <TooltipPrimitive.Arrow className="z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px] bg-primary fill-primary" />
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
