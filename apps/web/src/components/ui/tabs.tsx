import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import type * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Provides the tabs interaction root.
 *
 * @param props - Tabs properties.
 * @param props.className - Additional CSS classes.
 * @returns The rendered tabs UI.
 */
function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      className={cn("flex flex-col gap-4", className)}
      {...props}
    />
  );
}

/**
 * Renders the accessible tab list.
 *
 * @param props - Tabs list properties.
 * @param props.className - Additional CSS classes.
 * @returns The rendered tabs list UI.
 */
function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        "inline-flex h-9 w-fit items-center rounded-lg bg-muted p-[3px] text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Renders a control that selects its associated tab panel.
 *
 * @param props - Tabs trigger properties.
 * @param props.className - Additional CSS classes.
 * @returns The rendered tabs trigger UI.
 */
function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Tab>) {
  return (
    <TabsPrimitive.Tab
      className={cn(
        "inline-flex h-[calc(100%-1px)] items-center justify-center rounded-md border border-transparent px-3 py-1 text-sm font-medium text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[selected]:bg-background data-[selected]:shadow-sm",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Renders the content panel associated with a tab.
 *
 * @param props - Tabs content properties.
 * @param props.className - Additional CSS classes.
 * @returns The rendered tabs content UI.
 */
function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Panel>) {
  return (
    <TabsPrimitive.Panel className={cn("outline-none", className)} {...props} />
  );
}

export { Tabs, TabsContent, TabsList, TabsTrigger };
