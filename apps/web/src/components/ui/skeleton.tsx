import { cn } from "@/lib/utils";

/**
 * Renders an animated placeholder block.
 *
 * @param props - Skeleton properties.
 * @param props.className - Additional CSS classes.
 * @returns The rendered skeleton UI.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-md bg-accent", className)}
      {...props}
    />
  );
}

export { Skeleton };
