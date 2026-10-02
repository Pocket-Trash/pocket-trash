import type * as React from "react";
import { TooltipProvider as UiTooltipProvider } from "@/components/ui/tooltip";

/**
 * Wraps application content with the shared tooltip runtime.
 *
 * @param props - Application content that may render tooltips.
 * @returns Shared tooltip provider.
 */
export function TooltipProvider({
  children,
}: {
  /** Application content. */
  children: React.ReactNode;
}) {
  return <UiTooltipProvider>{children}</UiTooltipProvider>;
}
