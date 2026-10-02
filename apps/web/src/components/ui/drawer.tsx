import type * as React from "react";
import { Drawer as DrawerPrimitive } from "vaul";
import { cn } from "@/lib/utils";

/**
 * Provides the drawer interaction root.
 *
 * @param props - Drawer properties.
 * @returns The rendered drawer UI.
 */
function Drawer({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) {
  return <DrawerPrimitive.Root data-slot="drawer" {...props} />;
}

/**
 * Renders the control that opens the drawer.
 *
 * @param props - Drawer trigger properties.
 * @returns The rendered drawer trigger UI.
 */
function DrawerTrigger({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Trigger>) {
  return <DrawerPrimitive.Trigger data-slot="drawer-trigger" {...props} />;
}

/**
 * Portals the floating drawer layer.
 *
 * @param props - Drawer portal properties.
 * @returns The rendered drawer portal UI.
 */
function DrawerPortal({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Portal>) {
  return <DrawerPrimitive.Portal data-slot="drawer-portal" {...props} />;
}

/**
 * Renders a control that closes the drawer.
 *
 * @param props - Drawer close properties.
 * @returns The rendered drawer close UI.
 */
function DrawerClose({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Close>) {
  return <DrawerPrimitive.Close data-slot="drawer-close" {...props} />;
}

/**
 * Renders the backdrop behind the drawer.
 *
 * @param props - Drawer overlay properties.
 * @param props.className - Additional CSS classes.
 * @returns The rendered drawer overlay UI.
 */
function DrawerOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Overlay>) {
  return (
    <DrawerPrimitive.Overlay
      className={cn(
        "fixed inset-0 z-50 bg-black/55 backdrop-blur-sm",
        className,
      )}
      data-slot="drawer-overlay"
      {...props}
    />
  );
}

/**
 * Renders the positioned drawer panel.
 *
 * @param props - Drawer content properties.
 * @param props.className - Additional CSS classes.
 * @param props.children - Nested content.
 * @returns The rendered drawer content UI.
 */
function DrawerContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Content>) {
  return (
    <DrawerPortal>
      <DrawerOverlay />
      <DrawerPrimitive.Content
        className={cn(
          // Bottom sheet: pinned to the bottom edge, rounded top, safe-area
          // padded so the content never sits under the home indicator.
          "fixed inset-x-0 bottom-0 z-50 mt-24 flex max-h-[92svh] flex-col rounded-t-xl border-t border-sidebar-border bg-sidebar text-sidebar-foreground pb-[env(safe-area-inset-bottom)]",
          className,
        )}
        data-slot="drawer-content"
        {...props}
      >
        {/* Grab handle — the swipe-to-dismiss affordance. */}
        <div
          aria-hidden="true"
          className="mx-auto mt-2.5 mb-1 h-1.5 w-10 shrink-0 rounded-full bg-muted-foreground/30"
        />
        {children}
      </DrawerPrimitive.Content>
    </DrawerPortal>
  );
}

/**
 * Renders the header region of the drawer.
 *
 * @param props - Drawer header properties.
 * @param props.className - Additional CSS classes.
 * @returns The rendered drawer header UI.
 */
function DrawerHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 border-b border-sidebar-border px-5 py-3",
        className,
      )}
      data-slot="drawer-header"
      {...props}
    />
  );
}

/**
 * Renders the accessible title of the drawer.
 *
 * @param props - Drawer title properties.
 * @param props.className - Additional CSS classes.
 * @returns The rendered drawer title UI.
 */
function DrawerTitle({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Title>) {
  return (
    <DrawerPrimitive.Title
      className={cn(
        "text-sm font-semibold tracking-[1px] text-muted-foreground uppercase",
        className,
      )}
      data-slot="drawer-title"
      {...props}
    />
  );
}

/**
 * Renders the accessible description of the drawer.
 *
 * @param props - Drawer description properties.
 * @param props.className - Additional CSS classes.
 * @returns The rendered drawer description UI.
 */
function DrawerDescription({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Description>) {
  return (
    <DrawerPrimitive.Description
      className={cn("text-sm text-muted-foreground", className)}
      data-slot="drawer-description"
      {...props}
    />
  );
}

export {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerOverlay,
  DrawerPortal,
  DrawerTitle,
  DrawerTrigger,
};
