import { Separator as SeparatorPrimitive } from "@base-ui/react/separator";
import type * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Renders a horizontal or vertical visual separator.
 *
 * @param props - Separator properties.
 * @param props.className - Additional CSS classes.
 * @param props.decorative - Whether assistive technologies should ignore the separator.
 * @param props.orientation - Horizontal or vertical separator axis.
 * @returns The rendered separator UI.
 */
function Separator({
  className,
  decorative = true,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof SeparatorPrimitive> & {
  /**
   * Whether assistive technologies should ignore the separator.
   *
   * @default true
   */
  decorative?: boolean;
}) {
  if (decorative) {
    const divProps = props as React.ComponentProps<"div">;

    return (
      <div
        className={cn(
          "shrink-0 bg-border data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px",
          className,
        )}
        data-orientation={orientation}
        data-slot="separator"
        role="none"
        {...divProps}
      />
    );
  }

  return (
    <SeparatorPrimitive
      className={cn(
        "shrink-0 bg-border data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px",
        className,
      )}
      data-slot="separator"
      orientation={orientation}
      role="separator"
      {...props}
    />
  );
}

export { Separator };
