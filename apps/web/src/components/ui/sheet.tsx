import { Drawer as SheetPrimitive } from "@base-ui/react/drawer";
import { formatTranslation } from "@pocket-trash/localizations";
import { XIcon } from "lucide-react";
import type * as React from "react";
import { cn } from "@/lib/utils";
import { useLocale } from "@/providers/locale-provider";

/**
 * Provides the sheet interaction root, defaulting swipe gestures to the right.
 *
 * @param props - Sheet properties.
 * @returns The rendered sheet UI.
 */
function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return (
    <SheetPrimitive.Root data-slot="sheet" swipeDirection="right" {...props} />
  );
}

/**
 * Renders the control that opens the sheet.
 *
 * @param props - Sheet trigger properties.
 * @returns The rendered sheet trigger UI.
 */
function SheetTrigger({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

/**
 * Renders a control that closes the sheet.
 *
 * @param props - Sheet close properties.
 * @returns The rendered sheet close UI.
 */
function SheetClose({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

/**
 * Portals the floating sheet layer.
 *
 * @param props - Sheet portal properties.
 * @returns The rendered sheet portal UI.
 */
function SheetPortal({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />;
}

/**
 * Renders the backdrop behind the sheet.
 *
 * @param props - Sheet overlay properties.
 * @param props.className - Additional CSS classes.
 * @returns The rendered sheet overlay UI.
 */
function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Backdrop>) {
  return (
    <SheetPrimitive.Backdrop
      className={cn(
        "fixed inset-0 z-50 bg-black/55 backdrop-blur-sm data-[ending-style]:animate-none",
        className,
      )}
      data-slot="sheet-overlay"
      {...props}
    />
  );
}

/**
 * Renders the positioned sheet panel.
 *
 * @param props - Sheet content properties.
 * @param props.className - Additional CSS classes.
 * @param props.children - Nested content.
 * @param props.side - Screen edge used to place the panel.
 * @returns The rendered sheet content UI.
 * @throws {Error} When rendered outside `LocaleProvider`.
 */
function SheetContent({
  className,
  children,
  side = "right",
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  /**
   * Screen edge used to place the panel.
   */
  side?: "top" | "right" | "bottom" | "left";
}) {
  const { locale } = useLocale();

  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Viewport
        className="fixed inset-0 z-50 pointer-events-none"
        data-slot="sheet-viewport"
      >
        <SheetPrimitive.Popup
          data-slot="sheet-content"
          className={cn(
            "fixed pointer-events-auto flex flex-col gap-4 bg-sidebar text-sidebar-foreground shadow-lg transition ease-[cubic-bezier(0.22,0.65,0.27,1)] data-[ending-style]:duration-300 data-[starting-style]:duration-350",
            side === "right" &&
              "inset-y-0 right-0 h-full w-[360px] max-w-[92vw] border-l border-sidebar-border data-[ending-style]:translate-x-full data-[starting-style]:translate-x-full",
            side === "left" &&
              "inset-y-0 left-0 h-full w-[320px] max-w-[86vw] border-r border-sidebar-border data-[ending-style]:-translate-x-full data-[starting-style]:-translate-x-full",
            side === "top" &&
              "inset-x-0 top-0 h-auto border-b border-sidebar-border data-[ending-style]:-translate-y-full data-[starting-style]:-translate-y-full",
            side === "bottom" &&
              "inset-x-0 bottom-0 h-auto border-t border-sidebar-border data-[ending-style]:translate-y-full data-[starting-style]:translate-y-full",
            className,
          )}
          {...props}
        >
          <SheetPrimitive.Content className="flex min-h-0 flex-1 flex-col gap-4">
            {children}
          </SheetPrimitive.Content>
          <SheetPrimitive.Close className="absolute top-4 right-4 rounded-xs opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-none disabled:pointer-events-none">
            <XIcon className="size-4" />
            <span className="sr-only">
              {formatTranslation("web.action.close", {}, locale)}
            </span>
          </SheetPrimitive.Close>
        </SheetPrimitive.Popup>
      </SheetPrimitive.Viewport>
    </SheetPortal>
  );
}

/**
 * Renders the header region of the sheet.
 *
 * @param props - Sheet header properties.
 * @param props.className - Additional CSS classes.
 * @returns The rendered sheet header UI.
 */
function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 border-b border-sidebar-border px-6 py-4",
        className,
      )}
      data-slot="sheet-header"
      {...props}
    />
  );
}

/**
 * Renders the accessible title of the sheet.
 *
 * @param props - Sheet title properties.
 * @param props.className - Additional CSS classes.
 * @returns The rendered sheet title UI.
 */
function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      className={cn(
        "text-sm font-semibold tracking-[1px] text-muted-foreground uppercase",
        className,
      )}
      data-slot="sheet-title"
      {...props}
    />
  );
}

/**
 * Renders the accessible description of the sheet.
 *
 * @param props - Sheet description properties.
 * @param props.className - Additional CSS classes.
 * @returns The rendered sheet description UI.
 */
function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      className={cn("text-sm text-muted-foreground", className)}
      data-slot="sheet-description"
      {...props}
    />
  );
}

export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
};
