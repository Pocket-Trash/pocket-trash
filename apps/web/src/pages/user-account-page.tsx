import {
  ClerkLoaded,
  ClerkLoading,
  UserProfile,
} from "@clerk/tanstack-react-start";
import { Skeleton } from "@/components/ui/skeleton";
import { UserPageShell } from "@/components/user-page-shell";
import { webText } from "@/lib/ui-text";
import { useLocale } from "@/providers/locale-provider";

export function UserAccountPage() {
  const { locale } = useLocale();
  const t = (key: Parameters<typeof webText>[1]) => webText(locale, key);

  return (
    <UserPageShell title={t("Account")}>
      <ClerkLoading>
        <UserProfileSkeleton />
      </ClerkLoading>
      <ClerkLoaded>
        <UserProfile routing="hash" />
      </ClerkLoaded>
    </UserPageShell>
  );
}

function UserProfileSkeleton() {
  return (
    <div className="w-full max-w-4xl rounded-lg border border-border bg-card p-6 shadow-sm">
      <div className="flex items-center gap-4">
        <Skeleton className="size-16 rounded-full" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
      </div>
      <div className="mt-8 grid gap-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  );
}
