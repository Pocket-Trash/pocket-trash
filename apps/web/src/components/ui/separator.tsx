import { Separator as SeparatorPrimitive } from "@base-ui/react/separator";
import * as React from "react";
import { cn } from "@/lib/utils";

function Separator({
  className,
  decorative = true,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof SeparatorPrimitive> & {
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
