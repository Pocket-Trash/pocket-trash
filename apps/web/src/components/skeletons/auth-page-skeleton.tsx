import { Skeleton } from "@/components/ui/skeleton";

/**
 * Renders a placeholder for an authentication page.
 *
 * @returns The rendered auth page skeleton UI.
 */
export function AuthPageSkeleton() {
  return (
    <div className="w-full max-w-100 rounded-lg border border-border bg-card p-6 shadow-sm">
      <Skeleton className="mx-auto size-10 rounded-full" />
      <Skeleton className="mx-auto mt-5 h-6 w-40" />
      <Skeleton className="mx-auto mt-3 h-4 w-52" />
      <div className="mt-8 space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  );
}
